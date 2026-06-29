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
    boardId?: string;
    workspaceId?: string;
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
        boardId: data.boardId,
        workspaceId: data.workspaceId,
      },
    });

    // Emitir evento WebSocket para notificación en tiempo real
    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.authorId, name: data.authorName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: data.workspaceId ?? '' },
        payload: {
          notificationId: notification.id,
          userId: data.mentionedUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.mentionedUserId,
      } as any);
    } catch (error) {}

    return notification;
  }

  /**
   * Crear notificación para mención en comentario de documento
   */
  async createDocumentMentionNotification(data: {
    mentionedUserId: string;
    authorId: string;
    authorName: string;
    documentId: string;
    documentTitle: string;
    commentId: string;
    commentPreview: string;
  }): Promise<Notification | null> {
    if (data.mentionedUserId === data.authorId) {
      return null;
    }

    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.mentionedUserId,
      type: 'DOCUMENT_MENTION',
      commentId: data.commentId,
    });

    if (isDuplicate) {
      return null;
    }

    const notification = await notificationRepository.create({
      userId: data.mentionedUserId,
      type: 'DOCUMENT_MENTION',
      title: 'Te mencionaron en un documento',
      message: `${data.authorName} te mencionó en "${data.documentTitle}"`,
      data: {
        documentId: data.documentId,
        documentTitle: data.documentTitle,
        commentId: data.commentId,
        commentPreview: data.commentPreview.substring(0, 100),
        authorId: data.authorId,
        authorName: data.authorName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.authorId, name: data.authorName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: data.mentionedUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.mentionedUserId,
      } as any);
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
      await eventStore.emit({
        type: 'notification.read',
        actor: { id: userId, name: '' },
        subject: { type: 'notification', id: notificationId, name: '' },
        context: { workspaceId: '' },
        payload: { notificationId, unreadCount },
        targetUserId: userId,
      } as any);
    } catch (error) {}
  }

  /**
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(userId: string): Promise<void> {
    await notificationRepository.markAllAsRead(userId);

    // Emitir evento
    try {
      await eventStore.emit({
        type: 'notification.read_all' as any,
        actor: { id: userId, name: '' },
        subject: { type: 'notification', id: '', name: '' },
        context: { workspaceId: '' },
        payload: { unreadCount: 0 },
        targetUserId: userId,
      } as any);
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
      await eventStore.emit({
        type: 'notification.deleted',
        actor: { id: userId, name: '' },
        subject: { type: 'notification', id: notificationId, name: '' },
        context: { workspaceId: '' },
        payload: { notificationId, unreadCount },
        targetUserId: userId,
      } as any);
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
    invitationId: string;
  }): Promise<Notification | null> {
    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'WORKSPACE_INVITE',
      title: 'Invitación a workspace',
      message: `${data.inviterName} te ha invitado a unirte a "${data.workspaceName}"`,
      data: {
        invitationId: data.invitationId,
        workspaceId: data.workspaceId,
        workspaceName: data.workspaceName,
        inviterId: data.inviterId,
        inviterName: data.inviterName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.inviterId, name: data.inviterName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: data.workspaceId },
        payload: {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.userId,
      } as any);
    } catch (error) {}

    return notification;
  }

  async createTeamInviteNotification(data: {
    userId: string;
    teamId: string;
    teamName: string;
    inviterId: string;
    inviterName: string;
    invitationId: string;
  }): Promise<Notification | null> {
    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'TEAM_INVITE' as any,
      title: 'Invitación a equipo',
      message: `${data.inviterName} te ha invitado a unirte al equipo "${data.teamName}"`,
      data: {
        invitationId: data.invitationId,
        teamId: data.teamId,
        teamName: data.teamName,
        inviterId: data.inviterId,
        inviterName: data.inviterName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.inviterId, name: data.inviterName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.userId,
      } as any);
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
    workspaceId?: string;
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
        workspaceId: data.workspaceId,
        assignerId: data.assignerId,
        assignerName: data.assignerName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.assignerId, name: data.assignerName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: data.workspaceId ?? '' },
        payload: {
          notificationId: notification.id,
          userId: data.assignedUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.assignedUserId,
      } as any);
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
    // Evitar duplicados recientes (últimas 24 horas — el job corre cada hora)
    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.userId,
      type: 'CARD_DUE_SOON',
      cardId: data.cardId,
      windowMinutes: 1440,
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
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: 'system', name: '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.userId,
      } as any);
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
    // Evitar duplicados recientes (últimas 24 horas — el job corre cada hora)
    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.userId,
      type: 'CARD_OVERDUE',
      cardId: data.cardId,
      windowMinutes: 1440,
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
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: 'system', name: '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.userId,
      } as any);
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
    boardId?: string;
    workspaceId?: string;
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
          boardId: data.boardId,
          workspaceId: data.workspaceId,
        },
      });

      try {
        await eventStore.emit({
          type: 'notification.created',
          actor: { id: data.authorId, name: data.authorName || '' },
          subject: { type: 'notification', id: notification.id, name: '' },
          context: { workspaceId: data.workspaceId ?? '' },
          payload: {
            notificationId: notification.id,
            userId: memberId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
          },
          targetUserId: memberId,
        } as any);
      } catch (error) {}
    }
  }

  /**
   * Crear notificación cuando se desasigna a un usuario de una tarjeta
   */
  async createCardUnassignedNotification(data: {
    unassignedUserId: string;
    removerId: string;
    removerName: string;
    cardId: string;
    cardTitle: string;
    boardId: string;
    workspaceId?: string;
  }): Promise<Notification | null> {
    // No notificarse a uno mismo
    if (data.unassignedUserId === data.removerId) {
      return null;
    }

    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.unassignedUserId,
      type: 'CARD_UNASSIGNED',
      cardId: data.cardId,
    });

    if (isDuplicate) {
      return null;
    }

    const notification = await notificationRepository.create({
      userId: data.unassignedUserId,
      type: 'CARD_UNASSIGNED',
      title: 'Te quitaron de una tarjeta',
      message: `${data.removerName} te quitó de la tarjeta "${data.cardTitle}"`,
      data: {
        cardId: data.cardId,
        cardTitle: data.cardTitle,
        boardId: data.boardId,
        workspaceId: data.workspaceId,
        removerId: data.removerId,
        removerName: data.removerName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.removerId, name: data.removerName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: data.workspaceId ?? '' },
        payload: {
          notificationId: notification.id,
          userId: data.unassignedUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.unassignedUserId,
      } as any);
    } catch (error) {}

    return notification;
  }

  /**
   * Crear notificación cuando se elimina a un usuario de un workspace
   */
  async createWorkspaceRemovedNotification(data: {
    userId: string;
    removerId: string;
    removerName: string;
    workspaceId: string;
    workspaceName: string;
  }): Promise<Notification | null> {
    // No notificarse a uno mismo
    if (data.userId === data.removerId) {
      return null;
    }

    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'WORKSPACE_REMOVED',
      title: 'Te eliminaron de un workspace',
      message: `${data.removerName} te eliminó del workspace "${data.workspaceName}"`,
      data: {
        workspaceId: data.workspaceId,
        workspaceName: data.workspaceName,
        removerId: data.removerId,
        removerName: data.removerName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.removerId, name: data.removerName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: data.workspaceId },
        payload: {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.userId,
      } as any);
    } catch (error) {}

    return notification;
  }

  /**
   * Notificación cuando añaden al usuario a un equipo
   */
  async createTeamMemberAddedNotification(data: {
    userId: string;
    adderId: string;
    adderName: string;
    teamId: string;
    teamName: string;
  }): Promise<Notification | null> {
    if (data.userId === data.adderId) return null;

    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.userId,
      type: 'TEAM_MEMBER_ADDED' as any,
    });
    if (isDuplicate) return null;

    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'TEAM_MEMBER_ADDED' as any,
      title: 'Te añadieron a un equipo',
      message: `${data.adderName} te añadió al equipo "${data.teamName}"`,
      data: {
        teamId: data.teamId,
        teamName: data.teamName,
        adderId: data.adderId,
        adderName: data.adderName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.adderId, name: data.adderName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.userId,
      } as any);
    } catch {}

    return notification;
  }

  /**
   * Notificación cuando quitan al usuario de un equipo
   */
  async createTeamMemberRemovedNotification(data: {
    userId: string;
    removerId: string;
    removerName: string;
    teamId: string;
    teamName: string;
  }): Promise<Notification | null> {
    if (data.userId === data.removerId) return null;

    const notification = await notificationRepository.create({
      userId: data.userId,
      type: 'TEAM_MEMBER_REMOVED' as any,
      title: 'Te quitaron de un equipo',
      message: `${data.removerName} te quitó del equipo "${data.teamName}"`,
      data: {
        teamId: data.teamId,
        teamName: data.teamName,
        removerId: data.removerId,
        removerName: data.removerName,
      },
    });

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: data.removerId, name: data.removerName || '' },
        subject: { type: 'notification', id: notification.id, name: '' },
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: data.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: data.userId,
      } as any);
    } catch {}

    return notification;
  }

  private async emitNotificationCreated(notification: Notification, actorId: string, actorName: string, targetUserId: string, _workspaceId?: string) {
    try {
      await eventStore.emit({
        type: 'notification.created',
        actor: { id: actorId, name: actorName },
        subject: { type: 'notification', id: notification.id, name: '' },
        // Personal event: deliver ONLY to the target user via sendToUser.
        // Leaving workspaceId empty prevents a workspace-wide broadcast that
        // would otherwise also notify the actor (the inviter).
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: targetUserId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId,
      } as any);
    } catch {}
  }

  /** Invitación directa a un proyecto */
  async createProjectInviteNotification(data: {
    invitedUserId: string;
    addedById: string;
    addedByName: string;
    projectId: string;
    projectName: string;
    workspaceId?: string;
  }): Promise<Notification | null> {
    if (data.invitedUserId === data.addedById) return null;

    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.invitedUserId,
      type: 'PROJECT_INVITE',
      workspaceId: data.projectId,
    });
    if (isDuplicate) return null;

    const notification = await notificationRepository.create({
      userId: data.invitedUserId,
      type: 'PROJECT_INVITE',
      title: 'Te invitaron a un proyecto',
      message: `${data.addedByName} te añadió al proyecto "${data.projectName}"`,
      data: {
        projectId: data.projectId,
        projectName: data.projectName,
        addedById: data.addedById,
        addedByName: data.addedByName,
        workspaceId: data.workspaceId,
      },
    });

    await this.emitNotificationCreated(notification, data.addedById, data.addedByName, data.invitedUserId, data.workspaceId);
    return notification;
  }

  /** Hito perdido — notifica a cada miembro del proyecto */
  async createMilestoneMissedNotification(data: {
    targetUserId: string;
    actorId: string;
    actorName: string;
    projectId: string;
    projectName: string;
    milestoneId: string;
    milestoneName: string;
    milestoneDate: string;
    workspaceId?: string;
  }): Promise<Notification | null> {
    if (data.targetUserId === data.actorId) return null;

    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.targetUserId,
      type: 'MILESTONE_MISSED',
      workspaceId: data.milestoneId,
    });
    if (isDuplicate) return null;

    const notification = await notificationRepository.create({
      userId: data.targetUserId,
      type: 'MILESTONE_MISSED',
      title: 'Hito perdido',
      message: `El hito "${data.milestoneName}" del proyecto "${data.projectName}" fue marcado como perdido`,
      data: {
        projectId: data.projectId,
        projectName: data.projectName,
        milestoneId: data.milestoneId,
        milestoneName: data.milestoneName,
        milestoneDate: data.milestoneDate,
        workspaceId: data.workspaceId,
      },
    });

    await this.emitNotificationCreated(notification, data.actorId, data.actorName, data.targetUserId, data.workspaceId);
    return notification;
  }

  /** Hito completado — notifica a cada miembro del proyecto */
  async createMilestoneCompletedNotification(data: {
    targetUserId: string;
    actorId: string;
    actorName: string;
    projectId: string;
    projectName: string;
    milestoneId: string;
    milestoneName: string;
    milestoneDate: string;
    workspaceId?: string;
  }): Promise<Notification | null> {
    if (data.targetUserId === data.actorId) return null;

    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.targetUserId,
      type: 'MILESTONE_COMPLETED',
      workspaceId: data.milestoneId,
    });
    if (isDuplicate) return null;

    const notification = await notificationRepository.create({
      userId: data.targetUserId,
      type: 'MILESTONE_COMPLETED',
      title: 'Hito alcanzado',
      message: `El hito "${data.milestoneName}" del proyecto "${data.projectName}" fue completado`,
      data: {
        projectId: data.projectId,
        projectName: data.projectName,
        milestoneId: data.milestoneId,
        milestoneName: data.milestoneName,
        milestoneDate: data.milestoneDate,
        workspaceId: data.workspaceId,
      },
    });

    await this.emitNotificationCreated(notification, data.actorId, data.actorName, data.targetUserId, data.workspaceId);
    return notification;
  }

  /** Cambio de estado del proyecto — notifica a cada miembro */
  async createProjectStatusChangedNotification(data: {
    targetUserId: string;
    actorId: string;
    actorName: string;
    projectId: string;
    projectName: string;
    oldStatus: string;
    newStatus: string;
    workspaceId?: string;
  }): Promise<Notification | null> {
    if (data.targetUserId === data.actorId) return null;

    const isDuplicate = await notificationRepository.existsRecent({
      userId: data.targetUserId,
      type: 'PROJECT_STATUS_CHANGED',
      workspaceId: data.projectId,
    });
    if (isDuplicate) return null;

    const statusLabels: Record<string, string> = {
      PLANNING: 'Planificación', ACTIVE: 'Activo', ON_HOLD: 'En pausa',
      COMPLETED: 'Completado', ARCHIVED: 'Archivado',
    };
    const newLabel = statusLabels[data.newStatus] ?? data.newStatus;

    const notification = await notificationRepository.create({
      userId: data.targetUserId,
      type: 'PROJECT_STATUS_CHANGED',
      title: 'Estado del proyecto actualizado',
      message: `${data.actorName} cambió el estado de "${data.projectName}" a ${newLabel}`,
      data: {
        projectId: data.projectId,
        projectName: data.projectName,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        workspaceId: data.workspaceId,
      },
    });

    await this.emitNotificationCreated(notification, data.actorId, data.actorName, data.targetUserId, data.workspaceId);
    return notification;
  }

  /**
   * Limpiar notificaciones leídas antiguas
   */
  async cleanupReadNotifications(userId: string): Promise<void> {
    await notificationRepository.deleteAllRead(userId);
  }
}

export const notificationService = new NotificationService();
