// apps/api/src/controllers/CommentController.ts

import { Request, Response } from 'express';
import { commentService } from '../services/CommentService';
import { z } from 'zod';

// ==================== SCHEMAS DE VALIDACIÓN ====================

/**
 * Schema para crear un comentario
 */
const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(5000, 'Content cannot exceed 5000 characters'),
  mentions: z.array(z.string().uuid('Invalid user ID format')).optional().default([]),
});

/**
 * Schema para actualizar un comentario
 */
const updateCommentSchema = z
  .object({
    content: z
      .string()
      .min(1, 'Content cannot be empty')
      .max(5000, 'Content cannot exceed 5000 characters')
      .optional(),
    mentions: z.array(z.string().uuid('Invalid user ID format')).optional(),
  })
  .refine((data) => data.content !== undefined || data.mentions !== undefined, {
    message: 'At least one field (content or mentions) is required',
  });

/**
 * Schema para query params de comentarios recientes
 */
const recentCommentsQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((val) => val >= 1 && val <= 100, {
      message: 'Limit must be between 1 and 100',
    })
    .optional()
    .default('10')
    .transform((val) => (typeof val === 'string' ? Number(val) : val)),
});

// ==================== CONTROLLER ====================

/**
 * CommentController
 * Maneja las peticiones HTTP relacionadas con comentarios
 */
export class CommentController {
  /**
   * GET /api/cards/:cardId/comments
   * Obtener todos los comentarios de una card
   */
  static async getCommentsByCard(req: Request, res: Response) {
    try {
      const { cardId } = req.params;

      const comments = await commentService.getCommentsByCardId(cardId);

      return res.status(200).json({
        success: true,
        data: { comments },
      });
    } catch (error: any) {
      console.error('❌ Error getting comments:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * POST /api/cards/:cardId/comments
   * Crear un nuevo comentario en una card
   */
  static async createComment(req: Request, res: Response) {
    try {
      const { cardId } = req.params;

      // ========================================================================
      // EXTRACCIÓN CORRECTA DEL USER ID
      // ========================================================================
      const user = (req as any).user;

      if (!user || !user.id) {
        console.error('❌ No user in request:', user);
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id; // ← CORRECCIÓN: user.id en lugar de user.userId
      console.log('✓ User authenticated:', userId);

      // Validar body con Zod
      const validationResult = createCommentSchema.safeParse(req.body);
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

      const { content, mentions } = validationResult.data;

      console.log('Creating comment:', { cardId, userId, content });

      const comment = await commentService.createComment({
        cardId,
        userId,
        content,
        mentions,
      });

      console.log('✓ Comment created:', comment.id);

      return res.status(201).json({
        success: true,
        data: { comment },
      });
    } catch (error: any) {
      console.error('❌ Error creating comment:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/comments/:commentId
   * Obtener un comentario específico
   */
  static async getCommentById(req: Request, res: Response) {
    try {
      const { commentId } = req.params;

      const comment = await commentService.getCommentById(commentId);

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Comment not found' },
        });
      }

      return res.status(200).json({
        success: true,
        data: { comment },
      });
    } catch (error: any) {
      console.error('❌ Error getting comment:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * PATCH /api/comments/:commentId
   * Actualizar un comentario (solo autor)
   */
  static async updateComment(req: Request, res: Response) {
    try {
      const { commentId } = req.params;

      // ========================================================================
      // EXTRACCIÓN CORRECTA DEL USER ID
      // ========================================================================
      const user = (req as any).user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id; // ← CORRECCIÓN: user.id en lugar de user.userId

      // Validar body con Zod
      const validationResult = updateCommentSchema.safeParse(req.body);
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

      const comment = await commentService.updateComment(commentId, userId, validationResult.data);

      return res.status(200).json({
        success: true,
        data: { comment },
      });
    } catch (error: any) {
      console.error('❌ Error updating comment:', error);

      if (error.message === 'Only the author can edit this comment') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: error.message },
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * DELETE /api/comments/:commentId
   * Eliminar un comentario (solo autor)
   */
  static async deleteComment(req: Request, res: Response) {
    try {
      const { commentId } = req.params;

      // ========================================================================
      // EXTRACCIÓN CORRECTA DEL USER ID
      // ========================================================================
      const user = (req as any).user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id; // ← CORRECCIÓN: user.id en lugar de user.userId

      await commentService.deleteComment(commentId, userId);

      return res.status(200).json({
        success: true,
        data: { message: 'Comment deleted successfully' },
      });
    } catch (error: any) {
      console.error('❌ Error deleting comment:', error);

      if (error.message === 'Only the author can delete this comment') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: error.message },
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/cards/:cardId/comments/count
   * Obtener el número de comentarios de una card
   */
  static async getCommentCount(req: Request, res: Response) {
    try {
      const { cardId } = req.params;

      const count = await commentService.countCommentsByCardId(cardId);

      return res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('❌ Error getting comment count:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/boards/:boardId/comments/recent
   * Obtener comentarios recientes de un board
   */
  static async getRecentComments(req: Request, res: Response) {
    try {
      const { boardId } = req.params;

      // Validar query params con Zod
      const validationResult = recentCommentsQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validationResult.error.errors,
          },
        });
      }

      const limit = validationResult.data.limit;

      const comments = await commentService.getRecentCommentsByBoardId(boardId, limit);

      return res.status(200).json({
        success: true,
        data: { comments },
      });
    } catch (error: any) {
      console.error('❌ Error getting recent comments:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }
}
