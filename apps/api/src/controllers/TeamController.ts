// apps/api/src/controllers/TeamController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db';
import { eventStore } from '../services/EventStoreService';
import { notificationService } from '../services/NotificationService';

// ── Schemas ───────────────────────────────────────────────────────────────────

const createTeamSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  color:       z.string().max(50).optional(),
  icon:        z.string().max(500).optional(),
});

const updateTeamSchema = z.object({
  name:        z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  color:       z.string().max(50).nullable().optional(),
  icon:        z.string().max(500).nullable().optional(),
  leadId:      z.string().uuid().nullable().optional(),
});

const addMemberSchema = z.object({
  email:  z.string().email().optional(),
  userId: z.string().uuid().optional(),
  role:   z.enum(['LEAD', 'MEMBER']).optional(),
}).refine((d) => d.email || d.userId, { message: 'email o userId requerido' });

const changeMemberRoleSchema = z.object({
  role: z.enum(['LEAD', 'MEMBER']),
});

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtTeam(row: any) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    color:       row.color,
    icon:        row.icon,
    leadId:      row.lead_id,
    createdBy:   row.created_by,
    createdAt:   new Date(row.created_at).toISOString(),
    updatedAt:   new Date(row.updated_at).toISOString(),
    memberCount: Number(row.member_count ?? 0),
    lead:        row.lead_name ? { id: row.lead_id, name: row.lead_name, avatar: row.lead_avatar } : null,
  };
}

