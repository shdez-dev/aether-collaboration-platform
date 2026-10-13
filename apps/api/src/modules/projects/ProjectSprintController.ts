import type { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../lib/db';
import { projectAuthorizationService } from '../../services/ProjectAuthorizationService';

const sprintInput = z.object({
  name: z.string().trim().min(1).max(255),
  goal: z.string().trim().max(1000).default(''),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cardIds: z.array(z.string().uuid()).default([]),
}).refine((value) => value.startDate <= value.endDate, { message: 'La fecha de fin debe ser posterior al inicio', path: ['endDate'] });

const sprintUpdate = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  goal: z.string().trim().max(1000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).optional(),
});

async function visibleCardIds(projectId: string, userId: string, cardIds: string[]) {
  if (!cardIds.length) return true;
  const boardIds = await projectAuthorizationService.getVisibleBoardIds(projectId, userId);
  const result = await pool.query(
    `SELECT DISTINCT c.id FROM cards c
     JOIN lists l ON l.id = c.list_id
     JOIN project_boards pb ON pb.board_id = l.board_id AND pb.project_id = $1
     WHERE c.id = ANY($2::uuid[]) AND l.board_id = ANY($3::uuid[]) AND c.completed = false`,
    [projectId, cardIds, boardIds],
  );
  return result.rows.length === cardIds.length;
}

async function listSprints(projectId: string, userId: string) {
  const boardIds = await projectAuthorizationService.getVisibleBoardIds(projectId, userId);
  const result = await pool.query(
    `SELECT s.id, s.board_id AS "boardId", s.project_id AS "projectId", s.name, s.goal,
            s.start_date AS "startDate", s.end_date AS "endDate", s.status, s.position,
            COALESCE((SELECT json_agg(json_build_object(
              'id', c.id, 'title', c.title, 'completed', c.completed,
              'priority', c.priority, 'startDate', c.start_date, 'dueDate', c.due_date,
              'listId', l.id, 'position', c.position,
              'boardId', b.id, 'boardName', b.name, 'listName', l.name
            ) ORDER BY sc.added_at)
              FROM sprint_cards sc JOIN cards c ON c.id = sc.card_id
              JOIN lists l ON l.id = c.list_id JOIN boards b ON b.id = l.board_id
              WHERE sc.sprint_id = s.id AND b.id = ANY($2::uuid[])), '[]'::json) AS cards
     FROM board_sprints s WHERE s.project_id = $1
     ORDER BY s.created_at ASC, s.position ASC, s.id ASC`,
    [projectId, boardIds],
  );
  return result.rows;
}

export class ProjectSprintController {
  async list(req: Request, res: Response) {
    try { return res.json({ success: true, data: { sprints: await listSprints(req.params.id, req.user!.id) } }); }
    catch { return res.status(500).json({ success: false, error: { message: 'No se pudieron cargar los sprints' } }); }
  }

