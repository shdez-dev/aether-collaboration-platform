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
 * Permisos: Miembro del workspace
 */
router.post('/workspaces/:workspaceId/boards', checkWorkspaceMembership, (req, res) =>
  boardController.create(req, res)
);

/**
 * GET /api/workspaces/:workspaceId/boards
 * Listar todos los boards de un workspace
 * Permisos: Miembro del workspace
 */
router.get('/workspaces/:workspaceId/boards', checkWorkspaceMembership, (req, res) =>
  boardController.list(req, res)
);

/**
 * GET /api/boards/:id
 * Obtener un board específico con todas sus listas y cards
 * Permisos: Miembro del workspace del board
 */
router.get('/boards/:id', (req, res) => boardController.getById(req, res));

/**
 * PUT /api/boards/:id
 * Actualizar un board
 * Permisos: Miembro del workspace del board
 */
router.put('/boards/:id', (req, res) => boardController.update(req, res));

/**
 * POST /api/boards/:id/archive
 * Archivar un board
 * Permisos: Miembro del workspace del board
 */
router.post('/boards/:id/archive', (req, res) => boardController.archive(req, res));

/**
 * DELETE /api/boards/:id
 * Eliminar un board permanentemente
 * Permisos: Miembro del workspace del board
 * Requisitos: Board debe estar archivado y no tener listas
 */
router.delete('/boards/:id', (req, res) => boardController.delete(req, res));

// ==================== LIST ROUTES ====================

/**
 * POST /api/boards/:boardId/lists
 * Crear una lista en un board
 * Permisos: Miembro del workspace del board
 */
router.post('/boards/:boardId/lists', (req, res) => listController.create(req, res));

/**
 * GET /api/boards/:boardId/lists
 * Listar todas las listas de un board
 * Permisos: Miembro del workspace del board
 */
router.get('/boards/:boardId/lists', (req, res) => listController.list(req, res));

/**
 * PUT /api/lists/:id
 * Actualizar una lista
 * Permisos: Miembro del workspace del board
 */
router.put('/lists/:id', (req, res) => listController.update(req, res));

/**
 * PUT /api/lists/:id/reorder
 * Reordenar una lista (cambiar su posición)
 * Permisos: Miembro del workspace del board
 */
router.put('/lists/:id/reorder', (req, res) => listController.reorder(req, res));

/**
 * DELETE /api/lists/:id
 * Eliminar una lista
 * Permisos: Miembro del workspace del board
 * Requisitos: Lista no debe tener cards
 */
router.delete('/lists/:id', (req, res) => listController.delete(req, res));

export default router;
