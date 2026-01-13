// apps/api/src/services/NotificationService.ts

import { notificationRepository } from '../repositories/NotificationRepository';
import { eventStore } from './EventStoreService';
import type { Notification } from '@aether/types';

export class NotificationService {
  /**
   * Crear notificación para mención en comentario
   */
  async createMentionNotification(data: {
    mentionedUserId: string;
    authorId: string;
    authorName: string;
    cardId: string;
    cardTitle: string;
    commentId: string;
    commentPreview: string;
  }): Promise<Notification | null> {
    // Evitar notificarse a sí mismo
    if (data.mentionedUserId === data.authorId) {
      console.log('[NotificationService] Skipping self-mention notification');
      return null;
    }

    // Evitar duplicados recientes
    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.mentionedUserId,
      type: 'COMMENT_MENTION',
      cardId: data.cardId,
      commentId: data.commentId,
    });

    if (isDuplicate) {
      console.log('[NotificationService] Duplicate notification, skipping');
      return null;
    }

    // Crear notificación
    const notification = await notificationRepository.create({
      userId: data.mentionedUserId,
      type: 'COMMENT_MENTION',
      title: 'Te mencionaron en un comentario',
      message: `${data.authorName} te mencionó en "${data.cardTitle}"`,
      data: {
        cardId: data.cardId,
        cardTitle: data.cardTitle,
        commentId: data.commentId,
        commentPreview: data.commentPreview.substring(0, 100),
        authorId: data.authorId,
        authorName: data.authorName,
      },
    });

    console.log('[NotificationService] Created mention notification:', notification.id);

    // Emitir evento WebSocket para notificación en tiempo real
    try {
      await eventStore.emit(
        'notification.created',
        {
          notificationId: notification.id,
          userId: data.mentionedUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        data.authorId as any,
        undefined, // No hay boardId para notificaciones
        undefined // No hay socketId
      );
    } catch (error) {
      console.error('[NotificationService] Error emitting notification.created event:', error);
    }

    return notification;
  }

  /**
   * Obtener todas las notificaciones de un usuario
   */
  async getNotifications(userId: string, onlyUnread: boolean = false): Promise<Notification[]> {
    if (onlyUnread) {
      return notificationRepository.findUnreadByUserId(userId);
    }
    return notificationRepository.findByUserId(userId);
  }

  /**
   * Marcar notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.markAsRead(notificationId, userId);

    console.log('[NotificationService] Marked notification as read:', notificationId);

    // Emitir evento para actualizar contador en tiempo real
    const unreadCount = await notificationRepository.getUnreadCount(userId);

    try {
      await eventStore.emit(
        'notification.read',
        {
          notificationId,
          unreadCount,
        },
        userId as any,
        undefined,
        undefined
      );
    } catch (error) {
      console.error('[NotificationService] Error emitting notification.read event:', error);
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string): Promise<void> {
    await notificationRepository.markAllAsRead(userId);

    console.log('[NotificationService] Marked all notifications as read for user:', userId);

    // Emitir evento
    try {
      await eventStore.emit(
        'notification.read_all' as any,
        {
          unreadCount: 0,
        },
        userId as any,
        undefined,
        undefined
      );
    } catch (error) {
      console.error('[NotificationService] Error emitting notification.read_all event:', error);
    }
  }

  /**
   * Obtener contador de notificaciones no leídas
   */
  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.getUnreadCount(userId);
  }

  /**
   * Eliminar una notificación
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.delete(notificationId, userId);

    console.log('[NotificationService] Deleted notification:', notificationId);

    // Actualizar contador
    const unreadCount = await notificationRepository.getUnreadCount(userId);

    try {
      await eventStore.emit(
        'notification.deleted',
        {
          notificationId,
          unreadCount,
        },
        userId as any,
        undefined,
        undefined
      );
    } catch (error) {
      console.error('[NotificationService] Error emitting notification.deleted event:', error);
    }
  }

  /**
   * Limpiar notificaciones leídas antiguas
   */
  async cleanupReadNotifications(userId: string): Promise<void> {
    await notificationRepository.deleteAllRead(userId);
    console.log('[NotificationService] Cleaned up read notifications for user:', userId);
  }
}

export const notificationService = new NotificationService();
