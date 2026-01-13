// apps/web/src/services/commentService.ts

import type { Comment, CommentWithUser } from '@aether/types';

/**
 * Response types para las API calls
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * DTOs para crear/actualizar comentarios
 */
interface CreateCommentDto {
  content: string;
  mentions?: string[];
}

interface UpdateCommentDto {
  content?: string;
  mentions?: string[];
}

/**
 * Helper para obtener el token del localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const authStorage = localStorage.getItem('aether-auth-storage');
    if (!authStorage) {
      console.warn('[CommentService] No auth storage found');
      return null;
    }

    const parsed = JSON.parse(authStorage);
    const token = parsed.state?.accessToken || null;

    if (!token) {
      console.warn('[CommentService] No access token in storage');
    }

    return token;
  } catch (error) {
    console.error('[CommentService] Error reading auth token:', error);
    return null;
  }
}

/**
 * CommentService
 * Maneja todas las operaciones HTTP relacionadas con comentarios
 * Singleton para mantener configuración centralizada
 */
class CommentService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  }

  /**
   * Obtener headers con autenticación
   * Obtiene el token dinámicamente en cada request
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.warn('[CommentService] No auth token available for request');
    }

    return headers;
  }

  /**
   * Manejar respuesta de la API
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error?.message || 'Request failed');
    }

    return data.data!;
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * GET /api/cards/:cardId/comments
   * Obtener todos los comentarios de una card
   */
  async getCommentsByCard(cardId: string): Promise<CommentWithUser[]> {
    try {
      console.log('[CommentService] Fetching comments for card:', cardId);

      const response = await fetch(`${this.baseUrl}/api/cards/${cardId}/comments`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse<{ comments: CommentWithUser[] }>(response);
      console.log('[CommentService] Loaded comments:', result.comments.length);
      return result.comments;
    } catch (error) {
      console.error('[CommentService] Error getting comments:', error);
      throw error;
    }
  }

  /**
   * POST /api/cards/:cardId/comments
   * Crear un nuevo comentario
   */
  async createComment(cardId: string, data: CreateCommentDto): Promise<CommentWithUser> {
    try {
      console.log('[CommentService] Creating comment on card:', cardId);

      const response = await fetch(`${this.baseUrl}/api/cards/${cardId}/comments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      const result = await this.handleResponse<{ comment: CommentWithUser }>(response);
      console.log('[CommentService] Comment created:', result.comment.id);
      return result.comment;
    } catch (error) {
      console.error('[CommentService] Error creating comment:', error);
      throw error;
    }
  }

  /**
   * GET /api/comments/:commentId
   * Obtener un comentario específico
   */
  async getCommentById(commentId: string): Promise<CommentWithUser> {
    try {
      const response = await fetch(`${this.baseUrl}/api/comments/${commentId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse<{ comment: CommentWithUser }>(response);
      return result.comment;
    } catch (error) {
      console.error('[CommentService] Error getting comment:', error);
      throw error;
    }
  }

  /**
   * PATCH /api/comments/:commentId
   * Actualizar un comentario (solo autor)
   */
  async updateComment(commentId: string, data: UpdateCommentDto): Promise<CommentWithUser> {
    try {
      console.log('[CommentService] Updating comment:', commentId);

      const response = await fetch(`${this.baseUrl}/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      const result = await this.handleResponse<{ comment: CommentWithUser }>(response);
      console.log('[CommentService] Comment updated');
      return result.comment;
    } catch (error) {
      console.error('[CommentService] Error updating comment:', error);
      throw error;
    }
  }

  /**
   * DELETE /api/comments/:commentId
   * Eliminar un comentario (solo autor)
   */
  async deleteComment(commentId: string): Promise<void> {
    try {
      console.log('[CommentService] Deleting comment:', commentId);

      const response = await fetch(`${this.baseUrl}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      await this.handleResponse<{ message: string }>(response);
      console.log('[CommentService] Comment deleted');
    } catch (error) {
      console.error('[CommentService] Error deleting comment:', error);
      throw error;
    }
  }

  /**
   * GET /api/cards/:cardId/comments/count
   * Obtener el contador de comentarios de una card
   */
  async getCommentCount(cardId: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/api/cards/${cardId}/comments/count`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await this.handleResponse<{ count: number }>(response);
      return result.count;
    } catch (error) {
      console.error('[CommentService] Error getting comment count:', error);
      throw error;
    }
  }

  /**
   * GET /api/boards/:boardId/comments/recent
   * Obtener comentarios recientes de un board
   */
  async getRecentComments(boardId: string, limit: number = 10): Promise<CommentWithUser[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/boards/${boardId}/comments/recent?limit=${limit}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      const result = await this.handleResponse<{ comments: CommentWithUser[] }>(response);
      return result.comments;
    } catch (error) {
      console.error('[CommentService] Error getting recent comments:', error);
      throw error;
    }
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
