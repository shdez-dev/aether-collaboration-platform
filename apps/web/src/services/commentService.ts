// apps/web/src/services/commentService.ts

import type { CommentWithUser, CommentDocumentReference } from '@aether/types';
import { apiService } from './apiService';

/**
 * Response types para las API calls
 */

/**
 * DTOs para crear/actualizar comentarios
 */
interface CreateCommentDto {
  content: string;
  mentions?: string[];
  documentReference?: Pick<CommentDocumentReference, 'documentId' | 'from' | 'to' | 'quote'>;
}

interface UpdateCommentDto {
  content?: string;
  mentions?: string[];
}

/**
 * Helper para obtener el token del localStorage
 */

/**
 * CommentService
 * Maneja todas las operaciones HTTP relacionadas con comentarios
 * Singleton para mantener configuración centralizada
 */
class CommentService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await apiService.request<T>(endpoint, options, true);
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'No se pudo completar la operación con el comentario');
    }
    return response.data;
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * GET /api/cards/:cardId/comments
   * Obtener todos los comentarios de una card
   */
  async getCommentsByCard(cardId: string): Promise<CommentWithUser[]> {
    const result = await this.request<{ comments: CommentWithUser[] }>(`/api/cards/${cardId}/comments`);
    return result.comments;
  }

  /**
   * POST /api/cards/:cardId/comments
   * Crear un nuevo comentario
   */
  async createComment(cardId: string, data: CreateCommentDto): Promise<CommentWithUser> {
    const result = await this.request<{ comment: CommentWithUser }>(`/api/cards/${cardId}/comments`, { method: 'POST', body: JSON.stringify(data) });
    return result.comment;
  }

  /**
   * GET /api/comments/:commentId
   * Obtener un comentario específico
   */
  async getCommentById(commentId: string): Promise<CommentWithUser> {
    const result = await this.request<{ comment: CommentWithUser }>(`/api/comments/${commentId}`);
    return result.comment;
  }

  /**
   * PATCH /api/comments/:commentId
   * Actualizar un comentario (solo autor)
   */
  async updateComment(commentId: string, data: UpdateCommentDto): Promise<CommentWithUser> {
    const result = await this.request<{ comment: CommentWithUser }>(`/api/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify(data) });
    return result.comment;
  }

  /**
   * DELETE /api/comments/:commentId
   * Eliminar un comentario (solo autor)
   */
  async deleteComment(commentId: string): Promise<void> {
    await this.request<{ message: string }>(`/api/comments/${commentId}`, { method: 'DELETE' });
  }

  /**
   * GET /api/cards/:cardId/comments/count
   * Obtener el contador de comentarios de una card
   */
  async getCommentCount(cardId: string): Promise<number> {
    const result = await this.request<{ count: number }>(`/api/cards/${cardId}/comments/count`);
    return result.count;
  }

  /**
   * GET /api/boards/:boardId/comments/recent
   * Obtener comentarios recientes de un board
   */
  async getRecentComments(boardId: string, limit: number = 10): Promise<CommentWithUser[]> {
    const result = await this.request<{ comments: CommentWithUser[] }>(`/api/boards/${boardId}/comments/recent?limit=${limit}`);
    return result.comments;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extraer menciones del contenido
   * Busca patrones @username en el texto
   */
  extractMentions(content: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const matches = content.matchAll(mentionRegex);
    const mentions = new Set<string>();

    for (const match of matches) {
      mentions.add(match[1]);
    }

    return Array.from(mentions);
  }

  /**
   * Verificar si el contenido tiene menciones
   */
  hasMentions(content: string): boolean {
    return /@([a-zA-Z0-9_-]+)/.test(content);
  }

  /**
   * Formatear contenido con menciones resaltadas (para UI)
   */
  formatMentions(content: string): string {
    return content.replace(/@([a-zA-Z0-9_-]+)/g, '<span class="mention">@$1</span>');
  }
}

// Exportar instancia singleton
export const commentService = new CommentService();

// Exportar clase para testing si es necesario
export default CommentService;

// Exportar tipos
export type { CreateCommentDto, UpdateCommentDto };
