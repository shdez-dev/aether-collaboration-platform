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
    cardId: string;
    commentId: string;
  }): Promise<boolean> {
    const result = await query(
      `SELECT id FROM notifications
       WHERE user_id = $1
         AND type = $2
         AND data->>'cardId' = $3
         AND data->>'commentId' = $4
         AND created_at > NOW() - INTERVAL '5 minutes'
       LIMIT 1`,
      [data.userId, data.type, data.cardId, data.commentId]
    );

    return result.rows.length > 0;
  }
}

export const notificationRepository = new NotificationRepository();
