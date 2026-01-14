// apps/api/src/controllers/ListController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { listService } from '../services/ListService';
import { WorkspaceRequest } from '../middleware/workspace';

/**
 * Schemas de validación con Zod
 */
const createListSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(255),
});

const updateListSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

const reorderListSchema = z.object({
  position: z.number().int().min(1, 'La posición debe ser mayor a 0'),
});

class ListController {
  /**
   * POST /api/boards/:boardId/lists
   * Crear una nueva lista en un board
   * REQUIERE: ADMIN o OWNER
   */
  async create(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { boardId } = req.params;
      const userRole = req.workspace?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticación requerida',
          },
        });
      }

      // ✅ VERIFICAR PERMISOS: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden crear listas',
          },
        });
      }

      // Validar datos
      const validation = createListSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: validation.error.errors,
          },
        });
      }

      // Crear lista
      const list = await listService.createList(boardId, userId, validation.data);

      return res.status(201).json({
        success: true,
        data: { list },
      });
    } catch (error) {
      console.error('[ListController] Create error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al crear lista',
        },
      });
    }
  }

  /**
   * GET /api/boards/:boardId/lists
   * Obtener todas las listas de un board
   * PERMITE: Todos los roles (VIEWER, MEMBER, ADMIN, OWNER)
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { boardId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticación requerida',
          },
        });
      }

      const lists = await listService.getBoardLists(boardId);

      return res.json({
        success: true,
        data: { lists },
      });
    } catch (error) {
      console.error('[ListController] List error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al obtener listas',
        },
      });
    }
  }

  /**
   * PUT /api/lists/:id
   * Actualizar una lista
   * REQUIERE: ADMIN o OWNER
   */
  async update(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const userRole = req.workspace?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticación requerida',
          },
        });
      }

      // Verificar acceso
      const hasAccess = await listService.checkListAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'No tienes acceso a esta lista',
          },
        });
      }

      // ✅ VERIFICAR PERMISOS: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden editar listas',
          },
        });
      }

      // Validar datos
      const validation = updateListSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: validation.error.errors,
          },
        });
      }

      const list = await listService.updateList(id, userId, validation.data);

      return res.json({
        success: true,
        data: { list },
      });
    } catch (error) {
      console.error('[ListController] Update error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al actualizar lista',
        },
      });
    }
  }

  /**
   * PUT /api/lists/:id/reorder
   * Reordenar una lista (cambiar su posición)
   * REQUIERE: ADMIN o OWNER
   */
  async reorder(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const userRole = req.workspace?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticación requerida',
          },
        });
      }

      // Verificar acceso
      const hasAccess = await listService.checkListAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'No tienes acceso a esta lista',
          },
        });
      }

      // ✅ VERIFICAR PERMISOS: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden reordenar listas',
          },
        });
      }

      // Validar datos
      const validation = reorderListSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: validation.error.errors,
          },
        });
      }

      await listService.reorderList(id, userId, validation.data.position);

      return res.json({
        success: true,
        data: { message: 'Lista reordenada exitosamente' },
      });
    } catch (error) {
      console.error('[ListController] Reorder error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al reordenar lista',
        },
      });
    }
  }

  /**
   * DELETE /api/lists/:id
   * Eliminar una lista
   * REQUIERE: ADMIN o OWNER
   */
  async delete(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const userRole = req.workspace?.role;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticación requerida',
          },
        });
      }

      // Verificar acceso
      const hasAccess = await listService.checkListAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'No tienes acceso a esta lista',
          },
        });
      }

      // ✅ VERIFICAR PERMISOS: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden eliminar listas',
          },
        });
      }

      await listService.deleteList(id, userId);

      return res.json({
        success: true,
        data: { message: 'Lista eliminada exitosamente' },
      });
    } catch (error: any) {
      console.error('[ListController] Delete error:', error);

      if (error.message === 'Cannot delete list with cards. Move or delete cards first.') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LIST_HAS_CARDS',
            message: 'No se puede eliminar una lista con cards. Mueve o elimina las cards primero.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al eliminar lista',
        },
      });
    }
  }
}

export const listController = new ListController();
