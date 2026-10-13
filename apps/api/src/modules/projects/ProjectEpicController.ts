import type { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../lib/db';
import { projectAuthorizationService } from '../../services/ProjectAuthorizationService';

const epicInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
});

export class ProjectEpicController {
  async list(req: Request, res: Response) {
    try {
      const result = await pool.query(
        `SELECT e.id, e.project_id AS "projectId", e.name, e.description, e.position,
                e.created_at AS "createdAt", e.updated_at AS "updatedAt"
         FROM project_epics e WHERE e.project_id = $1
         ORDER BY e.position, e.created_at, e.id`,
        [req.params.id],
      );
      return res.json({ success: true, data: { epics: result.rows } });
    } catch {
      return res.status(500).json({ success: false, error: { message: 'No se pudieron cargar las épicas' } });
    }
  }

  async create(req: Request, res: Response) {
    const parsed = epicInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Revisa el nombre y la descripción de la épica' } });
    try {
      const result = await pool.query(
        `INSERT INTO project_epics (id, project_id, name, description, position, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3,
           (SELECT COALESCE(MAX(position), -1) + 1 FROM project_epics WHERE project_id = $1), $4)
         RETURNING id, project_id AS "projectId", name, description, position,
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [req.params.id, parsed.data.name, parsed.data.description || null, req.user!.id],
      );
      return res.status(201).json({ success: true, data: { epic: result.rows[0] } });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ success: false, error: { message: 'Ya existe una épica con ese nombre' } });
      return res.status(500).json({ success: false, error: { message: 'No se pudo crear la épica' } });
    }
  }

  async update(req: Request, res: Response) {
    const parsed = epicInput.partial().safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) return res.status(400).json({ success: false, error: { message: 'No hay cambios válidos para guardar' } });
    try {
      const result = await pool.query(
        `UPDATE project_epics SET name = COALESCE($3, name),
           description = CASE WHEN $4 THEN $5 ELSE description END, updated_at = NOW()
         WHERE id = $1 AND project_id = $2
         RETURNING id, project_id AS "projectId", name, description, position,
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [req.params.epicId, req.params.id, parsed.data.name ?? null,
          parsed.data.description !== undefined, parsed.data.description ?? null],
      );
      if (!result.rows.length) return res.status(404).json({ success: false, error: { message: 'Épica no encontrada' } });
      return res.json({ success: true, data: { epic: result.rows[0] } });
    } catch (error: any) {
      if (error.code === '23505') return res.status(409).json({ success: false, error: { message: 'Ya existe una épica con ese nombre' } });
      return res.status(500).json({ success: false, error: { message: 'No se pudo actualizar la épica' } });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const result = await pool.query(
        'DELETE FROM project_epics WHERE id = $1 AND project_id = $2 RETURNING id',
        [req.params.epicId, req.params.id],
      );
      if (!result.rows.length) return res.status(404).json({ success: false, error: { message: 'Épica no encontrada' } });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ success: false, error: { message: 'No se pudo eliminar la épica' } });
    }
  }

  async setCardEpic(req: Request, res: Response) {
    const parsed = z.object({ epicId: z.string().uuid().nullable() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Selecciona una épica válida' } });
    const projectId = req.params.id;
    let boardIds: string[];
    try {
      boardIds = await projectAuthorizationService.getVisibleBoardIds(projectId, req.user!.id);
    } catch {
      return res.status(500).json({ success: false, error: { message: 'No se pudo validar el acceso a la tarjeta' } });
    }
    if (!boardIds.length) return res.status(404).json({ success: false, error: { message: 'La tarjeta no pertenece a este proyecto' } });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const card = await client.query(
        `SELECT c.id FROM cards c
         JOIN lists l ON l.id = c.list_id
         JOIN project_boards pb ON pb.board_id = l.board_id AND pb.project_id = $1
         WHERE c.id = $2 AND l.board_id = ANY($3::uuid[]) FOR UPDATE OF c`,
        [projectId, req.params.cardId, boardIds],
      );
      if (!card.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'La tarjeta no pertenece a este proyecto' } });
      }

      if (parsed.data.epicId) {
        const epic = await client.query('SELECT id FROM project_epics WHERE id = $1 AND project_id = $2', [parsed.data.epicId, projectId]);
        if (!epic.rows.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: { message: 'La épica no pertenece a este proyecto' } });
        }
        await client.query(
          `INSERT INTO project_epic_cards (project_id, epic_id, card_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (project_id, card_id) DO UPDATE SET epic_id = EXCLUDED.epic_id, added_at = NOW()`,
          [projectId, parsed.data.epicId, req.params.cardId],
        );
      } else {
        await client.query('DELETE FROM project_epic_cards WHERE project_id = $1 AND card_id = $2', [projectId, req.params.cardId]);
      }

      await client.query('COMMIT');
      return res.json({ success: true, data: { epicId: parsed.data.epicId } });
    } catch {
      await client.query('ROLLBACK');
      return res.status(500).json({ success: false, error: { message: 'No se pudo cambiar la épica de la tarjeta' } });
    } finally {
      client.release();
    }
  }
}

export const projectEpicController = new ProjectEpicController();
