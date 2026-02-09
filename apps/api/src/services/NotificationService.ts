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
        data.authorId as any, // userId: quien genera el evento
        undefined, // boardId: no aplica
        undefined, // socketId: no aplica
        data.mentionedUserId as any // targetUserId: quien recibe la notificación
      );
    } catch (error) {}

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
    } catch (error) {}
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string): Promise<void> {
    await notificationRepository.markAllAsRead(userId);

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
    } catch (error) {}
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
    } catch (error) {}
  }

  /**
   * Crear notificación de invitación a workspace
   */
  async createWorkspaceInviteNotification(data: {
    userId: string;
    workspaceId: string;
    workspaceName: string;
    inviterId: string;
    inviterName: string;
  }): Promise<Notification | null> {
    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'WORKSPACE_INVITE',
      title: 'Invitación a workspace',
      message: `${data.inviterName} te ha invitado a unirte a "${data.workspaceName}"`,
      data: {
        workspaceId: data.workspaceId,
        workspaceName: data.workspaceName,
        inviterId: data.inviterId,
        inviterName: data.inviterName,
      },
    });

    try {
      await eventStore.emit(
        'notification.created',
        {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        data.inviterId as any, // userId: quien genera el evento (el que invita)
        undefined, // boardId: no aplica
        undefined, // socketId: no aplica
        data.userId as any // targetUserId: quien recibe la notificación (el invitado)
      );
    } catch (error) {}

    return notification;
  }

  /**
   * Crear notificación de asignación de tarjeta
   */
  async createCardAssignedNotification(data: {
    assignedUserId: string;
    assignerId: string;
    assignerName: string;
    cardId: string;
    cardTitle: string;
    boardId: string;
  }): Promise<Notification | null> {
    // Evitar notificarse a sí mismo
    if (data.assignedUserId === data.assignerId) {
      return null;
    }

    // Evitar duplicados recientes
    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.assignedUserId,
      type: 'CARD_ASSIGNED',
      cardId: data.cardId,
    });

    if (isDuplicate) {
      return null;
    }

    const notification = await notificationRepository.create({
      userId: data.assignedUserId,
      type: 'CARD_ASSIGNED',
      title: 'Te asignaron una tarjeta',
      message: `${data.assignerName} te asignó la tarjeta "${data.cardTitle}"`,
      data: {
        cardId: data.cardId,
        cardTitle: data.cardTitle,
        boardId: data.boardId,
        assignerId: data.assignerId,
        assignerName: data.assignerName,
      },
    });

    try {
      await eventStore.emit(
        'notification.created',
        {
          notificationId: notification.id,
          userId: data.assignedUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        data.assignerId as any, // userId: quien asigna
        undefined, // boardId: no aplica
        undefined, // socketId: no aplica
        data.assignedUserId as any // targetUserId: quien recibe la asignación
      );
    } catch (error) {}

    return notification;
  }

  /**
   * Crear notificación de tarjeta por vencer
   */
  async createCardDueSoonNotification(data: {
    userId: string;
    cardId: string;
    cardTitle: string;
    dueDate: Date;
    boardId: string;
  }): Promise<Notification | null> {
    // Evitar duplicados recientes (últimas 24 horas)
    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.userId,
      type: 'CARD_DUE_SOON',
      cardId: data.cardId,
    });

    if (isDuplicate) {
      return null;
    }

    const daysUntilDue = Math.ceil((data.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'CARD_DUE_SOON',
      title: 'Tarjeta por vencer',
      message: `La tarjeta "${data.cardTitle}" vence en ${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''}`,
      data: {
        cardId: data.cardId,
        cardTitle: data.cardTitle,
        dueDate: data.dueDate.toISOString(),
        boardId: data.boardId,
        daysUntilDue,
      },
    });

    try {
      await eventStore.emit(
        'notification.created',
        {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        'system' as any, // userId: sistema
        undefined, // boardId: no aplica
        undefined, // socketId: no aplica
        data.userId as any // targetUserId: usuario que recibe la notificación
      );
    } catch (error) {}

    return notification;
  }

  /**
   * Crear notificación de tarjeta vencida
   */
  async createCardOverdueNotification(data: {
    userId: string;
    cardId: string;
    cardTitle: string;
    dueDate: Date;
    boardId: string;
  }): Promise<Notification | null> {
    // Evitar duplicados recientes
    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.userId,
      type: 'CARD_OVERDUE',
      cardId: data.cardId,
    });

    if (isDuplicate) {
      return null;
    }

    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'CARD_OVERDUE',
      title: '¡Tarjeta vencida!',
      message: `La tarjeta "${data.cardTitle}" ha vencido`,
      data: {
        cardId: data.cardId,
        cardTitle: data.cardTitle,
        dueDate: data.dueDate.toISOString(),
        boardId: data.boardId,
      },
    });

    try {
      await eventStore.emit(
        'notification.created',
        {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        'system' as any, // userId: sistema
        undefined, // boardId: no aplica
        undefined, // socketId: no aplica
        data.userId as any // targetUserId: usuario que recibe la notificación
      );
    } catch (error) {}

    return notification;
  }

  /**
   * Crear notificación de nuevo comentario en tarjeta
   */
  async createCommentNotification(data: {
    cardMembers: string[];
    authorId: string;
    authorName: string;
    cardId: string;
    cardTitle: string;
    commentId: string;
    commentPreview: string;
  }): Promise<void> {
    // Notificar a todos los miembros de la tarjeta excepto el autor
    const membersToNotify = data.cardMembers.filter((memberId) => memberId !== data.authorId);

    for (const memberId of membersToNotify) {
      // Evitar duplicados recientes
      const isDuplicate = await notificationRepository.existsRecent({
        userId: memberId,
        type: 'COMMENT_ADDED',
        cardId: data.cardId,
        commentId: data.commentId,
      });

      if (isDuplicate) {
        continue;
      }

      const notification = await notificationRepository.create({
        userId: memberId,
        type: 'COMMENT_ADDED',
        title: 'Nuevo comentario',
        message: `${data.authorName} comentó en "${data.cardTitle}"`,
        data: {
          cardId: data.cardId,
          cardTitle: data.cardTitle,
          commentId: data.commentId,
          commentPreview: data.commentPreview.substring(0, 100),
          authorId: data.authorId,
          authorName: data.authorName,
        },
      });

      try {
        await eventStore.emit(
          'notification.created',
          {
            notificationId: notification.id,
            userId: memberId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
          },
          data.authorId as any, // userId: quien genera el evento (autor del comentario)
          undefined, // boardId: no aplica
          undefined, // socketId: no aplica
          memberId as any // targetUserId: miembro que recibe la notificación
        );
      } catch (error) {}
    }
  }

  /**
   * Limpiar notificaciones leídas antiguas
   */
  async cleanupReadNotifications(userId: string): Promise<void> {
    await notificationRepository.deleteAllRead(userId);
  }
}

export const notificationService = new NotificationService();
