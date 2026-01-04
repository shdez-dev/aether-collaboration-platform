// apps/api/src/middleware/workspace.ts

import { Request, Response, NextFunction } from 'express';
import { workspaceService } from '../services/WorkspaceService';
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
 * Middleware: Verificar que el usuario es miembro del workspace
 * Adjunta información del workspace al request
 */
export async function checkWorkspaceMembership(
  req: WorkspaceRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const workspaceId = req.params.workspaceId || req.params.id;
    const userId = req.user?.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_WORKSPACE_ID',
          message: 'Workspace ID is required',
        },
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
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