function fmtMember(row: any) {
  return {
    id:       row.user_id,   // user id — usado en remove/role API calls
    memberId: row.member_id,
    teamId:   row.team_id,
    role:     row.role,
    joinedAt: new Date(row.joined_at).toISOString(),
    name:     row.name,
    email:    row.email,
    avatar:   row.avatar ?? null,
    workload: {
      totalCards:          Number(row.total_cards ?? 0),
      overdueCards:        Number(row.overdue_cards ?? 0),
      completedThisWeek:   Number(row.completed_this_week ?? 0),
      lastActivity:        row.last_activity ? new Date(row.last_activity).toISOString() : null,
    },
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

class TeamController {

  /** GET /api/teams — equipos donde el usuario es miembro o creador */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const result = await pool.query(
        `SELECT t.*,
                COUNT(tm.id)::int AS member_count,
                u.name AS lead_name, u.avatar AS lead_avatar
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = t.lead_id
         WHERE t.created_by = $1
            OR EXISTS (SELECT 1 FROM team_members WHERE team_id = t.id AND user_id = $1)
         GROUP BY t.id, u.name, u.avatar
         ORDER BY t.updated_at DESC`,
        [userId]
      );

      res.json({ success: true, data: { teams: result.rows.map(fmtTeam) } });
    } catch (error) {
      console.error('[TeamController.list]', error);
      res.status(500).json({ success: false, error: { message: 'Error al listar equipos' } });
    }
  }

  /** POST /api/teams */
  async create(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const body = createTeamSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: body.error.issues[0].message } });

      const { name, description, color, icon } = body.data;

      const result = await pool.query(
        `INSERT INTO teams (name, description, color, icon, lead_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING *`,
        [name, description ?? null, color ?? '#3b82f6', icon ?? null, userId]
      );
      const team = result.rows[0];

      // El creador es automáticamente LEAD
      await pool.query(
        `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'LEAD')
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [team.id, userId]
      );

      try {
        await eventStore.emit('team.created' as any, {
          teamId: team.id,
          name: team.name,
        }, userId as any);
      } catch {}

      res.status(201).json({ success: true, data: { team: fmtTeam({ ...team, member_count: 1 }) } });
    } catch (error) {
      console.error('[TeamController.create]', error);
      res.status(500).json({ success: false, error: { message: 'Error al crear equipo' } });
    }
  }

  /** GET /api/teams/:id */
  async getById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id } = req.params;

      const result = await pool.query(
        `SELECT t.*,
                COUNT(tm.id)::int AS member_count,
                u.name AS lead_name, u.avatar AS lead_avatar
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN users u ON u.id = t.lead_id
         WHERE t.id = $1
           AND (t.created_by = $2 OR EXISTS (SELECT 1 FROM team_members WHERE team_id = t.id AND user_id = $2))
         GROUP BY t.id, u.name, u.avatar`,
        [id, userId]
      );

      if (!result.rows.length) {
        return res.status(404).json({ success: false, error: { message: 'Equipo no encontrado' } });
      }

      res.json({ success: true, data: { team: fmtTeam(result.rows[0]) } });
    } catch (error) {
      console.error('[TeamController.getById]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener equipo' } });
    }
  }

  /** PUT /api/teams/:id */
  async update(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id } = req.params;
      const body = updateTeamSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: body.error.issues[0].message } });

      // Solo el lead o creador puede editar
      const check = await pool.query(
        `SELECT 1 FROM teams t
         WHERE t.id = $1 AND (t.created_by = $2 OR t.lead_id = $2)`,
        [id, userId]
      );
      if (!check.rows.length) {
        return res.status(403).json({ success: false, error: { message: 'Solo el lead o creador puede editar el equipo' } });
      }

      const { name, description, color, icon, leadId } = body.data;
      const result = await pool.query(
        `UPDATE teams SET
           name        = COALESCE($1, name),
           description = COALESCE($2, description),
           color       = COALESCE($3, color),
           icon        = COALESCE($4, icon),
           lead_id     = CASE WHEN $5::text IS NOT NULL THEN $5::uuid ELSE lead_id END,
           updated_at  = NOW()
         WHERE id = $6
         RETURNING *`,
        [name ?? null, description ?? null, color ?? null, icon ?? null, leadId ?? null, id]
      );

      try {
        await eventStore.emit('team.updated' as any, {
          teamId: id,
          name: result.rows[0]?.name,
        }, userId as any);
      } catch {}

      res.json({ success: true, data: { team: fmtTeam(result.rows[0]) } });
    } catch (error) {
      console.error('[TeamController.update]', error);
      res.status(500).json({ success: false, error: { message: 'Error al actualizar equipo' } });
    }
  }

  /** DELETE /api/teams/:id */
  async delete(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id } = req.params;
      const check = await pool.query(`SELECT 1 FROM teams WHERE id = $1 AND created_by = $2`, [id, userId]);
      if (!check.rows.length) {
        return res.status(403).json({ success: false, error: { message: 'Solo el creador puede eliminar el equipo' } });
      }

      // Get team name before deleting
      const teamInfo = await pool.query(`SELECT name FROM teams WHERE id = $1`, [id]);
      const teamName = teamInfo.rows[0]?.name;

      await pool.query(`DELETE FROM teams WHERE id = $1`, [id]);

      try {
        await eventStore.emit('team.deleted' as any, {
          teamId: id,
          name: teamName,
        }, userId as any);
      } catch {}

      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[TeamController.delete]', error);
      res.status(500).json({ success: false, error: { message: 'Error al eliminar equipo' } });
    }
  }

  /** GET /api/teams/:id/members — con workload por miembro */
  async getMembers(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id } = req.params;

      // Verificar acceso
      const access = await pool.query(
        `SELECT 1 FROM teams WHERE id = $1 AND (created_by = $2 OR EXISTS (SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2))`,
        [id, userId]
      );
      if (!access.rows.length) return res.status(404).json({ success: false, error: { message: 'Equipo no encontrado' } });

      const result = await pool.query(
        `SELECT
           tm.id          AS member_id,
           tm.team_id,
           tm.role,
           tm.joined_at,
           u.id           AS user_id,
           u.name,
           u.email,
           u.avatar,
           -- total cards asignadas activas
           COUNT(DISTINCT cm.card_id) FILTER (WHERE c.completed = false)         AS total_cards,
           -- cards vencidas (no completadas y due_date < now)
           COUNT(DISTINCT cm.card_id) FILTER (WHERE c.completed = false AND c.due_date < NOW()) AS overdue_cards,
           -- completadas esta semana
           COUNT(DISTINCT cm.card_id) FILTER (WHERE c.completed = true AND c.completed_at >= NOW() - INTERVAL '7 days') AS completed_this_week,
           -- última actividad (updated_at de la card más reciente)
           MAX(c.updated_at) AS last_activity
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
         LEFT JOIN card_members cm ON cm.user_id = u.id
         LEFT JOIN cards c ON c.id = cm.card_id
         WHERE tm.team_id = $1
         GROUP BY tm.id, tm.team_id, tm.role, tm.joined_at, u.id, u.name, u.email, u.avatar
         ORDER BY tm.role DESC, u.name ASC`,
        [id]
      );

      res.json({ success: true, data: { members: result.rows.map(fmtMember) } });
    } catch (error) {
      console.error('[TeamController.getMembers]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener miembros' } });
    }
  }

  /** POST /api/teams/:id/members */
  async addMember(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id } = req.params;
      const body = addMemberSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: body.error.issues[0].message } });

      // Solo lead o creador puede añadir
      const canEdit = await pool.query(
        `SELECT 1 FROM teams WHERE id = $1 AND (created_by = $2 OR lead_id = $2)
         UNION
         SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND role = 'LEAD'`,
        [id, userId]
      );
      if (!canEdit.rows.length) {
        return res.status(403).json({ success: false, error: { message: 'Solo el lead puede añadir miembros' } });
      }

      // Resolver userId desde email si es necesario
      let targetUserId = body.data.userId;
      if (!targetUserId && body.data.email) {
        const userRes = await pool.query(`SELECT id FROM users WHERE email = $1`, [body.data.email]);
        if (!userRes.rows.length) return res.status(404).json({ success: false, error: { message: 'Usuario no encontrado' } });
        targetUserId = userRes.rows[0].id;
      }

      await pool.query(
        `INSERT INTO team_members (team_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [id, targetUserId, body.data.role ?? 'MEMBER']
      );

      await pool.query(`UPDATE teams SET updated_at = NOW() WHERE id = $1`, [id]);

      const teamInfo = await pool.query(`SELECT name FROM teams WHERE id = $1`, [id]);
      const teamName = teamInfo.rows[0]?.name;
      const actorInfo = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
      const actorName = actorInfo.rows[0]?.name ?? '';

      try {
        await eventStore.emit('team.member.added' as any, {
          teamId: id,
          teamName,
          memberId: targetUserId,
        }, userId as any);
      } catch {}

      // Notification to the added member (skip if self-add)
      if (targetUserId !== userId) {
        try {
          await notificationService.createTeamMemberAddedNotification({
            userId: targetUserId!,
            adderId: userId,
            adderName: actorName,
            teamId: id,
            teamName: teamName ?? '',
          });
        } catch {}
      }

      res.status(201).json({ success: true, data: null });
    } catch (error) {
      console.error('[TeamController.addMember]', error);
      res.status(500).json({ success: false, error: { message: 'Error al añadir miembro' } });
    }
  }

  /** PUT /api/teams/:id/members/:userId */
  async changeMemberRole(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id, userId: targetId } = req.params;
      const body = changeMemberRoleSchema.safeParse(req.body);
      if (!body.success) return res.status(400).json({ success: false, error: { message: body.error.issues[0].message } });

      const canEdit = await pool.query(
        `SELECT 1 FROM teams WHERE id = $1 AND (created_by = $2 OR lead_id = $2)`,
        [id, userId]
      );
      if (!canEdit.rows.length) {
        return res.status(403).json({ success: false, error: { message: 'Solo el creador o lead puede cambiar roles' } });
      }

      await pool.query(
        `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3`,
        [body.data.role, id, targetId]
      );

      // Si el nuevo rol es LEAD, actualizar lead_id del equipo
      if (body.data.role === 'LEAD') {
        await pool.query(`UPDATE teams SET lead_id = $1, updated_at = NOW() WHERE id = $2`, [targetId, id]);
      }

      const teamInfo = await pool.query(`SELECT name FROM teams WHERE id = $1`, [id]);
      const teamName = teamInfo.rows[0]?.name;
      try {
        await eventStore.emit('team.member.roleChanged' as any, {
          teamId: id,
          teamName,
          memberId: targetId,
          newRole: body.data.role,
        }, userId as any);
      } catch {}

      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[TeamController.changeMemberRole]', error);
      res.status(500).json({ success: false, error: { message: 'Error al cambiar rol' } });
    }
  }

  /** DELETE /api/teams/:id/members/:userId */
  async removeMember(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id, userId: targetId } = req.params;

      // Solo lead/creador puede remover, o el propio usuario puede salir
      const canRemove = await pool.query(
        `SELECT 1 FROM teams WHERE id = $1 AND (created_by = $2 OR lead_id = $2)`,
        [id, userId]
      );
      if (!canRemove.rows.length && userId !== targetId) {
        return res.status(403).json({ success: false, error: { message: 'No tienes permiso para remover este miembro' } });
      }

      await pool.query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, [id, targetId]);
      await pool.query(`UPDATE teams SET updated_at = NOW() WHERE id = $1`, [id]);

      const teamInfo = await pool.query(`SELECT name FROM teams WHERE id = $1`, [id]);
      const teamName = teamInfo.rows[0]?.name;
      const actorInfo = await pool.query(`SELECT name FROM users WHERE id = $1`, [userId]);
      const actorName = actorInfo.rows[0]?.name ?? '';

      try {
        await eventStore.emit('team.member.removed' as any, {
          teamId: id,
          teamName,
          memberId: targetId,
        }, userId as any);
      } catch {}

      if (targetId !== userId) {
        try {
          await notificationService.createTeamMemberRemovedNotification({
            userId: targetId,
            removerId: userId,
            removerName: actorName,
            teamId: id,
            teamName: teamName ?? '',
          });
        } catch {}
      }

      res.json({ success: true, data: null });
    } catch (error) {
      console.error('[TeamController.removeMember]', error);
      res.status(500).json({ success: false, error: { message: 'Error al remover miembro' } });
    }
  }

  /** GET /api/teams/:id/workspaces — workspaces activos derivados de project_teams */
  async getWorkspaces(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        `SELECT
           w.id, w.name, w.color,
           COUNT(DISTINCT pt.project_id)::int AS project_count,
           COUNT(DISTINCT cm.card_id) FILTER (WHERE c.completed = false) AS active_cards
         FROM project_teams pt
         JOIN projects p   ON p.id = pt.project_id
         JOIN workspaces w ON w.id = p.workspace_id
         LEFT JOIN boards b  ON b.workspace_id = w.id
         LEFT JOIN lists  l  ON l.board_id = b.id
         LEFT JOIN cards  c  ON c.list_id = l.id
         LEFT JOIN card_members cm ON cm.card_id = c.id
           AND cm.user_id IN (SELECT user_id FROM team_members WHERE team_id = $1)
         WHERE pt.team_id = $1
         GROUP BY w.id, w.name, w.color
         ORDER BY project_count DESC`,
        [id]
      );
      const workspaces = result.rows.map((r) => ({
        id:           r.id,
        name:         r.name,
        color:        r.color ?? null,
        projectCount: r.project_count,
        activeCards:  Number(r.active_cards ?? 0),
      }));
      res.json({ success: true, data: { workspaces } });
    } catch (error) {
      console.error('[TeamController.getWorkspaces]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener workspaces' } });
    }
  }

  /** GET /api/teams/:id/activity */
  async getActivity(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      // Verificar acceso
      const access = await pool.query(
        `SELECT 1 FROM teams WHERE id = $1 AND (created_by = $2 OR EXISTS (SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2))`,
        [id, userId]
      );
      if (!access.rows.length) return res.status(404).json({ success: false, error: { message: 'Equipo no encontrado' } });

      // Actividad reciente de los miembros del equipo (via user_activity_log si existe, si no via events)
      const result = await pool.query(
        `SELECT
           e.id,
           e.event_type,
           e.payload,
           e.created_at,
           u.id   AS user_id,
           u.name AS user_name,
           u.avatar AS user_avatar
         FROM events e
         JOIN users u ON u.id = e.user_id
         WHERE e.user_id IN (SELECT user_id FROM team_members WHERE team_id = $1)
           AND e.event_type IN ('card.created','card.updated','card.moved','card.completed','list.created','board.created')
         ORDER BY e.created_at DESC
         LIMIT $2`,
        [id, limit]
      );

      const events = result.rows.map((row) => {
        const p = row.payload ?? {};
        let action = row.event_type as string;
        let entityName: string | null = null;

        switch (row.event_type) {
          case 'card.created':    action = 'creó la card';       entityName = p.cardName ?? p.title ?? null; break;
          case 'card.updated':    action = 'actualizó la card';  entityName = p.cardName ?? p.title ?? null; break;
          case 'card.moved':      action = 'movió la card';      entityName = p.cardName ?? p.title ?? null; break;
          case 'card.completed':  action = 'completó la card';   entityName = p.cardName ?? p.title ?? null; break;
          case 'list.created':    action = 'creó la lista';      entityName = p.listName ?? p.name ?? null;  break;
          case 'board.created':   action = 'creó el tablero';    entityName = p.boardName ?? p.name ?? null; break;
        }

        return {
          id:         row.id,
          userId:     row.user_id,
          userName:   row.user_name,
          userAvatar: row.user_avatar ?? null,
          action,
          entityName,
          createdAt:  new Date(row.created_at).toISOString(),
        };
      });

      res.json({ success: true, data: { events } });
    } catch (error) {
      console.error('[TeamController.getActivity]', error);
      res.status(500).json({ success: false, error: { message: 'Error al obtener actividad' } });
    }
  }
}

export const teamController = new TeamController();
