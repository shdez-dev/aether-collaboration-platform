import { query } from '../lib/db';
import type { Notification } from '@aether/types';

export type NotificationListOptions = {
  onlyUnread?: boolean;
  includeArchived?: boolean;
  includeResolved?: boolean;
  limit?: number;
};

type CreateNotificationData = {
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  /** Every producer owns its event key; repositories never guess it from JSON. */
  dedupeKey: string;
};

export class NotificationRepository {
  private readonly selectColumns = `
    id, user_id as "userId", type, title, message, data, read,
    read_at as "readAt", archived_at as "archivedAt", resolved_at as "resolvedAt",
    created_at as "createdAt"`;

  /**
   * Inserts a current actionable notification once. A retry is the same event,
   * not a request to re-open, unarchive, or mark the existing row unread.
   */
  async upsertActive(data: CreateNotificationData): Promise<Notification | null> {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data, dedupe_key, read, read_at, archived_at, resolved_at)
       SELECT $1, $2, $3, $4, $5, $6, FALSE, NULL, NULL, NULL
       WHERE COALESCE((SELECT in_app_notifications FROM user_preferences WHERE user_id = $1), TRUE)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL
       DO NOTHING
       RETURNING ${this.selectColumns}`,
      [data.userId, data.type, data.title, data.message, JSON.stringify(data.data), data.dedupeKey],
    );
    return result.rows[0] ?? null;
  }

  /** Inserts a historical event exactly once across concurrent workers. */
  async createOnce(data: CreateNotificationData): Promise<Notification | null> {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data, dedupe_key)
       SELECT $1, $2, $3, $4, $5, $6
       WHERE COALESCE((SELECT in_app_notifications FROM user_preferences WHERE user_id = $1), TRUE)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING ${this.selectColumns}`,
      [data.userId, data.type, data.title, data.message, JSON.stringify(data.data), data.dedupeKey],
    );
    return result.rows[0] ?? null;
  }

  async findByUserId(userId: string, options: NotificationListOptions = {}): Promise<Notification[]> {
    const { onlyUnread = false, includeArchived = false, includeResolved = false, limit = 50 } = options;
    const result = await query(
      `SELECT ${this.selectColumns}
       FROM notifications
       WHERE user_id = $1
         AND ($2::boolean OR archived_at IS NULL)
         AND ($3::boolean OR resolved_at IS NULL)
         AND (NOT $4::boolean OR read = FALSE)
       ORDER BY created_at DESC, id DESC
       LIMIT $5`,
      [userId, includeArchived, includeResolved, onlyUnread, Math.min(Math.max(limit, 1), 100)],
    );
    return result.rows;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await query(
      `UPDATE notifications SET read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await query(
      `UPDATE notifications SET read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1 AND read = FALSE AND archived_at IS NULL`,
      [userId],
    );
  }

  async archive(notificationId: string, userId: string): Promise<void> {
    await query(`UPDATE notifications SET archived_at = COALESCE(archived_at, NOW()) WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
  }

  async restore(notificationId: string, userId: string): Promise<void> {
    await query(`UPDATE notifications SET archived_at = NULL WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
  }

  async resolve(notificationId: string, userId: string): Promise<void> {
    await query(
      `UPDATE notifications
       SET resolved_at = COALESCE(resolved_at, NOW()), read = TRUE, read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId],
    );
  }

  async reopen(notificationId: string, userId: string): Promise<void> {
    await query(`UPDATE notifications SET resolved_at = NULL WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE user_id = $1 AND read = FALSE AND archived_at IS NULL AND resolved_at IS NULL`,
      [userId],
    );
    return result.rows[0]?.count ?? 0;
  }

  /** Kept for compatibility while the UI transitions from delete to archive. */
  async delete(notificationId: string, userId: string): Promise<void> {
    await query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [notificationId, userId]);
  }

  async deleteAllRead(userId: string): Promise<void> {
    await query(`DELETE FROM notifications WHERE user_id = $1 AND read = TRUE AND archived_at IS NOT NULL`, [userId]);
  }
}

export const notificationRepository = new NotificationRepository();
