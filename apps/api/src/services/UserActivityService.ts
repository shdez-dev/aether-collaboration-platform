// apps/api/src/services/UserActivityService.ts

import { pool } from '../lib/db';
import type { EventType, UserId } from '@aether/types';

/**
 * User Activity Service
 * Registra actividad relevante del usuario en user_activity_log
 * para mostrar en el dashboard y analytics
 */
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
      // No registrar foreign keys en eventos de eliminación
      // porque los recursos ya no existen en la base de datos
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

      console.log(`[UserActivity] ✅ Logged: ${activityType} for user ${userId}`);
    } catch (error) {
      console.error('[UserActivity] ❌ Error logging activity:', error);
      // No lanzar error, solo logear
    }
  }

  /**
   * Determinar si un evento debe registrarse como actividad
   */
  shouldLogActivity(eventType: string): boolean {
    const relevantEvents = [
      // Workspaces
      'workspace.created',
      'workspace.updated',
      'workspace.deleted',

      // Boards
      'board.created',
      'board.updated',
      'board.archived',
      'board.deleted',

      // Lists
      'list.created',
      'list.updated',
      'list.deleted',

      // Cards
      'card.created',
      'card.updated',
      'card.moved',
      'card.deleted',

      // Comments
      'comment.created',
      'comment.updated',
      'comment.deleted',

      // Card Members
      'card.member.assigned',
      'card.member.removed',

      // Card Labels
      'card.label.assigned',
      'card.label.removed',
    ];

    return relevantEvents.includes(eventType);
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

    // Extraer metadata relevante según el tipo de evento
    const metadata = this.extractRelevantMetadata(eventType, payload);

    await this.logActivity(userId, eventType, metadata, boardId, workspaceId);
  }

  /**
   * Extraer metadata relevante del payload según el tipo de evento
   */
  private extractRelevantMetadata(eventType: string, payload: any): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Según el tipo de evento, extraer datos relevantes
    switch (eventType) {
      case 'workspace.created':
      case 'workspace.updated':
        metadata.name = payload.name;
        break;

      case 'workspace.deleted':
        // Para eventos de eliminación, solo guardamos el ID en metadata
        metadata.workspaceId = payload.workspaceId;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'board.created':
      case 'board.updated':
        metadata.title = payload.title || payload.name;
        break;

      case 'board.deleted':
        metadata.boardId = payload.boardId;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'list.created':
      case 'list.updated':
        metadata.name = payload.name;
        break;

      case 'list.deleted':
        metadata.listId = payload.listId;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.created':
      case 'card.updated':
        metadata.title = payload.title;
        metadata.listId = payload.listId;
        break;

      case 'card.deleted':
        metadata.cardId = payload.cardId;
        metadata.listId = payload.listId;
        metadata.deletedBy = payload.deletedBy;
        break;

      case 'card.moved':
        metadata.title = payload.title;
        metadata.fromListId = payload.fromListId;
        metadata.toListId = payload.toListId;
        break;

      case 'comment.created':
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
      case 'card.member.removed':
        metadata.cardId = payload.cardId;
        metadata.memberId = payload.userId;
        break;

      case 'card.label.assigned':
      case 'card.label.removed':
        metadata.cardId = payload.cardId;
        metadata.labelId = payload.labelId;
        break;

      default:
        // Para otros eventos, guardar todo el payload
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
      console.error('[UserActivity] Error getting user activity:', error);
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
      console.error('[UserActivity] Error getting board activity:', error);
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
      console.error('[UserActivity] Error getting workspace activity:', error);
      return [];
    }
  }
}

export const userActivityService = new UserActivityService();
