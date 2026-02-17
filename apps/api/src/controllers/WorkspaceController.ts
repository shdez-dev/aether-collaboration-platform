// apps/api/src/controllers/WorkspaceController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { workspaceService } from '../services/WorkspaceService';
import { userActivityService } from '../services/UserActivityService';
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

const duplicateWorkspaceSchema = z.object({
  includeBoards: z.boolean().optional().default(true),
});

const visibilitySchema = z.object({
  visibility: z.enum(['private', 'public']),
});

const createFromTemplateSchema = z.object({
  templateId: z.enum(['development', 'marketing', 'design', 'hr', 'general']),
  name: z.string().min(1).max(255),
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
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const includeArchived = req.query.archived === 'true';
      const workspaces = await workspaceService.getUserWorkspaces(userId, includeArchived);

      return res.json({ success: true, data: { workspaces } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch workspaces' },
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

      return res.json({
        success: true,
        data: { workspace },
      });
    } catch (error) {
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
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to remove member',
        },
      });
    }
  }

  /**
   * GET /api/workspaces/:id/activity
   * Obtener actividad reciente del workspace
   * Permisos: Miembro del workspace (cualquier rol)
   */
  async getWorkspaceActivity(req: WorkspaceRequest, res: Response) {
    try {
      const { id: workspaceId } = req.params;
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

      // El middleware checkWorkspaceMembership ya verificó que el usuario es miembro
      // Obtener actividad del workspace (últimos 7 días por defecto)
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await userActivityService.getWorkspaceActivity(workspaceId, limit);

      // Filtrar solo actividad de los últimos 7 días
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivities = activities.filter((activity) => {
        const activityDate = new Date(activity.created_at);
        return activityDate >= sevenDaysAgo;
      });

      // Formatear actividades para el frontend
      const events = recentActivities.map((activity) => ({
        id: activity.id,
        type: activity.activity_type,
        user: {
          id: activity.user_id,
          name: activity.user_name,
          email: activity.user_email,
          avatar: activity.user_avatar,
        },
        payload: activity.metadata || {},
        boardId: activity.board_id,
        workspaceId: activity.workspace_id,
        timestamp: activity.created_at,
      }));

      return res.json({
        success: true,
        data: {
          activities: events,
          count: events.length,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get workspace activity',
        },
      });
    }
  }
  /**
   * POST /api/workspaces/:id/archive
   * Archivar un workspace (solo OWNER)
   */
  async archive(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      const workspace = await workspaceService.archiveWorkspace(workspaceId, userId);
      return res.json({ success: true, data: { workspace } });
    } catch (error: any) {
      if (error.message?.includes('Only workspace owner')) {
        return res
          .status(403)
          .json({
            success: false,
            error: { code: 'INSUFFICIENT_PERMISSIONS', message: error.message },
          });
      }
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to archive workspace' },
        });
    }
  }

  /**
   * POST /api/workspaces/:id/restore
   * Restaurar un workspace archivado (solo OWNER)
   */
  async restore(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      const workspace = await workspaceService.restoreWorkspace(workspaceId, userId);
      return res.json({ success: true, data: { workspace } });
    } catch (error: any) {
      if (error.message?.includes('Only workspace owner')) {
        return res
          .status(403)
          .json({
            success: false,
            error: { code: 'INSUFFICIENT_PERMISSIONS', message: error.message },
          });
      }
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to restore workspace' },
        });
    }
  }

  /**
   * POST /api/workspaces/:id/duplicate
   * Duplicar un workspace (OWNER o ADMIN)
   */
  async duplicate(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      const validation = duplicateWorkspaceSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid data',
              details: validation.error.errors,
            },
          });
      }

      const workspace = await workspaceService.duplicateWorkspace(
        workspaceId,
        userId,
        validation.data
      );
      return res.status(201).json({ success: true, data: { workspace } });
    } catch (error: any) {
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to duplicate workspace' },
        });
    }
  }

  /**
   * GET /api/workspaces/:id/stats
   * Obtener estadísticas del workspace
   */
  async getStats(req: WorkspaceRequest, res: Response) {
    try {
      const workspaceId = req.params.id;
      const stats = await workspaceService.getWorkspaceStats(workspaceId);
      return res.json({ success: true, data: { stats } });
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch workspace stats' },
        });
    }
  }

  /**
   * PUT /api/workspaces/:id/visibility
   * Cambiar visibilidad del workspace (OWNER o ADMIN)
   */
  async updateVisibility(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      const validation = visibilitySchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Invalid visibility value' },
          });
      }

      const workspace = await workspaceService.updateVisibility(
        workspaceId,
        userId,
        validation.data.visibility
      );
      return res.json({ success: true, data: { workspace } });
    } catch (error: any) {
      if (error.message?.includes('Only workspace owner')) {
        return res
          .status(403)
          .json({
            success: false,
            error: { code: 'INSUFFICIENT_PERMISSIONS', message: error.message },
          });
      }
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to update visibility' },
        });
    }
  }

  /**
   * POST /api/workspaces/:id/invite-token
   * Generar token de invitación público
   */
  async regenerateInviteToken(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      const token = await workspaceService.regenerateInviteToken(workspaceId, userId);
      return res.json({ success: true, data: { token } });
    } catch (error: any) {
      if (error.message?.includes('Only workspace owner')) {
        return res
          .status(403)
          .json({
            success: false,
            error: { code: 'INSUFFICIENT_PERMISSIONS', message: error.message },
          });
      }
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to generate invite token' },
        });
    }
  }

  /**
   * DELETE /api/workspaces/:id/invite-token
   * Revocar token de invitación
   */
  async revokeInviteToken(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const workspaceId = req.params.id;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      await workspaceService.revokeInviteToken(workspaceId, userId);
      return res.json({ success: true, data: { message: 'Invite token revoked' } });
    } catch (error: any) {
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke invite token' },
        });
    }
  }

  /**
   * POST /api/workspaces/join/:token
   * Unirse a un workspace vía link de invitación
   */
  async joinByToken(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { token } = req.params;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      const workspace = await workspaceService.joinByInviteToken(token, userId);
      return res.json({ success: true, data: { workspace } });
    } catch (error: any) {
      if (error.message === 'Invalid or expired invite token') {
        return res
          .status(404)
          .json({ success: false, error: { code: 'INVALID_TOKEN', message: error.message } });
      }
      if (error.message === 'Already a member') {
        return res
          .status(409)
          .json({ success: false, error: { code: 'ALREADY_MEMBER', message: error.message } });
      }
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to join workspace' },
        });
    }
  }

  /**
   * POST /api/workspaces/from-template
   * Crear workspace desde template predefinido
   */
  async createFromTemplate(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId)
        return res
          .status(401)
          .json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          });

      const validation = createFromTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid template data',
              details: validation.error.errors,
            },
          });
      }

      const workspace = await workspaceService.createFromTemplate(
        userId,
        validation.data.templateId,
        validation.data.name
      );
      return res.status(201).json({ success: true, data: { workspace } });
    } catch (error: any) {
      if (error.message === 'Template not found') {
        return res
          .status(404)
          .json({ success: false, error: { code: 'TEMPLATE_NOT_FOUND', message: error.message } });
      }
      return res
        .status(500)
        .json({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to create workspace from template' },
        });
    }
  }
}

export const workspaceController = new WorkspaceController();
