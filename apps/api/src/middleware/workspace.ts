// apps/api/src/middleware/workspace.ts

import { Request, Response, NextFunction } from 'express';
import { workspaceService } from '../services/WorkspaceService';
import { boardService } from '../services/BoardService';
import { listService } from '../services/ListService';
import { CardService } from '../services/CardService';
import type { WorkspaceRole } from '@aether/types';

// Extender el tipo Request de Express para incluir user y workspace
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

/**
 * Request extendido con información de workspace
 */
export interface WorkspaceRequest extends Request {
  workspace?: {
    id: string;
    role: WorkspaceRole;
  };
}

/**
 * Helper: Resolver workspaceId desde diferentes parámetros
 */
async function resolveWorkspaceId(req: Request): Promise<string | null> {
  const fullPath = req.baseUrl + req.path;

  // 1. Directamente desde params.workspaceId (rutas como /workspaces/:workspaceId/boards)
  if (req.params.workspaceId) return req.params.workspaceId;

  // 2. Si la ruta base es /api/workspaces y tiene :id, ese es el workspaceId
  if (req.baseUrl === '/api/workspaces' && req.params.id) {
    return req.params.id;
  }

  // 3. Desde boardId (rutas como /api/boards/:id)
  if (req.baseUrl === '/api' && fullPath.includes('/boards/') && req.params.id) {
    const board = await boardService.getBoardById(req.params.id);
    return board?.workspaceId || null;
  }

  if (req.params.boardId) {
    const board = await boardService.getBoardById(req.params.boardId);
    return board?.workspaceId || null;
  }

  // 4. Desde listId (rutas como /api/lists/:id)
  if (req.baseUrl === '/api' && fullPath.includes('/lists/') && req.params.id) {
    const list = await listService.getListById(req.params.id);
    if (list) {
      const board = await boardService.getBoardById(list.boardId);
      return board?.workspaceId || null;
    }
  }

  if (req.params.listId) {
    const list = await listService.getListById(req.params.listId);
    if (list) {
      const board = await boardService.getBoardById(list.boardId);
      return board?.workspaceId || null;
    }
  }

  // 5. Desde cardId (rutas como /api/cards/:id)
  if (req.baseUrl === '/api' && fullPath.includes('/cards/') && req.params.id) {
    const card = await CardService.getCardById(req.params.id);
    if (card) {
      const list = await listService.getListById(card.listId);
      if (list) {
        const board = await boardService.getBoardById(list.boardId);
        return board?.workspaceId || null;
      }
    }
  }

  if (req.params.cardId) {
    const card = await CardService.getCardById(req.params.cardId);
    if (card) {
      const list = await listService.getListById(card.listId);
      if (list) {
        const board = await boardService.getBoardById(list.boardId);
        return board?.workspaceId || null;
      }
    }
  }

  return null;
}

/**
 * Middleware: Verificar que el usuario es miembro del workspace
 * Adjunta información del workspace al request
 *
 * Puede resolver el workspaceId desde:
 * - workspaceId directo en params
 * - boardId → workspace
 * - listId → board → workspace
 * - cardId → list → board → workspace
 */
export async function checkWorkspaceMembership(
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Resolver workspaceId desde diferentes fuentes
    const workspaceId = await resolveWorkspaceId(req);

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_WORKSPACE_ID',
          message: 'Could not resolve workspace from request',
        },
      });
    }

    // Verificar membership
    const membership = await workspaceService.getMembership(workspaceId, userId);

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_WORKSPACE_MEMBER',
          message: 'You are not a member of this workspace',
        },
      });
    }

    // Adjuntar información al request
    req.workspace = {
      id: workspaceId,
      role: membership.role,
    };

    next();
  } catch (error) {
    console.error('[Workspace Middleware] Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify workspace membership',
      },
    });
  }
}

/**
 * Middleware: Verificar que el usuario tiene un rol mínimo requerido
 * Debe ejecutarse DESPUÉS de checkWorkspaceMembership
 * @param minRole - Rol mínimo requerido (OWNER, ADMIN, MEMBER, VIEWER)
 */
export function requireRole(minRole: WorkspaceRole) {
  // Jerarquía de roles (mayor número = más permisos)
  const roleHierarchy: Record<WorkspaceRole, number> = {
    VIEWER: 1,
    MEMBER: 2,
    ADMIN: 3,
    OWNER: 4,
  };

  return (req: WorkspaceRequest, res: Response, next: NextFunction) => {
    const userRole = req.workspace?.role;

    if (!userRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_VERIFIED',
          message: 'Workspace membership not verified',
        },
      });
    }

    const userRoleLevel = roleHierarchy[userRole];
    const requiredRoleLevel = roleHierarchy[minRole];

    if (userRoleLevel < requiredRoleLevel) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This action requires ${minRole} role or higher`,
        },
      });
    }

    next();
  };
}

/**
 * Middleware: Verificar que el usuario es Owner del workspace
 * Shortcut para requireRole('OWNER')
 */
export const requireOwner = requireRole('OWNER');

/**
 * Middleware: Verificar que el usuario es Admin o Owner
 * Shortcut para requireRole('ADMIN')
 */
export const requireAdmin = requireRole('ADMIN');
