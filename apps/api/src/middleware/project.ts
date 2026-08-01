import type { NextFunction, Request, Response } from 'express';
import { pool } from '../lib/db';

type ProjectRequest = Request & { projectContext?: { workspaceId: string; role: string } };

/**
 * Guards all project-scoped routes through the workspace membership that owns
 * the project. Controllers can then focus on their specific role checks.
 */
export async function requireProjectMembership(req: Request, res: Response, next: NextFunction) {
  try {
    const projectId = req.params.id;
    const userId = req.user?.id;
    if (!projectId || !userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' } });
    }

    const membership = await pool.query(
      `SELECT p.workspace_id, wm.role
       FROM projects p
       JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
       WHERE p.id = $1 AND wm.user_id = $2`,
      [projectId, userId]
    );
    if (membership.rowCount === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Proyecto no encontrado' } });
    }

    (req as ProjectRequest).projectContext = {
      workspaceId: membership.rows[0].workspace_id,
      role: membership.rows[0].role,
    };
    return next();
  } catch {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo validar acceso al proyecto' } });
  }
}

/**
 * The project UI grants write controls only to workspace owners and admins.
 * Keep that authorization rule at the route boundary so every controller has
 * the same protection even if it is reused by a new endpoint.
 */
export function requireProjectEditor(req: Request, res: Response, next: NextFunction) {
  const role = (req as ProjectRequest).projectContext?.role;
  if (role === 'OWNER' || role === 'ADMIN') return next();
  return res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Se requiere rol de administrador del espacio de trabajo' },
  });
}
