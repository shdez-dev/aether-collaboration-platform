// apps/api/src/controllers/BoardController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { boardService } from '../services/BoardService';
import { DependencyGraphService } from '../services/DependencyGraphService';
import { WorkspaceRequest } from '../middleware/workspace';
import { pool } from '../lib/db';

/**
 * Schemas de validación con Zod
 */
const createBoardSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(255),
  description: z.string().max(1000).optional(),
  color: z.string().max(50).optional(),
  projectId: z.string().uuid().optional(),
});

const updateBoardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  color: z.string().max(50).optional(),
});

class BoardController {
  /**
   * POST /api/workspaces/:workspaceId/boards
   * Crear un nuevo board en un workspace
   * REQUIERE: ADMIN o OWNER
   */
  async create(req: WorkspaceRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { workspaceId } = req.params;
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
            message: 'Solo ADMIN o OWNER pueden crear boards',
          },
        });
      }

      // Validar datos
      const validation = createBoardSchema.safeParse(req.body);
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

      const { projectId, ...boardData } = validation.data;

      // Crear board
      const board = await boardService.createBoard(workspaceId, userId, boardData);

      // Si se pasó projectId, asociar el board al proyecto
      if (projectId) {
        await pool.query(
          `INSERT INTO project_boards (id, project_id, board_id)
           VALUES (gen_random_uuid(), $1, $2)
           ON CONFLICT DO NOTHING`,
          [projectId, board.id]
        );
      }

      return res.status(201).json({
        success: true,
        data: { board },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al crear board',
        },
      });
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/boards
   * Obtener todos los boards de un workspace
   * PERMITE: Todos los roles (VIEWER, MEMBER, ADMIN, OWNER)
   */
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { workspaceId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticación requerida',
          },
        });
      }

      const boards = await boardService.getWorkspaceBoards(workspaceId);

      return res.json({
        success: true,
        data: { boards },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al obtener boards',
        },
      });
    }
  }

  /**
   * GET /api/boards/:id
   * Obtener un board específico con todas sus listas y cards
   * PERMITE: Todos los roles (VIEWER, MEMBER, ADMIN, OWNER)
   */
  async getById(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

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
      const hasAccess = await boardService.checkBoardAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'No tienes acceso a este board',
          },
        });
      }

      const board = await boardService.getBoardById(id);

      if (!board) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'BOARD_NOT_FOUND',
            message: 'Board no encontrado',
          },
        });
      }

      return res.json({
        success: true,
        data: { board },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al obtener board',
        },
      });
    }
  }

  /**
   * PUT /api/boards/:id
   * Actualizar un board
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

      // Verificar acceso al board
      const hasAccess = await boardService.checkBoardAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'No tienes acceso a este board',
          },
        });
      }

      // ✅ VERIFICAR PERMISOS: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden editar boards',
          },
        });
      }

      // Validar datos
      const validation = updateBoardSchema.safeParse(req.body);
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

      const board = await boardService.updateBoard(id, userId, validation.data);

      return res.json({
        success: true,
        data: { board },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al actualizar board',
        },
      });
    }
  }

  /**
   * POST /api/boards/:id/archive
   * Archivar un board
   * REQUIERE: ADMIN o OWNER
   */
  async archive(req: WorkspaceRequest, res: Response) {
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
      const hasAccess = await boardService.checkBoardAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'No tienes acceso a este board',
          },
        });
      }

      // ✅ VERIFICAR PERMISOS: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden archivar boards',
          },
        });
      }

      await boardService.archiveBoard(id, userId);

      return res.json({
        success: true,
        data: { message: 'Board archivado exitosamente' },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al archivar board',
        },
      });
    }
  }

  /**
   * DELETE /api/boards/:id
   * Eliminar un board permanentemente
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
      const hasAccess = await boardService.checkBoardAccess(id, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'No tienes acceso a este board',
          },
        });
      }

      // ✅ VERIFICAR PERMISOS: Solo ADMIN o OWNER
      if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Solo ADMIN o OWNER pueden eliminar boards',
          },
        });
      }

      await boardService.deleteBoard(id, userId);

      return res.json({
        success: true,
        data: { message: 'Board eliminado exitosamente' },
      });
    } catch (error: any) {
      if (error.message === 'Board must be archived before deleting') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BOARD_NOT_ARCHIVED',
            message: 'El board debe estar archivado antes de eliminarlo',
          },
        });
      }

      if (error.message === 'Cannot delete board with lists. Delete lists first.') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BOARD_HAS_LISTS',
            message: 'No se puede eliminar un board con listas. Elimina las listas primero.',
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al eliminar board',
        },
      });
    }
  }
  /**
   * GET /api/boards/:id/dependency-graph
   * Obtener el grafo de dependencias de un board (nodos + aristas)
   * Permite: Todos los roles
   */
  async getDependencyGraph(req: WorkspaceRequest, res: Response) {
    try {
      const { id } = req.params;
      const graph = await DependencyGraphService.getGraph(id);
      return res.json({ success: true, data: { graph } });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/workspaces/:workspaceId/boards/orphaned
   * Boards del workspace que no pertenecen a ningún proyecto
   */
  async listOrphaned(req: WorkspaceRequest, res: Response) {
    try {
      const { workspaceId } = req.params;
      const result = await pool.query(
        `SELECT b.*,
           COUNT(DISTINCT c.id)::int AS card_count,
           COUNT(DISTINCT l.id)::int AS list_count
         FROM boards b
         LEFT JOIN lists l ON l.board_id = b.id
         LEFT JOIN cards c ON c.list_id = l.id
         WHERE b.workspace_id = $1
           AND b.archived = false
           AND NOT EXISTS (
             SELECT 1 FROM project_boards pb WHERE pb.board_id = b.id
           )
         GROUP BY b.id
         ORDER BY b.updated_at DESC`,
        [workspaceId]
      );
      const boards = result.rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        name: r.name,
        description: r.description,
        color: r.color,
        position: r.position,
        archived: r.archived,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        cardCount: r.card_count,
        listCount: r.list_count,
      }));
      return res.json({ success: true, data: { boards } });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }
}

export const boardController = new BoardController();
