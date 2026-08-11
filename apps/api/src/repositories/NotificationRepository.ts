// apps/api/src/repositories/NotificationRepository.ts

import { query } from '../lib/db';
import type { Notification } from '@aether/types';

export class NotificationRepository {
  private logicalKey(data: Record<string, any>): string | null {
    const key = data.commentId ?? data.invitationId ?? data.cardId ?? data.documentId ?? data.milestoneId ?? data.projectId ?? data.teamId ?? data.workspaceId;
    return key ? `${String(data.type ?? 'notification')}:${key}` : null;
  }

  private readonly logicalKeySql = `COALESCE(
    data->>'commentId', data->>'invitationId', data->>'cardId', data->>'documentId',
    data->>'milestoneId', data->>'projectId', data->>'teamId', data->>'workspaceId',
    dedupe_key, id::text
  )`;

  private readonly selectColumns = `id, user_id as "userId", type, title, message, data, read, created_at as "createdAt"`;
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
    const dedupeKey = this.logicalKey({ type: data.type, ...data.data });
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
       DO UPDATE SET title = EXCLUDED.title, message = EXCLUDED.message,
                     data = EXCLUDED.data, read = FALSE, created_at = NOW()
       RETURNING 
         ${this.selectColumns}`,
      [data.userId, data.type, data.title, data.message, JSON.stringify(data.data), dedupeKey]
    );

    return result.rows[0];
  }

  /**
   * Atomically creates an idempotent notification. The partial unique index on
   * (user_id, dedupe_key) is the concurrency boundary for cron workers.
   */
  async createOnce(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    data: Record<string, any>;
    dedupeKey: string;
  }): Promise<Notification | null> {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING
         ${this.selectColumns}`,
      [data.userId, data.type, data.title, data.message, JSON.stringify(data.data), data.dedupeKey]
    );

    return result.rows[0] ?? null;
  }

  /**
   * Obtener todas las notificaciones de un usuario
   */
  async findByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const result = await query(
      `WITH ranked AS (
         SELECT ${this.selectColumns}, ROW_NUMBER() OVER (
           PARTITION BY type || ':' || ${this.logicalKeySql} ORDER BY created_at DESC
         ) AS rn
         FROM notifications WHERE user_id = $1
       ) SELECT ${this.selectColumns} FROM ranked WHERE rn = 1 ORDER BY "createdAt" DESC LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Obtener solo notificaciones no leídas
   */
  async findUnreadByUserId(userId: string, limit: number = 50): Promise<Notification[]> {
    const result = await query(
      `WITH ranked AS (
         SELECT ${this.selectColumns}, ROW_NUMBER() OVER (
           PARTITION BY type || ':' || ${this.logicalKeySql} ORDER BY created_at DESC
         ) AS rn
         FROM notifications WHERE user_id = $1
       ) SELECT ${this.selectColumns} FROM ranked WHERE rn = 1 AND read = FALSE ORDER BY "createdAt" DESC LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Marcar una notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await query(
      `UPDATE notifications n SET read = TRUE
       WHERE n.user_id = $2 AND (n.id = $1 OR (n.type || ':' || ${this.logicalKeySql}) = (
         SELECT type || ':' || ${this.logicalKeySql} FROM notifications WHERE id = $1 AND user_id = $2
       ))`,
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
      `WITH ranked AS (
         SELECT read, ROW_NUMBER() OVER (
           PARTITION BY type || ':' || ${this.logicalKeySql} ORDER BY created_at DESC
         ) AS rn FROM notifications WHERE user_id = $1
       ) SELECT COUNT(*) as count FROM ranked WHERE rn = 1 AND read = FALSE`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Eliminar una notificación
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    await query(
      `DELETE FROM notifications n
       WHERE n.user_id = $2 AND (n.id = $1 OR (n.type || ':' || ${this.logicalKeySql}) = (
         SELECT type || ':' || ${this.logicalKeySql} FROM notifications WHERE id = $1 AND user_id = $2
       ))`,
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
    windowMinutes?: number;
  }): Promise<boolean> {
    const window = data.windowMinutes ?? 5;
    let queryText = `SELECT id FROM notifications
       WHERE user_id = $1
         AND type = $2
         AND created_at > NOW() - ($3 * INTERVAL '1 minute')`;

    const params: any[] = [data.userId, data.type, window];
    let paramIndex = 4;

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
