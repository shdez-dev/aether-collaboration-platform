// apps/api/src/routes/board.ts

import { Router } from 'express';
import { boardController } from '../controllers/BoardController';
import { listController } from '../controllers/ListController';
import { authenticateJWT } from '../middleware/auth';
import { checkWorkspaceMembership } from '../middleware/workspace';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

// ==================== BOARD ROUTES ====================

/**
 * POST /api/workspaces/:workspaceId/boards
 * Crear un board en un workspace
 * Middleware: checkWorkspaceMembership (valida membership)
 * Controller: Valida rol ADMIN/OWNER
 */
router.post('/workspaces/:workspaceId/boards', checkWorkspaceMembership, (req, res) =>
  boardController.create(req, res)
);

/**
 * GET /api/workspaces/:workspaceId/boards
 * Listar todos los boards de un workspace
 * Middleware: checkWorkspaceMembership (valida membership)
 * Permite: Todos los roles
 */
router.get('/workspaces/:workspaceId/boards', checkWorkspaceMembership, (req, res) =>
  boardController.list(req, res)
);

/**
 * GET /api/boards/:id
 * Obtener un board específico con todas sus listas y cards
 * Middleware: checkWorkspaceMembership (resuelve workspace desde boardId)
 * Permite: Todos los roles
 */
router.get('/boards/:id', checkWorkspaceMembership, (req, res) =>
  boardController.getById(req, res)
);

/**
 * PUT /api/boards/:id
 * Actualizar un board
 * Middleware: checkWorkspaceMembership (resuelve workspace desde boardId)
 * Controller: Valida rol ADMIN/OWNER
 */
router.put('/boards/:id', checkWorkspaceMembership, (req, res) => boardController.update(req, res));

/**
 * POST /api/boards/:id/archive
 * Archivar un board
 * Middleware: checkWorkspaceMembership (resuelve workspace desde boardId)
 * Controller: Valida rol ADMIN/OWNER
 */
router.post('/boards/:id/archive', checkWorkspaceMembership, (req, res) =>
  boardController.archive(req, res)
);

/**
 * DELETE /api/boards/:id
 * Eliminar un board permanentemente
 * Middleware: checkWorkspaceMembership (resuelve workspace desde boardId)
 * Controller: Valida rol ADMIN/OWNER
 * Requisitos: Board debe estar archivado y no tener listas
 */
router.delete('/boards/:id', checkWorkspaceMembership, (req, res) =>
  boardController.delete(req, res)
);

// ==================== LIST ROUTES ====================

/**
 * POST /api/boards/:boardId/lists
 * Crear una lista en un board
 * Middleware: checkWorkspaceMembership (resuelve workspace desde boardId)
 * Controller: Valida rol ADMIN/OWNER
 */
router.post('/boards/:boardId/lists', checkWorkspaceMembership, (req, res) =>
  listController.create(req, res)
);

/**
 * GET /api/boards/:boardId/lists
 * Listar todas las listas de un board
 * Middleware: checkWorkspaceMembership (resuelve workspace desde boardId)
 * Permite: Todos los roles
 */
router.get('/boards/:boardId/lists', checkWorkspaceMembership, (req, res) =>
  listController.list(req, res)
);

/**
 * PUT /api/lists/:id
 * Actualizar una lista
 * Middleware: checkWorkspaceMembership (resuelve workspace desde listId)
 * Controller: Valida rol ADMIN/OWNER
 */
router.put('/lists/:id', checkWorkspaceMembership, (req, res) => listController.update(req, res));

/**
 * PUT /api/lists/:id/reorder
 * Reordenar una lista (cambiar su posición)
 * Middleware: checkWorkspaceMembership (resuelve workspace desde listId)
 * Controller: Valida rol ADMIN/OWNER
 */
router.put('/lists/:id/reorder', checkWorkspaceMembership, (req, res) =>
  listController.reorder(req, res)
);

/**
 * DELETE /api/lists/:id
 * Eliminar una lista
 * Middleware: checkWorkspaceMembership (resuelve workspace desde listId)
 * Controller: Valida rol ADMIN/OWNER
 * Requisitos: Lista no debe tener cards
 */
router.delete('/lists/:id', checkWorkspaceMembership, (req, res) =>
  listController.delete(req, res)
);

export default router;
