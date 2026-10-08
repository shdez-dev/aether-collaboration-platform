// apps/api/src/routes/comments.ts

import { Router } from 'express';
import { CommentController } from '../controllers/CommentController';
import { authenticateJWT } from '../middleware/auth';
import { requireProjectBoundResourceAccess } from '../middleware/project';

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
router.get('/cards/:cardId/comments/count', authenticateJWT, requireProjectBoundResourceAccess('READ', 'card'), CommentController.getCommentCount);
router.get('/cards/:cardId/mentions', authenticateJWT, requireProjectBoundResourceAccess('READ', 'card'), CommentController.getMentionCandidates);
router.get('/cards/:cardId/document-candidates', authenticateJWT, requireProjectBoundResourceAccess('READ', 'card'), CommentController.getDocumentCandidates);

// Obtener todos los comentarios de una card
router.get('/cards/:cardId/comments', authenticateJWT, requireProjectBoundResourceAccess('READ', 'card'), CommentController.getCommentsByCard);

// Crear comentario en una card
router.post('/cards/:cardId/comments', authenticateJWT, requireProjectBoundResourceAccess('CONTRIBUTE', 'card'), CommentController.createComment);

// ==================== RUTAS POR BOARD ====================

// Obtener comentarios recientes de un board
router.get(
  '/boards/:boardId/comments/recent',
  authenticateJWT,
  requireProjectBoundResourceAccess('READ', 'board'),
  CommentController.getRecentComments
);

// ==================== RUTAS POR COMENTARIO ====================

// Obtener comentario por ID
router.get('/comments/:commentId', authenticateJWT, requireProjectBoundResourceAccess('READ', 'comment'), CommentController.getCommentById);

// Actualizar comentario (solo autor)
router.patch('/comments/:commentId', authenticateJWT, requireProjectBoundResourceAccess('CONTRIBUTE', 'comment'), CommentController.updateComment);

// Eliminar comentario (solo autor)
router.delete('/comments/:commentId', authenticateJWT, requireProjectBoundResourceAccess('CONTRIBUTE', 'comment'), CommentController.deleteComment);

export default router;
