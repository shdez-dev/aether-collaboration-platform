// apps/api/src/controllers/WorkspaceController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { workspaceService } from '../services/WorkspaceService';
import type { WorkspaceRequest } from '../middleware/workspace';
import type { WorkspaceRole } from '@aether/types';

/**
 * Schemas de validación con Zod
 */
const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  icon: z.string().max(500).optional(),
  color: z.string().max(50).optional(),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  icon: z.string().max(500).optional(),
  color: z.string().max(50).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

const changeMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

class WorkspaceController {
  /**
   * POST /api/workspaces
   * Crear un nuevo workspace
   */
  async create(req: Request, res: Response) {
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

      // Validar datos
      const validation = createWorkspaceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid workspace data',
            details: validation.error.errors,
          },
        });
      }

      // Crear workspace
      const workspace = await workspaceService.createWorkspace(userId, validation.data);

      return res.status(201).json({
        success: true,
        data: { workspace },
      });
    } catch (error) {
      console.error('[WorkspaceController] Create error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create workspace',
        },
      });
    }
  }

  /**
   * GET /api/workspaces
   * Obtener todos los workspaces del usuario
   */
  async list(req: Request, res: Response) {
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

      const workspaces = await workspaceService.getUserWorkspaces(userId);

      return res.json({
        success: true,
        data: { workspaces },
      });
    } catch (error) {
      console.error('[WorkspaceController] List error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch workspaces',
        },
      });
    }
  }

  /**
   * GET /api/workspaces/:id
   * Obtener un workspace específico
   */
  async getById(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const workspace = await workspaceService.getWorkspaceById(workspaceId, userId);

      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'WORKSPACE_NOT_FOUND',
            message: 'Workspace not found or access denied',
          },
        });
      }

      // 🔍 DEBUG: Ver qué está devolviendo el servicio
      console.log('=== WORKSPACE CONTROLLER DEBUG ===');
      console.log('Workspace ID:', workspaceId);
      console.log('User ID:', userId);
      console.log('Workspace object:', workspace);
      console.log('userRole:', workspace.userRole);
      console.log('==================================');

      return res.json({
        success: true,
        data: { workspace },
      });
    } catch (error) {
      console.error('[WorkspaceController] GetById error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch workspace',
        },
      });
    }
  }

  /**
   * PUT /api/workspaces/:id
   * Actualizar un workspace (requiere ADMIN o OWNER)
   */
  async update(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // 🔍 DEBUG: Ver middleware workspace
      console.log('=== UPDATE WORKSPACE DEBUG ===');
      console.log('User ID:', userId);
      console.log('Workspace ID:', workspaceId);
      console.log('req.workspace:', req.workspace);
      console.log('==============================');

      // Validar datos
      const validation = updateWorkspaceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update data',
            details: validation.error.errors,
          },
        });
      }

      // Actualizar workspace
      const workspace = await workspaceService.updateWorkspace(
        workspaceId,
        userId,
        validation.data
      );

      return res.json({
        success: true,
        data: { workspace },
      });
    } catch (error) {
      console.error('[WorkspaceController] Update error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update workspace',
        },
      });
    }
  }

  /**
   * DELETE /api/workspaces/:id
   * Eliminar un workspace (solo OWNER)
   */
  async delete(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      await workspaceService.deleteWorkspace(workspaceId, userId);

      return res.json({
        success: true,
        data: { message: 'Workspace deleted successfully' },
      });
    } catch (error: any) {
      console.error('[WorkspaceController] Delete error:', error);

      if (error.message === 'Only workspace owner can delete workspace') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: error.message,
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete workspace',
        },
      });
    }
  }

  /**
   * POST /api/workspaces/:id/invite
   * Invitar un miembro al workspace (requiere ADMIN o OWNER)
   */
  async inviteMember(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Validar datos
      const validation = inviteMemberSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid invitation data',
            details: validation.error.errors,
          },
        });
      }

      await workspaceService.inviteMember(
        workspaceId,
        userId,
        validation.data.email,
        validation.data.role as WorkspaceRole
      );

      return res.status(201).json({
        success: true,
        data: { message: 'Member invited successfully' },
      });
    } catch (error: any) {
      console.error('[WorkspaceController] InviteMember error:', error);

      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User with this email does not exist',
          },
        });
      }

      if (error.message === 'User is already a member') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ALREADY_MEMBER',
            message: 'User is already a member of this workspace',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to invite member',
        },
      });
    }
  }

  /**
   * GET /api/workspaces/:id/members
   * Obtener miembros del workspace
   */
  async getMembers(req: WorkspaceRequest, res: Response) {
    try {
      const workspaceId = req.params.id;

      const members = await workspaceService.getMembers(workspaceId);

      return res.json({
        success: true,
        data: { members },
      });
    } catch (error) {
      console.error('[WorkspaceController] GetMembers error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch members',
        },
      });
    }
  }

  /**
   * PUT /api/workspaces/:id/members/:userId
   * Cambiar rol de un miembro (solo OWNER)
   */
  async changeMemberRole(req: WorkspaceRequest, res: Response) {
    try {
      const changerId = req.user?.id;
      const workspaceId = req.params.id;
      const targetUserId = req.params.userId;

      if (!changerId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // No puede cambiar su propio rol
      if (changerId === targetUserId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: 'You cannot change your own role',
          },
        });
      }

      // Validar datos
      const validation = changeMemberRoleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid role data',
            details: validation.error.errors,
          },
        });
      }

      await workspaceService.changeMemberRole(
        workspaceId,
        targetUserId,
        validation.data.role as WorkspaceRole,
        changerId
      );

      return res.json({
        success: true,
        data: { message: 'Member role updated successfully' },
      });
    } catch (error) {
      console.error('[WorkspaceController] ChangeMemberRole error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change member role',
        },
      });
    }
  }

  /**
   * DELETE /api/workspaces/:id/members/:userId
   * Remover un miembro del workspace (requiere ADMIN o OWNER)
   */
  async removeMember(req: WorkspaceRequest, res: Response) {
    try {
      const removerId = req.user?.id;
      const workspaceId = req.params.id;
      const targetUserId = req.params.userId;

      if (!removerId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Owner no puede removerse a sí mismo
      if (removerId === targetUserId && req.workspace?.role === 'OWNER') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: 'Owner cannot remove themselves',
          },
        });
      }

      await workspaceService.removeMember(workspaceId, targetUserId, removerId);

      return res.json({
        success: true,
        data: { message: 'Member removed successfully' },
      });
    } catch (error) {
      console.error('[WorkspaceController] RemoveMember error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to remove member',
        },
      });
    }
  }
}

export const workspaceController = new WorkspaceController();
