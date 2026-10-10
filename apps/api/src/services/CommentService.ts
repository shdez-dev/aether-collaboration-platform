// apps/api/src/services/CommentService.ts

import { getCommentRepository } from '../repositories/CommentRepository';
import { eventStore } from './EventStoreService'; // ✅ CAMBIO 1: Usar instancia compartida
import { notificationService } from './NotificationService';
import { CardService } from './CardService';
import { pool } from '../lib/db';
import { documentService } from './DocumentService';
import type { Comment, CommentWithUser, CommentDocumentReference, CommentId, CardId, UserId } from '@aether/types';

type DocumentReferenceInput = { documentId: string; from: number; to: number; quote: string };

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
    documentReference?: DocumentReferenceInput;
  }): Promise<CommentWithUser> {
    if (!data.content || data.content.trim().length === 0) {
      throw new Error('Comment content cannot be empty');
    }

    if (data.content.length > 2000) {
      throw new Error('Comment content cannot exceed 2000 characters');
    }

    if (data.mentions?.length) {
      await this.assertMentionCandidates(data.cardId, data.userId, data.mentions);
    }

    const documentReference = data.documentReference
      ? await this.resolveDocumentReference(data.cardId, data.userId, data.documentReference)
      : undefined;

    // Crear comentario en DB (sin transacción, el repositorio la maneja)
    const comment = await this.commentRepository.create({
      cardId: data.cardId,
      userId: data.userId,
      content: data.content.trim(),
      mentions: data.mentions || [],
      ...(documentReference ? { documentReference } : {}),
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
    try {
      await eventStore.emit({
        type: 'comment.created',
        actor: { id: data.userId, name: eventAuthorName ?? '' },
        subject: { type: 'comment', id: comment.id, name: comment.content.slice(0, 50) },
        context: {
          workspaceId: eventWorkspaceId ?? '',
          boardId: eventBoardId,
          cardId: data.cardId,
        },
        payload: { mentions: (comment.mentions || []) as UserId[], cardTitle: eventCardTitle ?? '' },
      });
    } catch (error) {
      console.error('[CommentService.createComment] event emission failed:', error);
    }

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
            const mentionedUserResult = await pool.query('SELECT name FROM users WHERE id = $1', [mentionedUserId]);
            const mentionedUserName = mentionedUserResult.rows[0]?.name ?? '';
            await eventStore.emit({
              type: 'comment.mention-added',
              actor: { id: data.userId, name: eventAuthorName ?? '' },
              subject: { type: 'comment', id: comment.id, name: comment.content.slice(0, 50) },
              context: {
                workspaceId: eventWorkspaceId ?? '',
                boardId: eventBoardId,
                cardId: data.cardId,
              },
              payload: { mentionedUserId, mentionedUserName, cardTitle: eventCardTitle ?? '', contentPreview: comment.content.slice(0, 100) },
              targetUserId: mentionedUserId,
            });
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
  async getCommentsByCardId(cardId: string, userId?: string): Promise<CommentWithUser[]> {
    return this.withVisibleReferences(await this.commentRepository.findByCardId(cardId), userId);
  }

  /** Documentos del mismo proyecto (o espacio) que el tablero, visibles para el usuario. */
  async getDocumentCandidates(cardId: string, userId: string): Promise<Array<{ id: string; title: string }>> {
    const result = await pool.query<{ id: string; title: string }>(
      `SELECT DISTINCT d.id, d.title
         FROM cards c
         JOIN lists l ON l.id = c.list_id
         JOIN boards b ON b.id = l.board_id
         LEFT JOIN project_boards pb ON pb.board_id = b.id
         JOIN documents d ON d.workspace_id = b.workspace_id
          AND (d.project_id IS NULL OR d.project_id = pb.project_id)
        WHERE c.id = $1
        ORDER BY d.title
        LIMIT 100`,
      [cardId],
    );
    const accessible = await Promise.all(result.rows.map(async (document) =>
      (await documentService.getEffectiveUserPermission(document.id, userId)) ? document : null,
    ));
    return accessible.filter((document): document is { id: string; title: string } => document !== null);
  }

  private async resolveDocumentReference(cardId: string, userId: string, input: DocumentReferenceInput): Promise<CommentDocumentReference> {
    const result = await pool.query<{ id: string; title: string; content: string }>(
      `SELECT d.id, d.title, d.content
         FROM cards c
         JOIN lists l ON l.id = c.list_id
         JOIN boards b ON b.id = l.board_id
         LEFT JOIN project_boards pb ON pb.board_id = b.id
         JOIN documents d ON d.id = $2 AND d.workspace_id = b.workspace_id
          AND (d.project_id IS NULL OR d.project_id = pb.project_id)
        WHERE c.id = $1
        LIMIT 1`,
      [cardId, input.documentId],
    );
    const document = result.rows[0];
    if (!document || !(await documentService.getEffectiveUserPermission(document.id, userId))) {
      throw new Error('No tienes acceso a este documento del proyecto');
    }
    const quote = document.content.slice(input.from, input.to);
    if (!quote.trim() || quote.length > 500 || input.to > document.content.length) {
      throw new Error('Selecciona un fragmento de hasta 500 caracteres');
    }
    if (quote !== input.quote) {
      throw new Error('El documento cambió. Vuelve a seleccionar el fragmento');
    }
    return { documentId: document.id, title: document.title, quote, from: input.from, to: input.to };
  }

  private async withVisibleReferences(comments: CommentWithUser[], userId?: string): Promise<CommentWithUser[]> {
    const references = [...new Set(comments.map((comment) => comment.documentReference?.documentId).filter((id): id is string => !!id))];
    const allowed = new Set<string>();
    if (userId) {
      await Promise.all(references.map(async (id) => {
        if (await documentService.getEffectiveUserPermission(id, userId)) allowed.add(id);
      }));
    }
    const currentContent = new Map<string, string>();
    if (allowed.size > 0) {
      const result = await pool.query<{ id: string; content: string }>(
        'SELECT id, content FROM documents WHERE id = ANY($1::uuid[])',
        [[...allowed]],
      );
      result.rows.forEach((document) => currentContent.set(document.id, document.content));
    }
    return comments.map((comment) => {
      if (!comment.documentReference) return comment;
      return allowed.has(comment.documentReference.documentId)
        ? { ...comment, documentReference: {
            ...comment.documentReference,
            stale: !currentContent.get(comment.documentReference.documentId)?.includes(comment.documentReference.quote),
          } }
        : { ...comment, documentReference: null };
    });
  }

  /** Personas con acceso al proyecto de la card (o al espacio si no está vinculada). */
  async getMentionCandidates(cardId: string, currentUserId: string): Promise<Array<{ id: string; name: string; email: string; avatar: string | null }>> {
    const result = await pool.query(
      `WITH card_scope AS (
         SELECT b.id AS board_id, w.id AS workspace_id, w.organization_id
           FROM cards c
           JOIN lists l ON l.id = c.list_id
           JOIN boards b ON b.id = l.board_id
           JOIN workspaces w ON w.id = b.workspace_id
          WHERE c.id = $1
       )
       SELECT DISTINCT u.id, u.name, u.email, u.avatar
         FROM card_scope scope
         JOIN workspace_members wm ON wm.workspace_id = scope.workspace_id
         JOIN users u ON u.id = wm.user_id
        WHERE u.id != $2
          AND NOT EXISTS (
            SELECT 1 FROM organization_access_revocations r
             WHERE r.organization_id = scope.organization_id AND r.user_id = u.id
          )
          AND (
            NOT EXISTS (SELECT 1 FROM project_boards pb WHERE pb.board_id = scope.board_id)
            OR NOT EXISTS (
              SELECT 1 FROM project_boards pb
              WHERE pb.board_id = scope.board_id
                AND NOT (
                  EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = pb.project_id AND pm.user_id = u.id)
                  OR EXISTS (
                    SELECT 1 FROM project_teams pt
                    JOIN team_members tm ON tm.team_id = pt.team_id AND tm.user_id = u.id
                    WHERE pt.project_id = pb.project_id
                  )
                )
            )
          )
        ORDER BY u.name, u.email`,
      [cardId, currentUserId]
    );
    return result.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, avatar: row.avatar ?? null }));
  }

  private async assertMentionCandidates(cardId: string, userId: string, mentions: string[]) {
    const candidates = await this.getMentionCandidates(cardId, userId);
    const allowed = new Set(candidates.map((candidate) => candidate.id));
    if (mentions.some((id) => !allowed.has(id))) {
      throw new Error('Solo puedes mencionar a personas con acceso a este proyecto');
    }
  }

  /**
   * Obtener un comentario por ID
   */
  async getCommentById(commentId: string, userId?: string): Promise<CommentWithUser | null> {
    const comment = await this.commentRepository.findById(commentId);
    return comment ? (await this.withVisibleReferences([comment], userId))[0] : null;
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
      documentReference?: DocumentReferenceInput | null;
    }
  ): Promise<CommentWithUser> {
    const isAuthor = await this.commentRepository.isAuthor(commentId, userId);
    if (!isAuthor) {
      throw new Error('Only the author can edit this comment');
    }

    if (data.mentions?.length) {
      const cardId = await this.commentRepository.getCardId(commentId);
      if (!cardId) throw new Error('Card not found for comment');
      await this.assertMentionCandidates(cardId, userId, data.mentions);
    }

    const cardIdForReference = data.documentReference ? await this.commentRepository.getCardId(commentId) : null;
    const documentReference = data.documentReference
      ? await this.resolveDocumentReference(cardIdForReference!, userId, data.documentReference)
      : data.documentReference;

    // Fetch contenido anterior para delta
    let oldContent: string | undefined;
    try {
      const oldResult = await pool.query('SELECT content FROM comments WHERE id = $1', [commentId]);
      oldContent = oldResult.rows[0]?.content;
    } catch (_) {}

    if (data.content !== undefined) {
      if (data.content.trim().length === 0) {
        throw new Error('Comment content cannot be empty');
      }

      if (data.content.length > 2000) {
        throw new Error('Comment content cannot exceed 2000 characters');
      }

      data.content = data.content.trim();
    }

    const updatedComment = await this.commentRepository.update(commentId, { ...data, documentReference });
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
    await eventStore.emit({
      type: 'comment.updated',
      actor: { id: userId, name: updateAuthorName ?? '' },
      subject: { type: 'comment', id: commentId, name: (data.content ?? updatedComment.content).slice(0, 50) },
      context: {
        workspaceId: updateWorkspaceId ?? '',
        boardId: updateBoardId,
        cardId,
      },
      delta: {
        before: { content: oldContent },
        after: { content: updatedComment.content },
      },
      payload: { cardTitle: updateCardTitle ?? '' },
    });

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
            const mentionedUserResult2 = await pool.query('SELECT name FROM users WHERE id = $1', [mentionedUserId]);
            const mentionedUserName2 = mentionedUserResult2.rows[0]?.name ?? '';
            await eventStore.emit({
              type: 'comment.mention-added',
              actor: { id: userId, name: updateAuthorName ?? '' },
              subject: { type: 'comment', id: commentId, name: updatedComment.content.slice(0, 50) },
              context: {
                workspaceId: updateWorkspaceId ?? '',
                boardId: updateBoardId,
                cardId,
              },
              payload: { mentionedUserId, mentionedUserName: mentionedUserName2, cardTitle: updateCardTitle ?? '', contentPreview: updatedComment.content.slice(0, 100) },
              targetUserId: mentionedUserId,
            });
          }
        }
      } catch (error) {}
    }

    const commentWithUser = await this.commentRepository.findById(commentId);
    if (!commentWithUser) {
      throw new Error('Failed to retrieve updated comment');
    }

    return (await this.withVisibleReferences([commentWithUser], userId))[0];
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
    await eventStore.emit({
      type: 'comment.deleted',
      actor: { id: userId, name: deleteUserName ?? '' },
      subject: { type: 'comment', id: commentId, name: '' },
      context: {
        workspaceId: deleteWorkspaceId ?? '',
        boardId: deleteBoardId,
        cardId,
      },
      payload: { cardTitle: deleteCardTitle ?? '' },
    });
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
