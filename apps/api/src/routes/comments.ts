// apps/api/src/routes/comments.ts

import { Router } from 'express';
import { CommentController } from '../controllers/CommentController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * ==================== RUTAS DE COMMENTS ====================
 *
 * Todas las rutas requieren autenticación JWT
 * El orden de las rutas es importante para evitar conflictos de patrón
 */

// ==================== RUTAS POR CARD ====================

/**
 * IMPORTANTE: Esta ruta debe ir ANTES de POST /cards/:cardId/comments
 * para evitar conflictos de patrón
 */
// Obtener contador de comentarios de una card
router.get('/cards/:cardId/comments/count', authenticateJWT, CommentController.getCommentCount);

// Obtener todos los comentarios de una card
router.get('/cards/:cardId/comments', authenticateJWT, CommentController.getCommentsByCard);

// Crear comentario en una card
router.post('/cards/:cardId/comments', authenticateJWT, CommentController.createComment);

// ==================== RUTAS POR BOARD ====================

// Obtener comentarios recientes de un board
router.get(
  '/boards/:boardId/comments/recent',
  authenticateJWT,
  CommentController.getRecentComments
);

// ==================== RUTAS POR COMENTARIO ====================

// Obtener comentario por ID
router.get('/comments/:commentId', authenticateJWT, CommentController.getCommentById);

// Actualizar comentario (solo autor)
router.patch('/comments/:commentId', authenticateJWT, CommentController.updateComment);

// Eliminar comentario (solo autor)
router.delete('/comments/:commentId', authenticateJWT, CommentController.deleteComment);

export default router;
