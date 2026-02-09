// apps/api/src/services/UserActivityService.ts

import { pool } from '../lib/db';
import type { EventType, UserId } from '@aether/types';

export class UserActivityService {
  /**
   * Registrar actividad del usuario
   */
  async logActivity(
    userId: UserId,
    activityType: string,
    metadata?: Record<string, any>,
    boardId?: string,
    workspaceId?: string
  ): Promise<void> {
    try {
      const isDeletionEvent = activityType.includes('.deleted');

      await pool.query(
        `INSERT INTO user_activity_log (user_id, activity_type, metadata, board_id, workspace_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          userId,
          activityType,
          metadata ? JSON.stringify(metadata) : null,
          isDeletionEvent ? null : boardId || null,
          isDeletionEvent ? null : workspaceId || null,
        ]
      );

    } catch (error) {
    }
  }

  /**
   * Determinar si un evento debe registrarse como actividad
   */
  shouldLogActivity(eventType: string): boolean {
    const relevantEvents = [
      'workspace.created',
      'workspace.updated',
      'workspace.deleted',
      'board.created',
      'board.updated',
      'board.archived',
      'board.deleted',
      'list.created',
      'list.updated',
      'list.reordered',
      'list.deleted',
      'card.created',
      'card.updated',
      'card.moved',
      'card.deleted',
      'comment.created',
      'comment.updated',
      'comment.deleted',
      'card.member.assigned',
      'card.member.unassigned',
      'card.label.added',
      'card.label.removed',
    ];

    return relevantEvents.includes(eventType);
  }

  /**
   * Obtener nombres de listas para eventos de movimiento
   */
  private async getListNames(
    fromListId?: string,
    toListId?: string
  ): Promise<{ fromList?: string; toList?: string }> {
    try {
      const listIds = [fromListId, toListId].filter(Boolean);
      if (listIds.length === 0) return {};

      const result = await pool.query(`SELECT id, name FROM lists WHERE id = ANY($1)`, [listIds]);

      const listMap = new Map(result.rows.map((row) => [row.id, row.name]));

      return {
        fromList: fromListId ? listMap.get(fromListId) : undefined,
        toList: toListId ? listMap.get(toListId) : undefined,
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Procesar evento y registrar actividad si es relevante
   */
  async processEvent(eventType: string, payload: any, userId: UserId): Promise<void> {
    if (!this.shouldLogActivity(eventType)) {
      return;
    }

    const boardId = payload.boardId || null;
    const workspaceId = payload.workspaceId || null;

    const metadata = await this.extractRelevantMetadata(eventType, payload);

    await this.logActivity(userId, eventType, metadata, boardId, workspaceId);
  }

  /**
   * Obtener información adicional para los eventos
   */
  private async getCardTitle(cardId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT title FROM cards WHERE id = $1', [cardId]);
      return result.rows[0]?.title;
    } catch (error) {
      return undefined;
    }
  }

  private async getMemberName(userId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      return result.rows[0]?.name;
    } catch (error) {
      return undefined;
    }
  }

  private async getLabelInfo(labelId: string): Promise<{ name?: string; color?: string }> {
    try {
      const result = await pool.query('SELECT name, color FROM labels WHERE id = $1', [labelId]);
      return {
        name: result.rows[0]?.name,
        color: result.rows[0]?.color,
      };
    } catch (error) {
      return {};
    }
  }

  private async getBoardTitle(boardId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT title FROM boards WHERE id = $1', [boardId]);
      return result.rows[0]?.title;
    } catch (error) {
      return undefined;
    }
  }

  private async getListName(listId: string): Promise<string | undefined> {
    try {
      const result = await pool.query('SELECT name FROM lists WHERE id = $1', [listId]);
      return result.rows[0]?.name;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extraer metadata relevante del payload según el tipo de evento
   */
  private async extractRelevantMetadata(
    eventType: string,
    payload: any
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};

    switch (eventType) {
      case 'workspace.created':
        metadata.name = payload.name;
        metadata.description = payload.description;
        metadata.icon = payload.icon;
        metadata.color = payload.color;
        break;

      case 'workspace.updated':
        metadata.name = payload.name;
        metadata.description = payload.description;
        metadata.changes = payload.changes;
        break;

      case 'workspace.deleted':
        metadata.workspaceId = payload.workspaceId;
        metadata.name = payload.name;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'board.created':
        metadata.title = payload.title || payload.name;
        metadata.name = payload.title || payload.name;
        metadata.description = payload.description;
        metadata.boardId = payload.boardId;
        break;

      case 'board.updated':
        metadata.title = payload.title || payload.name;
        metadata.name = payload.title || payload.name;
        metadata.boardId = payload.boardId;
        metadata.changes = payload.changes;
        break;

      case 'board.deleted':
        metadata.boardId = payload.boardId;
        metadata.title = payload.title;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'board.archived':
        metadata.boardId = payload.boardId;
        metadata.title = payload.title;
        metadata.archivedBy = payload.archivedBy;
        // Obtener título del board si no está en el payload
        if (!metadata.title && payload.boardId) {
          metadata.title = await this.getBoardTitle(payload.boardId);
        }
        break;

      case 'list.created':
        metadata.name = payload.name;
        metadata.listId = payload.listId;
        metadata.boardId = payload.boardId;
        // Obtener título del board para contexto
        if (payload.boardId) {
          metadata.boardTitle = await this.getBoardTitle(payload.boardId);
        }
        break;

      case 'list.updated':
        metadata.name = payload.name;
        metadata.listId = payload.listId;
        metadata.oldName = payload.oldName;
        break;

      case 'list.reordered':
        metadata.listId = payload.listId;
        metadata.name = payload.name;
        metadata.oldPosition = payload.oldPosition;
        metadata.newPosition = payload.newPosition;
        // Obtener nombre de la lista si no está en el payload
        if (!metadata.name && payload.listId) {
          metadata.name = await this.getListName(payload.listId);
        }
        break;

      case 'list.deleted':
        metadata.listId = payload.listId;
        metadata.name = payload.name;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.created':
        metadata.title = payload.title;
        metadata.cardId = payload.cardId;
        metadata.listId = payload.listId;
        // Obtener nombre de la lista para contexto
        if (payload.listId) {
          metadata.listName = await this.getListName(payload.listId);
        }
        break;

      case 'card.updated':
        metadata.title = payload.title;
        metadata.cardId = payload.cardId;
        metadata.listId = payload.listId;
        metadata.changes = payload.changes;
        break;

      case 'card.deleted':
        metadata.cardId = payload.cardId;
        metadata.listId = payload.listId;
        metadata.title = payload.title;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.moved':
        metadata.title = payload.title;
        metadata.cardId = payload.cardId;
        metadata.fromListId = payload.fromListId;
        metadata.toListId = payload.toListId;
        metadata.fromPosition = payload.fromPosition;
        metadata.toPosition = payload.toPosition;

        const listNames = await this.getListNames(payload.fromListId, payload.toListId);
        if (listNames.fromList) metadata.fromListName = listNames.fromList;
        if (listNames.toList) metadata.toListName = listNames.toList;
        break;

      case 'comment.created':
        metadata.cardId = payload.cardId;
        metadata.commentId = payload.commentId;
        metadata.contentPreview = payload.content?.substring(0, 100);
        // Obtener título de la tarjeta
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      case 'comment.updated':
        metadata.cardId = payload.cardId;
        metadata.commentId = payload.commentId;
        metadata.contentPreview = payload.content?.substring(0, 100);
        break;

      case 'comment.deleted':
        metadata.commentId = payload.commentId;
        metadata.cardId = payload.cardId;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.member.assigned':
        metadata.cardId = payload.cardId;
        metadata.memberId = payload.userId || payload.memberId;
        // Obtener nombre del miembro y título de la tarjeta
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      case 'card.member.unassigned':
        metadata.cardId = payload.cardId;
        metadata.memberId = payload.userId || payload.memberId;
        // Obtener nombre del miembro y título de la tarjeta
        if (metadata.memberId) {
          metadata.memberName = await this.getMemberName(metadata.memberId);
        }
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      case 'card.label.added':
        metadata.cardId = payload.cardId;
        metadata.labelId = payload.labelId;
        // Obtener info de la etiqueta y título de la tarjeta
        if (payload.labelId) {
          const labelInfo = await this.getLabelInfo(payload.labelId);
          metadata.labelName = labelInfo.name;
          metadata.labelColor = labelInfo.color;
        }
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      case 'card.label.removed':
        metadata.cardId = payload.cardId;
        metadata.labelId = payload.labelId;
        // Obtener info de la etiqueta y título de la tarjeta
        if (payload.labelId) {
          const labelInfo = await this.getLabelInfo(payload.labelId);
          metadata.labelName = labelInfo.name;
          metadata.labelColor = labelInfo.color;
        }
        if (payload.cardId) {
          metadata.cardTitle = await this.getCardTitle(payload.cardId);
        }
        break;

      default:
        return payload;
    }

    return metadata;
  }

  /**
   * Obtener actividad reciente del usuario
   */
  async getUserActivity(userId: UserId, limit = 20): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
          id,
          user_id,
          activity_type,
          metadata,
          board_id,
          workspace_id,
          created_at
         FROM user_activity_log
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Obtener actividad de un board
   */
  async getBoardActivity(boardId: string, limit = 50): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
          ual.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar as user_avatar
         FROM user_activity_log ual
         JOIN users u ON u.id = ual.user_id
         WHERE ual.board_id = $1
         ORDER BY ual.created_at DESC
         LIMIT $2`,
        [boardId, limit]
      );

      return result.rows;
    } catch (error) {
      return [];
    }
  }

  /**
   * Obtener actividad de un workspace
   */
  async getWorkspaceActivity(workspaceId: string, limit = 50): Promise<any[]> {
    try {
      const result = await pool.query(
        `SELECT 
          ual.*,
          u.name as user_name,
          u.email as user_email,
          u.avatar as user_avatar
         FROM user_activity_log ual
         JOIN users u ON u.id = ual.user_id
         WHERE ual.workspace_id = $1
         ORDER BY ual.created_at DESC
         LIMIT $2`,
        [workspaceId, limit]
      );

      return result.rows;
    } catch (error) {
      return [];
    }
  }
}

export const userActivityService = new UserActivityService();
