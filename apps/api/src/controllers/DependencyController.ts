// apps/api/src/controllers/DependencyController.ts

import { Request, Response } from 'express';
import { DependencyService } from '../services/DependencyService';
import { z } from 'zod';
import { WorkspaceRequest } from '../middleware/workspace';

const addDepSchema = z.object({
  blockingCardId: z.string().uuid(),
});

function getSocketId(req: Request): string | undefined {
  return req.headers['x-socket-id'] as string | undefined;
}

export class DependencyController {
  /**
   * GET /api/cards/:id/dependencies
   * Devuelve { blockedBy, blocking } para la card.
   * PERMITE: Todos los roles.
   */
  static async getDependencies(req: Request, res: Response) {
    try {
      const { id: cardId } = req.params;
      const data = await DependencyService.getDependencies(cardId);
      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * POST /api/cards/:id/dependencies
   * Body: { blockingCardId }  → "blockingCardId" bloquea a ":id"
   * REQUIERE: ADMIN, OWNER o MEMBER
   */
  static async addDependency(req: WorkspaceRequest, res: Response) {
    try {
      const { id: blockedCardId } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
      if (userRole === 'VIEWER') {
        return res
          .status(403)
          .json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: 'Los VIEWER no pueden añadir dependencias',
            },
          });
      }

      const validation = addDepSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({
            success: false,
            error: { code: 'VALIDATION_ERROR', details: validation.error.errors },
          });
      }

      const { blockingCardId } = validation.data;

      const dep = await DependencyService.addDependency(
        blockingCardId,
        blockedCardId,
        userId,
        socketId
      );
      return res.status(201).json({ success: true, data: { dependency: dep } });
    } catch (error: any) {
      if (error.message === 'Circular dependency detected') {
        return res
          .status(409)
          .json({ success: false, error: { code: 'CIRCULAR_DEPENDENCY', message: error.message } });
      }
      if (error.message.includes('unique_dep') || error.message.includes('duplicate')) {
        return res
          .status(409)
          .json({
            success: false,
            error: { code: 'ALREADY_EXISTS', message: 'Dependency already exists' },
          });
      }
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * DELETE /api/cards/:id/dependencies/:depId
   * REQUIERE: ADMIN, OWNER o MEMBER
   */
  static async removeDependency(req: WorkspaceRequest, res: Response) {
    try {
      const { id: cardId, depId } = req.params;
      const userId = req.user?.id;
      const userRole = req.workspace?.role;
      const socketId = getSocketId(req);

      if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
      if (userRole === 'VIEWER') {
        return res
          .status(403)
          .json({ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } });
      }

      await DependencyService.removeDependency(depId, cardId, userId, socketId);
      return res.status(200).json({ success: true, data: { message: 'Dependency removed' } });
    } catch (error: any) {
      if (error.message === 'Dependency not found') {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
      }
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }

  /**
   * GET /api/cards/:id/dependencies/search?q=texto
   * Busca cards del mismo board para agregar como dependencia.
   * PERMITE: Todos los roles.
   */
  static async searchCards(req: Request, res: Response) {
    try {
      const { id: cardId } = req.params;
      const query = (req.query.q as string) || '';

      const boardId = await DependencyService.getBoardIdFromCard(cardId);
      if (!boardId) {
        return res.status(404).json({ success: false, error: { code: 'CARD_NOT_FOUND' } });
      }

      const cards = await DependencyService.searchCards(cardId, boardId, query);
      return res.status(200).json({ success: true, data: { cards } });
    } catch (error: any) {
      return res
        .status(500)
        .json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }
}
