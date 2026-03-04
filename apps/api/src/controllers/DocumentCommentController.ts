// apps/api/src/controllers/DocumentCommentController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { getDocumentCommentRepository } from '../repositories/DocumentCommentRepository';
import { documentService } from '../services/DocumentService';
import { Server as SocketIOServer } from 'socket.io';

// ── Validation schemas ───────────────────────────────────────────────────────

const createCommentSchema = z.object({
  content: z.string().min(1).max(4000),
  position: z.object({
    from: z.number().int().min(0),
    to: z.number().int().min(0),
  }),
  parentId: z.string().uuid().nullable().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(4000),
});

const resolveCommentSchema = z.object({
  resolved: z.boolean(),
});

// ── Controller ───────────────────────────────────────────────────────────────

class DocumentCommentController {
  private io: SocketIOServer | null = null;

  setIo(io: SocketIOServer) {
    this.io = io;
  }

  private emit(documentId: string, event: string, payload: unknown) {
    if (this.io) {
      this.io.to(`document:${documentId}`).emit(event, payload);
    }
  }

  // ── GET /documents/:id/comments ──────────────────────────────────────────
  async list(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id: documentId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(documentId, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Sin acceso al documento' },
        });
      }

      const repo = getDocumentCommentRepository();
      const comments = await repo.findByDocumentId(documentId);

      return res.status(200).json({ success: true, data: { comments } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al obtener comentarios' },
      });
    }
  }

  // ── POST /documents/:id/comments ─────────────────────────────────────────
  async create(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { id: documentId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(documentId, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Sin acceso al documento' },
        });
      }

      const validation = createCommentSchema.safeParse(req.body);
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

      const repo = getDocumentCommentRepository();
      const comment = await repo.create({
        documentId,
        userId,
        content: validation.data.content,
        position: validation.data.position,
        parentId: validation.data.parentId ?? null,
      });

      // Leer con datos del usuario para devolverlo completo
      const commentWithUser = await repo.findById(comment.id);

      // Emitir evento realtime a todos los usuarios en el documento
      this.emit(documentId, 'document:comment:added', { documentId, comment: commentWithUser });

      return res.status(201).json({ success: true, data: { comment: commentWithUser } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al crear comentario' },
      });
    }
  }

  // ── PATCH /document-comments/:commentId ──────────────────────────────────
  async update(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { commentId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const repo = getDocumentCommentRepository();

      const isAuthor = await repo.isAuthor(commentId, userId);
      if (!isAuthor) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Solo el autor puede editar este comentario' },
        });
      }

      const validation = updateCommentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' },
        });
      }

      const updated = await repo.update(commentId, validation.data.content);
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Comentario no encontrado' },
        });
      }

      const commentWithUser = await repo.findById(commentId);
      this.emit(updated.documentId, 'document:comment:updated', {
        documentId: updated.documentId,
        comment: commentWithUser,
      });

      return res.status(200).json({ success: true, data: { comment: commentWithUser } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al actualizar comentario' },
      });
    }
  }

  // ── PATCH /document-comments/:commentId/resolve ───────────────────────────
  async resolve(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { commentId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const validation = resolveCommentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' },
        });
      }

      const repo = getDocumentCommentRepository();

      // Verificar acceso al documento (cualquier miembro puede resolver)
      const documentId = await repo.getDocumentId(commentId);
      if (!documentId) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Comentario no encontrado' },
        });
      }

      const hasAccess = await documentService.checkDocumentAccess(documentId, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Sin acceso al documento' },
        });
      }

      const updated = await repo.setResolved(commentId, validation.data.resolved);
      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Comentario no encontrado' },
        });
      }

      const commentWithUser = await repo.findById(commentId);
      this.emit(documentId, 'document:comment:resolved', {
        documentId,
        comment: commentWithUser,
      });

      return res.status(200).json({ success: true, data: { comment: commentWithUser } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al resolver comentario' },
      });
    }
  }

  // ── DELETE /document-comments/:commentId ─────────────────────────────────
  async delete(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { commentId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Autenticación requerida' },
        });
      }

      const repo = getDocumentCommentRepository();

      const isAuthor = await repo.isAuthor(commentId, userId);
      if (!isAuthor) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Solo el autor puede eliminar este comentario' },
        });
      }

      const documentId = await repo.getDocumentId(commentId);
      const deleted = await repo.delete(commentId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Comentario no encontrado' },
        });
      }

      if (documentId) {
        this.emit(documentId, 'document:comment:deleted', { documentId, commentId });
      }

      return res.status(200).json({ success: true, data: { message: 'Comentario eliminado' } });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al eliminar comentario' },
      });
    }
  }
}

export const documentCommentController = new DocumentCommentController();
