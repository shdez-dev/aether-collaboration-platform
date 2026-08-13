import type { NextFunction, Request, Response } from 'express';
import { pool } from '../lib/db';

export type TeamRequest = Request & {
  teamContext?: {
    id: string;
    workspaceId: string;
    canManage: boolean;
    workspaceRole: string;
    teamRole: string | null;
    isCreator: boolean;
  };
};

/**
 * A team is scoped to its workspace. A residual team_members row must never
 * survive as an authorization grant after workspace access is revoked.
 */
export function requireTeamAccess(manage = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const teamId = req.params.id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    if (!teamId) return res.status(400).json({ success: false, error: { code: 'MISSING_TEAM_ID' } });

    try {
      const result = await pool.query(
        `SELECT t.workspace_id, t.created_by, wm.role AS workspace_role, tm.role AS team_role
         FROM teams t
         JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = $2
         LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $2
         WHERE t.id = $1 AND t.workspace_id IS NOT NULL`,
        [teamId, userId]
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Equipo no encontrado' } });

      const workspaceAdmin = ['OWNER', 'ADMIN'].includes(row.workspace_role);
      const canRead = workspaceAdmin || row.created_by === userId || Boolean(row.team_role);
      const canManage = workspaceAdmin || row.created_by === userId || row.team_role === 'ADMIN';
      if (!canRead || (manage && !canManage)) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Acceso al equipo denegado' } });
      }
      (req as TeamRequest).teamContext = {
        id: teamId,
        workspaceId: row.workspace_id,
        canManage,
        workspaceRole: row.workspace_role,
        teamRole: row.team_role,
        isCreator: row.created_by === userId,
      };
      return next();
    } catch {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR' } });
    }
  };
}
