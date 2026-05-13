// apps/api/src/services/CommentService.ts

import { getCommentRepository } from '../repositories/CommentRepository';
import { eventStore } from './EventStoreService'; // ✅ CAMBIO 1: Usar instancia compartida
import { notificationService } from './NotificationService';
import { CardService } from './CardService';
import { pool } from '../lib/db';
import type { Comment, CommentWithUser, CommentId, CardId, UserId } from '@aether/types';

// ❌ ELIMINAR: const eventStore = new EventStoreService();

/**
 * CommentService
 * Lógica de negocio para comentarios
 */
export class CommentService {
  private commentRepository = getCommentRepository();

  /**
   * Crear un nuevo comentario
   */
  async createComment(data: {
    cardId: string;
    userId: string;
    content: string;
    mentions?: string[];
  }): Promise<CommentWithUser> {
    if (!data.content || data.content.trim().length === 0) {
      throw new Error('Comment content cannot be empty');
    }

    if (data.content.length > 5000) {
      throw new Error('Comment content cannot exceed 5000 characters');
    }

    // Crear comentario en DB (sin transacción, el repositorio la maneja)
    const comment = await this.commentRepository.create({
      cardId: data.cardId,
      userId: data.userId,
      content: data.content.trim(),
      mentions: data.mentions || [],
    });

    // Obtener información del autor y la tarjeta para el evento y notificaciones
    let eventBoardId: string | undefined;
    let eventWorkspaceId: string | undefined;
    let eventCardTitle: string | undefined;
    let eventAuthorName: string | undefined;

    try {
      const authorResult = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [
        data.userId,
      ]);
      const author = authorResult.rows[0];
      const card = await CardService.getCardById(data.cardId);

      if (author && card) {
        eventBoardId = await CardService.getBoardIdFromCard(card.id) || undefined;
        eventWorkspaceId = eventBoardId ? await CardService.getWorkspaceIdFromBoard(eventBoardId) || undefined : undefined;
        eventCardTitle = card.title;
        eventAuthorName = author.name;
      }
    } catch (_) {}

    // ✅ EMITIR EVENTO con contexto completo
    await eventStore.emit(
      'comment.created',
      {
        commentId: comment.id as CommentId,
        cardId: data.cardId as CardId,
        userId: data.userId as UserId,
        content: comment.content,
        mentions: (comment.mentions || []) as UserId[],
        createdBy: data.userId as UserId,
        authorName: eventAuthorName,
        cardTitle: eventCardTitle,
        boardId: eventBoardId,
        workspaceId: eventWorkspaceId,
      },
      data.userId as UserId
    );

    try {
      const authorResult = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [
        data.userId,
      ]);
      const author = authorResult.rows[0];
      const card = await CardService.getCardById(data.cardId);

