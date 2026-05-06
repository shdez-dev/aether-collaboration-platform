// apps/api/src/controllers/CardController.ts
// ✅ VERSIÓN CORREGIDA CON PERMISOS PARA MEMBER

import { Request, Response } from 'express';
import { CardService } from '../services/CardService';
import { z } from 'zod';
import { WorkspaceRequest } from '../middleware/workspace';
import { query } from '../lib/db';

// ==================== SCHEMAS DE VALIDACIÓN ====================

const createCardSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

const updateCardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional().or(z.null()),
  startDate: z.string().datetime().optional().or(z.null()),
  dueDate: z.string().datetime().optional().or(z.null()),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().or(z.null()),
  completed: z.boolean().optional(),
  completedAt: z.string().datetime().optional().or(z.null()),
  listId: z.string().uuid().optional(),
});

const moveCardSchema = z.object({
  toListId: z.string().uuid(),
  position: z.number().int().min(1),
});

const memberSchema = z.object({
  userId: z.string().uuid(),
});

const labelSchema = z.object({
  labelId: z.string().uuid(),
});

// ==================== HELPERS ====================

function getSocketId(req: Request): string | undefined {
  return req.headers['x-socket-id'] as string | undefined;
}

// ==================== CONTROLLER ====================

export class CardController {
  /**
   * GET /api/lists/:listId/cards
   * Obtener todas las cards de una lista ordenadas por posición
   * PERMITE: Todos los roles (VIEWER, MEMBER, ADMIN, OWNER)
   */
  static async getListCards(req: Request, res: Response) {
    try {
      const { listId } = req.params;

      const cards = await CardService.getCardsByListId(listId);

      return res.status(200).json({
        success: true,
        data: { cards },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * POST /api/lists/:listId/cards
   * Crear una card en una lista
   * REQUIERE: ADMIN o OWNER
   */
  static async createCard(req: WorkspaceRequest, res: Response) {
    try {
      const { listId } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      // Verificar permisos: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden crear cards',
          },
        });
      }

      const validationResult = createCardSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        });
      }

      const card = await CardService.createCard(listId, userId, validationResult.data, socketId);

      return res.status(201).json({
        success: true,
        data: { card },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/cards/:id
   * Obtener una card por ID con relaciones (members, labels)
   * PERMITE: Todos los roles (VIEWER, MEMBER, ADMIN, OWNER)
   */
  static async getCard(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const card = await CardService.getCardById(id);

      if (!card) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Card not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: { card },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * PUT /api/cards/:id
   * Actualizar una card (incluyendo moverla entre listas)
   * REQUIERE: ADMIN o OWNER
   */
  static async updateCard(req: WorkspaceRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      // Verificar permisos
      const isMember = userRole === 'MEMBER';
      const isPrivileged = userRole === 'ADMIN' || userRole === 'OWNER';

      if (!isPrivileged && !isMember) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Sin permisos para editar cards',
          },
        });
      }

      const validationResult = updateCardSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        });
      }

      // MEMBER solo puede actualizar el estado de completado, no otros campos
      if (isMember) {
        const allowedMemberKeys = new Set(['completed', 'completedAt']);
        const bodyKeys = Object.keys(req.body);
        const hasDisallowedKeys = bodyKeys.some((k) => !allowedMemberKeys.has(k));
        if (hasDisallowedKeys) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'MEMBER solo puede marcar cards como completadas',
            },
          });
        }

        // Cards asignadas solo pueden marcarlas sus asignados; sin asignados cualquiera puede.
        const cardRow = await query(
          `SELECT cm.user_id
           FROM cards c
           LEFT JOIN card_members cm ON cm.card_id = c.id
           WHERE c.id = $1`,
          [id]
        );
        const assigneeIds: (string | null)[] = cardRow.rows.map((r: any) => r.user_id);
        const hasAssignees = assigneeIds.some((uid) => uid !== null);
        if (hasAssignees && !assigneeIds.includes(userId)) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'Solo puedes marcar como completada una card que te esté asignada',
            },
          });
        }
      }

      const card = await CardService.updateCard(id, userId, validationResult.data, socketId);

      return res.status(200).json({
        success: true,
        data: { card },
      });
    } catch (error: any) {
      if (error.code === 'BLOCKED_BY_DEPENDENCY') {
        return res.status(422).json({
          success: false,
          error: {
            code: 'BLOCKED_BY_DEPENDENCY',
            message: error.message,
            pendingBlockers: error.pendingBlockers,
          },
        });
      }

      if (error.message === 'Target list not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'LIST_NOT_FOUND', message: error.message },
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * PUT /api/cards/:id/move
   * Mover una card con control preciso de posición
   * ✅ PERMITE: OWNER, ADMIN y MEMBER (cambio principal)
   */
  static async moveCard(req: WorkspaceRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      // ✅ CAMBIO CRÍTICO: MEMBER también puede mover cards
      if (userRole !== 'ADMIN' && userRole !== 'OWNER' && userRole !== 'MEMBER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN, OWNER o MEMBER pueden mover cards',
          },
        });
      }

      const validationResult = moveCardSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        });
      }

      const card = await CardService.moveCard(id, userId, validationResult.data, socketId);

      return res.status(200).json({
        success: true,
        data: { card },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * DELETE /api/cards/:id
   * Eliminar una card
   * REQUIERE: ADMIN o OWNER
   */
  static async deleteCard(req: WorkspaceRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      // Verificar permisos: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden eliminar cards',
          },
        });
      }

      await CardService.deleteCard(id, userId, socketId);

      return res.status(200).json({
        success: true,
        data: { message: 'Card deleted successfully' },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * POST /api/cards/:id/members
   * Asignar un miembro a una card
   * REQUIERE: ADMIN o OWNER
   */
  static async assignMember(req: WorkspaceRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      // Verificar permisos: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden asignar miembros',
          },
        });
      }

      const validationResult = memberSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        });
      }

      await CardService.assignMember(id, validationResult.data.userId, userId, socketId);

      return res.status(200).json({
        success: true,
        data: { message: 'Member assigned successfully' },
      });
    } catch (error: any) {
      if (error.message === 'Member already assigned') {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_ASSIGNED', message: error.message },
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * DELETE /api/cards/:id/members/:userId
   * Desasignar un miembro de una card
   * REQUIERE: ADMIN o OWNER
   */
  static async unassignMember(req: WorkspaceRequest, res: Response) {
    try {
      const { id, userId: memberId } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      // Verificar permisos: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden desasignar miembros',
          },
        });
      }

      await CardService.unassignMember(id, memberId, userId, socketId);

      return res.status(200).json({
        success: true,
        data: { message: 'Member unassigned successfully' },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * POST /api/cards/:id/labels
   * Agregar un label a una card
   * PERMITE: Todos los roles (VIEWER, MEMBER, ADMIN, OWNER)
   */
  static async addLabel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      const validationResult = labelSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validationResult.error.errors,
          },
        });
      }

      await CardService.addLabel(id, validationResult.data.labelId, userId, socketId);

      return res.status(200).json({
        success: true,
        data: { message: 'Label added successfully' },
      });
    } catch (error: any) {
      if (error.message === 'Label already added') {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_ADDED', message: error.message },
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * DELETE /api/cards/:id/labels/:labelId
   * Remover un label de una card
   * PERMITE: Todos los roles (VIEWER, MEMBER, ADMIN, OWNER)
   */
  static async removeLabel(req: Request, res: Response) {
    try {
      const { id, labelId } = req.params;
      const userId = req.user?.id;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      await CardService.removeLabel(id, labelId, userId, socketId);

      return res.status(200).json({
        success: true,
        data: { message: 'Label removed successfully' },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }
}
