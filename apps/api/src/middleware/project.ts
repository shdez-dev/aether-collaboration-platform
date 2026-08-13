import type { NextFunction, Request, Response } from 'express';
import {
  projectAuthorizationService,
  type ProjectAccess,
  type ProjectAction,
} from '../services/ProjectAuthorizationService';
import { pool } from '../lib/db';
import { workspaceService } from '../services/WorkspaceService';
import type { WorkspaceRequest } from './workspace';

export type ProjectRequest = Request & { projectContext?: ProjectAccess };

/**
 * Controllers still receive the resolved workspace role for workspace-only
 * boards. These helpers combine it with the explicit project context set by
 * requireProjectBoundResourceAccess, so a project lead is not accidentally
 * rejected merely because their workspace role is VIEWER or MEMBER.
 */
function workspaceRole(req: Request) {
  return (req as WorkspaceRequest).workspace?.role;
}

export function canManageProjectBoundResource(req: Request) {
  const level = (req as ProjectRequest).projectContext?.level;
  return level === 'MANAGE' || ['OWNER', 'ADMIN'].includes(workspaceRole(req) ?? '');
}

export function canContributeToProjectBoundResource(req: Request) {
  const level = (req as ProjectRequest).projectContext?.level;
  return level === 'MANAGE'
    || level === 'CONTRIBUTE'
    || ['OWNER', 'ADMIN', 'MEMBER'].includes(workspaceRole(req) ?? '');
}

/**
 * Requires explicit access to a project. Workspace membership alone is not a
 * project grant; it only authorizes platform and workspace-scoped resources.
 */
export function requireProjectAccess(action: ProjectAction, projectIdParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params[projectIdParam];
      const userId = req.user?.id;
      if (!projectId || !userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const access = await projectAuthorizationService.can(projectId, userId, action);
      if (!access) {
        // Hide the existence of projects outside the caller's scope.
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Proyecto no encontrado' },
        });
      }

      (req as ProjectRequest).projectContext = access;
      return next();
    } catch {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'No se pudo validar acceso al proyecto' },
      });
    }
  };
}

// Compatibility names used by the existing project routes.
export const requireProjectMembership = requireProjectAccess('READ');
export const requireProjectEditor = requireProjectAccess('MANAGE');

type ProjectBoundResource = 'board' | 'list' | 'card' | 'comment' | 'sprint' | 'milestone';

async function resolveProjectBoundResource(resource: ProjectBoundResource, resourceId: string) {
  const source = {
    board: { from: 'FROM boards b', where: 'b.id = $1' },
    list: { from: 'FROM lists l JOIN boards b ON b.id = l.board_id', where: 'l.id = $1' },
    card: { from: 'FROM cards c JOIN lists l ON l.id = c.list_id JOIN boards b ON b.id = l.board_id', where: 'c.id = $1' },
    comment: { from: 'FROM comments cm JOIN cards c ON c.id = cm.card_id JOIN lists l ON l.id = c.list_id JOIN boards b ON b.id = l.board_id', where: 'cm.id = $1' },
    sprint: { from: 'FROM board_sprints s JOIN boards b ON b.id = s.board_id', where: 's.id = $1' },
    milestone: { from: 'FROM board_milestones m JOIN boards b ON b.id = m.board_id', where: 'm.id = $1' },
  }[resource];

  const result = await pool.query(
    `SELECT b.workspace_id,
            COALESCE(array_agg(pb.project_id) FILTER (WHERE pb.project_id IS NOT NULL), ARRAY[]::uuid[]) AS project_ids
     ${source.from}
     LEFT JOIN project_boards pb ON pb.board_id = b.id
     WHERE ${source.where}
     GROUP BY b.workspace_id`,
    [resourceId],
  );
  return result.rows[0] as { workspace_id: string; project_ids: string[] } | undefined;
}

/**
 * Applies project access to a board, list, card, sprint or board milestone
 * only when its board is project-bound. Orphan workspace boards retain the
 * existing workspace policy. A shared board requires access to every linked
 * project so it cannot leak data across project boundaries.
 */
export function requireProjectBoundResourceAccess(action: ProjectAction, resource: ProjectBoundResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const resourceId = resource === 'board'
        ? req.params.boardId ?? req.params.id
        : resource === 'list'
          ? req.params.listId ?? req.params.id
          : resource === 'card'
            ? req.params.cardId ?? req.params.id
            : resource === 'comment'
              ? req.params.commentId
            : resource === 'sprint'
              ? req.params.sprintId
              : req.params.milestoneId;
      if (!userId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' } });
      }
      if (!resourceId) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_RESOURCE_ID', message: 'Recurso no identificado' } });
      }

      const context = await resolveProjectBoundResource(resource, resourceId);
      if (!context) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
      }

      const membership = await workspaceService.getMembership(context.workspace_id, userId);
      if (context.project_ids.length === 0) {
        if (!membership) {
          return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
        }
        (req as WorkspaceRequest).workspace = { id: context.workspace_id, role: membership.role };
        return next();
      }

      const accesses = await Promise.all(
        context.project_ids.map((projectId) => projectAuthorizationService.can(projectId, userId, action)),
      );
      if (accesses.some((access) => !access)) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recurso no encontrado' } });
      }

      if (membership) (req as WorkspaceRequest).workspace = { id: context.workspace_id, role: membership.role };
      (req as ProjectRequest).projectContext = accesses[0]!;
      return next();
    } catch {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo validar acceso al recurso' } });
    }
  };
}