      if (author && card) {
        // Obtener boardId y workspaceId para incluir en notificaciones
        const boardId = eventBoardId || await CardService.getBoardIdFromCard(card.id) || undefined;
        const workspaceId = eventWorkspaceId || (boardId ? await CardService.getWorkspaceIdFromBoard(boardId) || undefined : undefined);

        // Procesar menciones y crear notificaciones de mención
        if (data.mentions && data.mentions.length > 0) {
          for (const mentionedUserId of data.mentions) {
            try {
              await notificationService.createMentionNotification({
                mentionedUserId,
                authorId: author.id,
                authorName: author.name,
                cardId: card.id,
                cardTitle: card.title,
                commentId: comment.id,
                commentPreview: data.content,
                boardId,
                workspaceId,
              });
            } catch (error) {}
          }

          for (const mentionedUserId of data.mentions) {
            await eventStore.emit(
              'comment.mentioned',
              {
                commentId: comment.id as CommentId,
                cardId: data.cardId as CardId,
                mentionedUserId: mentionedUserId as UserId,
                mentionedByUserId: data.userId as UserId,
                content: comment.content,
              },
              data.userId as UserId
            );
          }
        }

        // Crear notificación de comentario para todos los miembros de la tarjeta
        if (card.members && card.members.length > 0) {
          const cardMemberIds = card.members.map((m: any) => m.id);
          await notificationService.createCommentNotification({
            cardMembers: cardMemberIds,
            authorId: author.id,
            authorName: author.name,
            cardId: card.id,
            cardTitle: card.title,
            commentId: comment.id,
            commentPreview: data.content,
            boardId,
            workspaceId,
          });
        }
      }
    } catch (error) {}

    const commentWithUser = await this.commentRepository.findById(comment.id);
    if (!commentWithUser) {
      throw new Error('Failed to retrieve created comment');
    }

    return commentWithUser;
  }

  /**
   * Obtener comentarios de una card
   */
  async getCommentsByCardId(cardId: string): Promise<CommentWithUser[]> {
    return await this.commentRepository.findByCardId(cardId);
  }

  /**
   * Obtener un comentario por ID
   */
  async getCommentById(commentId: string): Promise<CommentWithUser | null> {
    return await this.commentRepository.findById(commentId);
  }

  /**
   * Actualizar un comentario
   */
  async updateComment(
    commentId: string,
    userId: string,
    data: {
      content?: string;
      mentions?: string[];
    }
  ): Promise<CommentWithUser> {
    const isAuthor = await this.commentRepository.isAuthor(commentId, userId);
    if (!isAuthor) {
      throw new Error('Only the author can edit this comment');
    }

    if (data.content !== undefined) {
      if (data.content.trim().length === 0) {
        throw new Error('Comment content cannot be empty');
      }

      if (data.content.length > 5000) {
        throw new Error('Comment content cannot exceed 5000 characters');
      }

      data.content = data.content.trim();
    }

    const updatedComment = await this.commentRepository.update(commentId, data);
    if (!updatedComment) {
      throw new Error('Comment not found');
    }

    const cardId = await this.commentRepository.getCardId(commentId);
    if (!cardId) {
      throw new Error('Card not found for comment');
    }

    // Obtener contexto para el evento
    let updateBoardId: string | undefined;
    let updateWorkspaceId: string | undefined;
    let updateCardTitle: string | undefined;
    let updateAuthorName: string | undefined;
    try {
      const [uCard, uUser] = await Promise.all([
        CardService.getCardById(cardId),
        pool.query('SELECT name FROM users WHERE id = $1', [userId]),
      ]);
      if (uCard) {
        updateBoardId = await CardService.getBoardIdFromCard(uCard.id) || undefined;
        updateWorkspaceId = updateBoardId ? await CardService.getWorkspaceIdFromBoard(updateBoardId) || undefined : undefined;
        updateCardTitle = uCard.title;
      }
      updateAuthorName = uUser.rows[0]?.name;
    } catch (_) {}

    // ✅ EMITIR EVENTO (ya después del commit del repositorio)
    await eventStore.emit(
      'comment.updated',
      {
        commentId: commentId as CommentId,
        cardId: cardId as CardId,
        changes: {
          content: data.content,
          mentions: data.mentions as UserId[] | undefined,
        },
        updatedBy: userId as UserId,
        authorName: updateAuthorName,
        cardTitle: updateCardTitle,
        boardId: updateBoardId,
        workspaceId: updateWorkspaceId,
      },
      userId as UserId
    );

    // Procesar menciones actualizadas
    if (data.mentions && data.mentions.length > 0) {
      try {
        const authorResult = await pool.query(`SELECT id, name, email FROM users WHERE id = $1`, [
          userId,
        ]);
        const author = authorResult.rows[0];

        const card = await CardService.getCardById(cardId);

        if (author && card) {
          const boardId2 = await CardService.getBoardIdFromCard(card.id) || undefined;
          const workspaceId2 = boardId2 ? await CardService.getWorkspaceIdFromBoard(boardId2) || undefined : undefined;

          for (const mentionedUserId of data.mentions) {
            try {
              await notificationService.createMentionNotification({
                mentionedUserId,
                authorId: author.id,
                authorName: author.name,
                cardId: card.id,
                cardTitle: card.title,
                commentId: commentId,
                commentPreview: updatedComment.content,
                boardId: boardId2,
                workspaceId: workspaceId2,
              });
            } catch (error) {}
          }

          for (const mentionedUserId of data.mentions) {
            await eventStore.emit(
              'comment.mentioned',
              {
                commentId: commentId as CommentId,
                cardId: cardId as CardId,
                mentionedUserId: mentionedUserId as UserId,
                mentionedByUserId: userId as UserId,
                content: updatedComment.content,
              },
              userId as UserId
            );
          }
        }
      } catch (error) {}
    }

    const commentWithUser = await this.commentRepository.findById(commentId);
    if (!commentWithUser) {
      throw new Error('Failed to retrieve updated comment');
    }

    return commentWithUser;
  }

  /**
   * Eliminar un comentario
   */
  async deleteComment(commentId: string, userId: string): Promise<void> {
    const isAuthor = await this.commentRepository.isAuthor(commentId, userId);
    if (!isAuthor) {
      throw new Error('Only the author can delete this comment');
    }

    const cardId = await this.commentRepository.getCardId(commentId);
    if (!cardId) {
      throw new Error('Card not found for comment');
    }

    const deleted = await this.commentRepository.delete(commentId);
    if (!deleted) {
      throw new Error('Comment not found');
    }

    // Obtener contexto para el evento
    let deleteBoardId: string | undefined;
    let deleteWorkspaceId: string | undefined;
    let deleteCardTitle: string | undefined;
    let deleteUserName: string | undefined;
    try {
      const [dCard, dUser] = await Promise.all([
        CardService.getCardById(cardId),
        pool.query('SELECT name FROM users WHERE id = $1', [userId]),
      ]);
      if (dCard) {
        deleteBoardId = await CardService.getBoardIdFromCard(dCard.id) || undefined;
        deleteWorkspaceId = deleteBoardId ? await CardService.getWorkspaceIdFromBoard(deleteBoardId) || undefined : undefined;
        deleteCardTitle = dCard.title;
      }
      deleteUserName = dUser.rows[0]?.name;
    } catch (_) {}

    // ✅ EMITIR EVENTO (ya después del commit del repositorio)
    await eventStore.emit(
      'comment.deleted',
      {
        commentId: commentId as CommentId,
        cardId: cardId as CardId,
        deletedBy: userId as UserId,
        deletedByName: deleteUserName,
        cardTitle: deleteCardTitle,
        boardId: deleteBoardId,
        workspaceId: deleteWorkspaceId,
      },
      userId as UserId
    );
  }

  /**
   * Contar comentarios de una card
   */
  async countCommentsByCardId(cardId: string): Promise<number> {
    return await this.commentRepository.countByCardId(cardId);
  }

  /**
   * Obtener comentarios recientes de un board
   */
  async getRecentCommentsByBoardId(
    boardId: string,
    limit: number = 10
  ): Promise<CommentWithUser[]> {
    return await this.commentRepository.findRecentByBoardId(boardId, limit);
  }

  /**
   * Extraer menciones del contenido
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
   * Validar que los usuarios mencionados existen en el workspace
   */
  async validateMentions(mentions: string[], workspaceId: string): Promise<string[]> {
    return mentions;
  }
}

export const commentService = new CommentService();
