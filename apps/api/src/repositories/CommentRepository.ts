// apps/api/src/repositories/CommentRepository.ts

import { query } from '../lib/db';
import type { Comment, CommentWithUser } from '@aether/types';

/**
 * CommentRepository
 * Capa de acceso a datos para comentarios
 */
export class CommentRepository {
  /**
   * Crear un nuevo comentario
   */
  async create(data: {
    cardId: string;
    userId: string;
    content: string;
    mentions: string[];
  }): Promise<Comment> {
    const result = await query<Comment>(
      `INSERT INTO comments (card_id, user_id, content, mentions)
       VALUES ($1, $2, $3, $4)
       RETURNING 
         id, 
         card_id as "cardId", 
         user_id as "userId", 
         content, 
         mentions, 
         edited, 
         created_at as "createdAt", 
         updated_at as "updatedAt"`,
      [data.cardId, data.userId, data.content, data.mentions]
    );

    return result.rows[0];
  }

  /**
   * Obtener comentarios de una card con información del usuario
   */
  async findByCardId(cardId: string): Promise<CommentWithUser[]> {
    const result = await query<CommentWithUser>(
      `SELECT 
         c.id,
         c.card_id as "cardId",
         c.user_id as "userId",
         c.content,
         c.mentions,
         c.edited,
         c.created_at as "createdAt",
         c.updated_at as "updatedAt",
         json_build_object(
           'id', u.id,
           'name', u.name,
           'email', u.email,
           'avatar', u.avatar,
           'createdAt', u.created_at,
           'updatedAt', u.updated_at
         ) as user
       FROM comments c
       INNER JOIN users u ON c.user_id = u.id
       WHERE c.card_id = $1
       ORDER BY c.created_at ASC`,
      [cardId]
    );

    return result.rows;
  }

  /**
   * Obtener un comentario por ID con información del usuario
   */
  async findById(commentId: string): Promise<CommentWithUser | null> {
    const result = await query<CommentWithUser>(
      `SELECT 
         c.id,
         c.card_id as "cardId",
         c.user_id as "userId",
         c.content,
         c.mentions,
         c.edited,
         c.created_at as "createdAt",
         c.updated_at as "updatedAt",
         json_build_object(
           'id', u.id,
           'name', u.name,
           'email', u.email,
           'avatar', u.avatar,
           'createdAt', u.created_at,
           'updatedAt', u.updated_at
         ) as user
       FROM comments c
       INNER JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [commentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Actualizar contenido de un comentario
   */
  async update(
    commentId: string,
    data: {
      content?: string;
      mentions?: string[];
    }
  ): Promise<Comment | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }

    if (data.mentions !== undefined) {
      updates.push(`mentions = $${paramIndex++}`);
      values.push(data.mentions);
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(commentId);

    const result = await query<Comment>(
      `UPDATE comments 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING 
         id, 
         card_id as "cardId", 
         user_id as "userId", 
         content, 
         mentions, 
         edited, 
         created_at as "createdAt", 
         updated_at as "updatedAt"`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Eliminar un comentario (eliminación física)
   */
  async delete(commentId: string): Promise<boolean> {
    const result = await query('DELETE FROM comments WHERE id = $1', [commentId]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Verificar si un usuario es el autor de un comentario
   */
  async isAuthor(commentId: string, userId: string): Promise<boolean> {
    const result = await query('SELECT 1 FROM comments WHERE id = $1 AND user_id = $2', [
      commentId,
      userId,
    ]);

    return result.rows.length > 0;
  }

  /**
   * Obtener el cardId de un comentario
   */
  async getCardId(commentId: string): Promise<string | null> {
    const result = await query<{ cardId: string }>(
      'SELECT card_id as "cardId" FROM comments WHERE id = $1',
      [commentId]
    );

    return result.rows[0]?.cardId || null;
  }

  /**
   * Contar comentarios de una card
   */
  async countByCardId(cardId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM comments WHERE card_id = $1',
      [cardId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Obtener comentarios recientes de un board
   */
  async findRecentByBoardId(boardId: string, limit: number = 10): Promise<CommentWithUser[]> {
    const result = await query<CommentWithUser>(
      `SELECT 
         c.id,
         c.card_id as "cardId",
         c.user_id as "userId",
         c.content,
         c.mentions,
         c.edited,
         c.created_at as "createdAt",
         c.updated_at as "updatedAt",
         json_build_object(
           'id', u.id,
           'name', u.name,
           'email', u.email,
           'avatar', u.avatar,
           'createdAt', u.created_at,
           'updatedAt', u.updated_at
         ) as user
       FROM comments c
       INNER JOIN users u ON c.user_id = u.id
       INNER JOIN cards ca ON c.card_id = ca.id
       INNER JOIN lists l ON ca.list_id = l.id
       WHERE l.board_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [boardId, limit]
    );

    return result.rows;
  }
}

// Export singleton
let repositoryInstance: CommentRepository | null = null;

export function getCommentRepository(): CommentRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CommentRepository();
  }
  return repositoryInstance;
}