  async create(req: Request, res: Response) {
    const parsed = sprintInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Revisa el nombre, objetivo y fechas del sprint' } });
    const projectId = req.params.id;
    const userId = req.user!.id;
    const cardIds = [...new Set(parsed.data.cardIds)];
    if (!await visibleCardIds(projectId, userId, cardIds)) return res.status(400).json({ success: false, error: { message: 'Selecciona tarjetas pendientes de los tableros de este proyecto' } });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const project = await client.query('SELECT methodology FROM projects WHERE id = $1 FOR UPDATE', [projectId]);
      if (project.rows[0]?.methodology !== 'SCRUM') {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, error: { message: 'Los sprints se planifican en proyectos Scrum' } });
      }
      const result = await client.query(
        `INSERT INTO board_sprints (id, board_id, project_id, name, goal, start_date, end_date, status, position, created_by)
         VALUES (gen_random_uuid(), NULL, $1, $2, $3, $4, $5, 'PLANNED',
           (SELECT COALESCE(MAX(position), -1) + 1 FROM board_sprints WHERE project_id = $1), $6) RETURNING id`,
        [projectId, parsed.data.name, parsed.data.goal, parsed.data.startDate, parsed.data.endDate, userId],
      );
      if (cardIds.length) {
        await client.query(
          `DELETE FROM sprint_cards sc USING board_sprints s
           WHERE sc.sprint_id = s.id AND s.project_id = $1 AND s.status IN ('PLANNED', 'ACTIVE')
             AND sc.card_id = ANY($2::uuid[])`, [projectId, cardIds],
        );
        await client.query(
          `INSERT INTO sprint_cards (sprint_id, card_id, added_by)
           SELECT $1, unnest($2::uuid[]), $3`, [result.rows[0].id, cardIds, userId],
        );
      }
      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { sprints: await listSprints(projectId, userId) } });
    } catch {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: { message: 'No se pudo crear el sprint' } });
    } finally { client.release(); }
  }

  async update(req: Request, res: Response) {
    const parsed = sprintUpdate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Datos del sprint inválidos' } });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [req.params.id]);
      const current = await client.query('SELECT * FROM board_sprints WHERE id = $1 AND project_id = $2', [req.params.sprintId, req.params.id]);
      if (!current.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { message: 'Sprint no encontrado' } }); }
      const existing = current.rows[0];
      const start = parsed.data.startDate ?? new Date(existing.start_date).toISOString().slice(0, 10);
      const end = parsed.data.endDate ?? new Date(existing.end_date).toISOString().slice(0, 10);
      if (new Date(start) > new Date(end)) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: { message: 'La fecha de fin debe ser posterior al inicio' } }); }
      if (parsed.data.status === 'ACTIVE') {
        const active = await client.query("SELECT id FROM board_sprints WHERE project_id = $1 AND status = 'ACTIVE' AND id <> $2", [req.params.id, req.params.sprintId]);
        if (active.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, error: { message: 'Completa el sprint activo antes de iniciar otro' } }); }
      }
      if (existing.status === 'COMPLETED' && parsed.data.status && parsed.data.status !== 'COMPLETED') {
        await client.query('ROLLBACK'); return res.status(409).json({ success: false, error: { message: 'Un sprint completado no puede reabrirse' } });
      }
      await client.query(
        `UPDATE board_sprints SET name = $3, goal = $4, start_date = $5, end_date = $6,
         status = $7, updated_at = NOW() WHERE id = $1 AND project_id = $2`,
        [req.params.sprintId, req.params.id, parsed.data.name ?? existing.name, parsed.data.goal ?? existing.goal,
          start, end, parsed.data.status ?? existing.status],
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: { sprints: await listSprints(req.params.id, req.user!.id) } });
    } catch {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: { message: 'No se pudo actualizar el sprint' } });
    } finally { client.release(); }
  }

  async setCards(req: Request, res: Response) {
    const parsed = z.object({ cardIds: z.array(z.string().uuid()) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Tarjetas inválidas' } });
    const cardIds = [...new Set(parsed.data.cardIds)];
    if (!await visibleCardIds(req.params.id, req.user!.id, cardIds)) return res.status(400).json({ success: false, error: { message: 'Las tarjetas deben pertenecer a los tableros de este proyecto' } });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [req.params.id]);
      const sprint = await client.query('SELECT status FROM board_sprints WHERE id = $1 AND project_id = $2', [req.params.sprintId, req.params.id]);
      if (!sprint.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { message: 'Sprint no encontrado' } }); }
      if (sprint.rows[0].status === 'COMPLETED') { await client.query('ROLLBACK'); return res.status(409).json({ success: false, error: { message: 'Un sprint completado no se puede modificar' } }); }
      if (cardIds.length) await client.query(
        `DELETE FROM sprint_cards sc USING board_sprints s
         WHERE sc.sprint_id = s.id AND s.project_id = $1 AND s.status IN ('PLANNED', 'ACTIVE')
           AND sc.card_id = ANY($2::uuid[])`, [req.params.id, cardIds],
      );
      await client.query(`DELETE FROM sprint_cards sc WHERE sc.sprint_id = $1
        AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = sc.card_id AND c.completed = true)`, [req.params.sprintId]);
      if (cardIds.length) await client.query(
        `INSERT INTO sprint_cards (sprint_id, card_id, added_by)
         SELECT $1, unnest($2::uuid[]), $3 ON CONFLICT (sprint_id, card_id) DO NOTHING`, [req.params.sprintId, cardIds, req.user!.id],
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: { sprints: await listSprints(req.params.id, req.user!.id) } });
    } catch {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: { message: 'No se pudieron mover las tarjetas' } });
    } finally { client.release(); }
  }

  async remove(req: Request, res: Response) {
    try {
      const result = await pool.query("DELETE FROM board_sprints WHERE id = $1 AND project_id = $2 AND status = 'PLANNED' RETURNING id", [req.params.sprintId, req.params.id]);
      if (!result.rows.length) return res.status(409).json({ success: false, error: { message: 'Solo puedes eliminar sprints planificados' } });
      return res.json({ success: true });
    } catch { return res.status(500).json({ success: false, error: { message: 'No se pudo eliminar el sprint' } }); }
  }
}

export const projectSprintController = new ProjectSprintController();
