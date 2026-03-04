// apps/api/src/controllers/ChecklistController.ts

import { Request, Response } from 'express';
import { ChecklistService } from '../services/ChecklistService';
import { z } from 'zod';
import { WorkspaceRequest } from '../middleware/workspace';

// ── Schemas ──────────────────────────────────────────────────────────────────

const createItemSchema = z.object({
  title: z.string().min(1).max(500),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
});

// ── Helper ───────────────────────────────────────────────────────────────────

function getSocketId(req: Request): string | undefined {
  return req.headers['x-socket-id'] as string | undefined;
}

// ── Controller ───────────────────────────────────────────────────────────────

export class ChecklistController {
  /**
   * GET /api/cards/:id/checklist
   * Obtener todos los ítems del checklist de una card
   * PERMITE: Todos los roles
   */
  static async getItems(req: Request, res: Response) {
    try {
      const { id: cardId } = req.params;
      const items = await ChecklistService.getItems(cardId);
      return res.status(200).json({ success: true, data: { items } });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * POST /api/cards/:id/checklist
   * Crear un ítem en el checklist
   * REQUIERE: ADMIN, OWNER o MEMBER
   */
  static async createItem(req: WorkspaceRequest, res: Response) {
    try {
      const { id: cardId } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      if (userRole === 'VIEWER') {
        return res.status(403).json({
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Los VIEWER no pueden crear ítems' },
        });
      }

      const validation = createItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validation.error.errors,
          },
        });
      }

      const item = await ChecklistService.createItem(
        cardId,
        userId,
        validation.data.title,
        socketId
      );
      return res.status(201).json({ success: true, data: { item } });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * PUT /api/cards/:cardId/checklist/:itemId
   * Actualizar título o estado de un ítem
   * REQUIERE: ADMIN, OWNER o MEMBER
   */
  static async updateItem(req: WorkspaceRequest, res: Response) {
    try {
      const { id: cardId, itemId } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      if (userRole === 'VIEWER') {
        return res.status(403).json({
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Los VIEWER no pueden editar ítems' },
        });
      }

      const validation = updateItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: validation.error.errors,
          },
        });
      }

      const item = await ChecklistService.updateItem(
        itemId,
        cardId,
        userId,
        validation.data,
        socketId
      );
      return res.status(200).json({ success: true, data: { item } });
    } catch (error: any) {
      if (error.message === 'Checklist item not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * DELETE /api/cards/:cardId/checklist/:itemId
   * Eliminar un ítem del checklist
   * REQUIERE: ADMIN o OWNER
   */
  static async deleteItem(req: WorkspaceRequest, res: Response) {
    try {
      const { id: cardId, itemId } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
        });
      }

      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden eliminar ítems',
          },
        });
      }

      await ChecklistService.deleteItem(itemId, cardId, userId, socketId);
      return res.status(200).json({ success: true, data: { message: 'Item deleted' } });
    } catch (error: any) {
      if (error.message === 'Checklist item not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
      }
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }
}
