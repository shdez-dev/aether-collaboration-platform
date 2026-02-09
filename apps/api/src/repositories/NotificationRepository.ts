// apps/api/src/repositories/NotificationRepository.ts

import { query } from '../lib/db';
import type { Notification } from '@aether/types';

export class NotificationRepository {
  /**
   * Crear una nueva notificación
   */
  async create(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data: Record<string, any>;
  }): Promise<Notification> {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING 
         id,
         user_id as "userId",
         type,
         title,
         message,
         data,
         read,
         created_at as "createdAt"`,
      [data.userId, data.type, data.title, data.message, JSON.stringify(data.data)]
    );

    return result.rows[0];
  }

  /**
   * Obtener todas las notificaciones de un usuario
   */
  async findByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const result = await query(
      `SELECT 
         id,
         user_id as "userId",
         type,
         title,
         message,
         data,
         read,
         created_at as "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Obtener solo notificaciones no leídas
   */
  async findUnreadByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const result = await query(
      `SELECT 
         id,
         user_id as "userId",
         type,
         title,
         message,
         data,
         read,
         created_at as "createdAt"
       FROM notifications
       WHERE user_id = $1 AND read = FALSE
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Marcar una notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await query(
      `UPDATE notifications 
       SET read = TRUE 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  }

  /**
   * Marcar todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(userId: string): Promise<void> {
    await query(
      `UPDATE notifications 
       SET read = TRUE 
       WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Eliminar una notificación
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    await query(
      `DELETE FROM notifications 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  }

  /**
   * Eliminar todas las notificaciones leídas de un usuario
   */
  async deleteAllRead(userId: string): Promise<void> {
    await query(
      `DELETE FROM notifications 
       WHERE user_id = $1 AND read = TRUE`,
      [userId]
    );
  }

  /**
   * Verificar si existe una notificación duplicada reciente (últimos 5 minutos)
   */
  async existsRecent(data: {
    userId: string;
    type: string;
    cardId?: string;
    commentId?: string;
    workspaceId?: string;
  }): Promise<boolean> {
    let queryText = `SELECT id FROM notifications
       WHERE user_id = $1
         AND type = $2
         AND created_at > NOW() - INTERVAL '5 minutes'`;

    const params: any[] = [data.userId, data.type];
    let paramIndex = 3;

    if (data.cardId) {
      queryText += ` AND data->>'cardId' = $${paramIndex}`;
      params.push(data.cardId);
      paramIndex++;
    }

    if (data.commentId) {
      queryText += ` AND data->>'commentId' = $${paramIndex}`;
      params.push(data.commentId);
      paramIndex++;
    }

    if (data.workspaceId) {
      queryText += ` AND data->>'workspaceId' = $${paramIndex}`;
      params.push(data.workspaceId);
      paramIndex++;
    }

    queryText += ' LIMIT 1';

    const result = await query(queryText, params);

    return result.rows.length > 0;
  }
}

export const notificationRepository = new NotificationRepository();
