import { notificationRepository } from '../repositories/NotificationRepository';
import { eventStore } from './EventStoreService';
import type { Notification } from '@aether/types';

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  dedupeKey: string;
};

type Actor = { id: string; name: string };

function cardDeadlineKey(cardId: string, dueDate: Date): string {
  // A change to the hour on the same day is still the same deadline reminder.
  // Due-soon and overdue share this key: at most one alert per user/card/day.
  return `card-deadline:${cardId}:${dueDate.toISOString().slice(0, 10)}`;
}

export class NotificationService {
  private async deliver(input: NotificationInput, actor: Actor, once = false): Promise<Notification | null> {
    const notification = once
      ? await notificationRepository.createOnce(input)
      : await notificationRepository.upsertActive(input);
    if (!notification) return null;

    try {
      await eventStore.emit({
        type: 'notification.created',
        actor,
        subject: { type: 'notification', id: notification.id, name: '' },
        // Delivery is personal; using an empty workspace avoids broadcasting to
        // other workspace members when an event store adapter is configured.
        context: { workspaceId: '' },
        payload: {
          notificationId: notification.id,
          userId: input.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        },
        targetUserId: input.userId,
      } as any);
    } catch {}
    return notification;
  }

  async getNotifications(
    userId: string,
    options: { onlyUnread?: boolean; includeArchived?: boolean; includeResolved?: boolean; limit?: number } = {},
  ): Promise<Notification[]> {
    return notificationRepository.findByUserId(userId, options);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.markAsRead(notificationId, userId);
    await this.emitLifecycle('notification.read', notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await notificationRepository.markAllAsRead(userId);
    await this.emitLifecycle('notification.read_all', '', userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return notificationRepository.getUnreadCount(userId);
  }

  /** Compatibility endpoint. New UI uses archive instead of hard deletion. */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.delete(notificationId, userId);
    await this.emitLifecycle('notification.deleted', notificationId, userId);
  }

  async archiveNotification(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.archive(notificationId, userId);
    await this.emitLifecycle('notification.archived', notificationId, userId);
  }

  async restoreNotification(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.restore(notificationId, userId);
    await this.emitLifecycle('notification.restored', notificationId, userId);
  }

  async resolveNotification(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.resolve(notificationId, userId);
    await this.emitLifecycle('notification.resolved', notificationId, userId);
  }

  async reopenNotification(notificationId: string, userId: string): Promise<void> {
    await notificationRepository.reopen(notificationId, userId);
    await this.emitLifecycle('notification.reopened', notificationId, userId);
  }

  private async emitLifecycle(type: string, notificationId: string, userId: string): Promise<void> {
    try {
      await eventStore.emit({
        type: type as any,
        actor: { id: userId, name: '' },
        subject: { type: 'notification', id: notificationId, name: '' },
        context: { workspaceId: '' },
        payload: { notificationId, unreadCount: await notificationRepository.getUnreadCount(userId) },
        targetUserId: userId,
      } as any);
    } catch {}
  }

  async createMentionNotification(data: {
    mentionedUserId: string; authorId: string; authorName: string; cardId: string; cardTitle: string;
    commentId: string; commentPreview: string; boardId?: string; workspaceId?: string;
  }): Promise<Notification | null> {
    if (data.mentionedUserId === data.authorId) return null;
    return this.deliver({
      userId: data.mentionedUserId, type: 'COMMENT_MENTION', title: 'Te mencionaron en un comentario',
      message: `${data.authorName} te mencionó en "${data.cardTitle}"`, dedupeKey: `comment-mention:${data.commentId}`,
      data: { cardId: data.cardId, cardTitle: data.cardTitle, commentId: data.commentId, commentPreview: data.commentPreview.slice(0, 100), authorId: data.authorId, authorName: data.authorName, boardId: data.boardId, workspaceId: data.workspaceId },
    }, { id: data.authorId, name: data.authorName }, true);
  }

  async createDocumentMentionNotification(data: {
    mentionedUserId: string; authorId: string; authorName: string; documentId: string; documentTitle: string;
    commentId: string; commentPreview: string;
  }): Promise<Notification | null> {
    if (data.mentionedUserId === data.authorId) return null;
    return this.deliver({
      userId: data.mentionedUserId, type: 'DOCUMENT_MENTION', title: 'Te mencionaron en un documento',
      message: `${data.authorName} te mencionó en "${data.documentTitle}"`, dedupeKey: `document-mention:${data.commentId}`,
      data: { documentId: data.documentId, documentTitle: data.documentTitle, commentId: data.commentId, commentPreview: data.commentPreview.slice(0, 100), authorId: data.authorId, authorName: data.authorName },
    }, { id: data.authorId, name: data.authorName }, true);
  }

  async createWorkspaceInviteNotification(data: { userId: string; workspaceId: string; workspaceName: string; inviterId: string; inviterName: string; invitationId: string }): Promise<Notification | null> {
    return this.deliver({
      userId: data.userId, type: 'WORKSPACE_INVITE', title: 'Invitación a workspace',
      message: `${data.inviterName} te ha invitado a unirte a "${data.workspaceName}"`, dedupeKey: `workspace-invite:${data.invitationId}`,
      data: { invitationId: data.invitationId, workspaceId: data.workspaceId, workspaceName: data.workspaceName, inviterId: data.inviterId, inviterName: data.inviterName },
    }, { id: data.inviterId, name: data.inviterName });
  }

  async createTeamInviteNotification(data: { userId: string; teamId: string; teamName: string; inviterId: string; inviterName: string; invitationId: string }): Promise<Notification | null> {
    return this.deliver({
      userId: data.userId, type: 'TEAM_INVITE', title: 'Invitación a equipo',
      message: `${data.inviterName} te ha invitado a unirte al equipo "${data.teamName}"`, dedupeKey: `team-invite:${data.invitationId}`,
      data: { invitationId: data.invitationId, teamId: data.teamId, teamName: data.teamName, inviterId: data.inviterId, inviterName: data.inviterName },
    }, { id: data.inviterId, name: data.inviterName });
  }

  async createCardAssignedNotification(data: { assignedUserId: string; assignerId: string; assignerName: string; cardId: string; cardTitle: string; boardId: string; workspaceId?: string }): Promise<Notification | null> {
    if (data.assignedUserId === data.assignerId) return null;
    return this.deliver({
      userId: data.assignedUserId, type: 'CARD_ASSIGNED', title: 'Te asignaron una tarjeta',
      message: `${data.assignerName} te asignó la tarjeta "${data.cardTitle}"`, dedupeKey: `card-assigned:${data.cardId}`,
      data: { cardId: data.cardId, cardTitle: data.cardTitle, boardId: data.boardId, workspaceId: data.workspaceId, assignerId: data.assignerId, assignerName: data.assignerName },
    }, { id: data.assignerId, name: data.assignerName });
  }

  async createCardDueSoonNotification(data: { userId: string; cardId: string; cardTitle: string; dueDate: Date; boardId: string }): Promise<Notification | null> {
    const hoursUntilDue = Math.max(1, Math.ceil((data.dueDate.getTime() - Date.now()) / 3_600_000));
    return this.deliver({
      userId: data.userId, type: 'CARD_DUE_SOON', title: 'Tarjeta por vencer',
      message: `La tarjeta "${data.cardTitle}" vence en ${hoursUntilDue} hora${hoursUntilDue === 1 ? '' : 's'}`,
      dedupeKey: cardDeadlineKey(data.cardId, data.dueDate),
      data: { cardId: data.cardId, cardTitle: data.cardTitle, dueDate: data.dueDate.toISOString(), boardId: data.boardId, hoursUntilDue },
    }, { id: 'system', name: '' }, true);
  }

  async createCardOverdueNotification(data: { userId: string; cardId: string; cardTitle: string; dueDate: Date; boardId: string }): Promise<Notification | null> {
    return this.deliver({
      userId: data.userId, type: 'CARD_OVERDUE', title: 'Tarjeta vencida', message: `La tarjeta "${data.cardTitle}" ha vencido`,
      dedupeKey: cardDeadlineKey(data.cardId, data.dueDate),
      data: { cardId: data.cardId, cardTitle: data.cardTitle, dueDate: data.dueDate.toISOString(), boardId: data.boardId },
    }, { id: 'system', name: '' }, true);
  }

  async createCommentNotification(data: { cardMembers: string[]; authorId: string; authorName: string; cardId: string; cardTitle: string; commentId: string; commentPreview: string; boardId?: string; workspaceId?: string }): Promise<void> {
    await Promise.all(data.cardMembers.filter((id) => id !== data.authorId).map((userId) => this.deliver({
      userId, type: 'COMMENT_ADDED', title: 'Nuevo comentario', message: `${data.authorName} comentó en "${data.cardTitle}"`,
      dedupeKey: `comment-added:${data.commentId}`,
      data: { cardId: data.cardId, cardTitle: data.cardTitle, commentId: data.commentId, commentPreview: data.commentPreview.slice(0, 100), authorId: data.authorId, authorName: data.authorName, boardId: data.boardId, workspaceId: data.workspaceId },
    }, { id: data.authorId, name: data.authorName }, true)));
  }

  async createCardUnassignedNotification(data: { unassignedUserId: string; removerId: string; removerName: string; cardId: string; cardTitle: string; boardId: string; workspaceId?: string }): Promise<Notification | null> {
    if (data.unassignedUserId === data.removerId) return null;
    return this.deliver({
      userId: data.unassignedUserId, type: 'CARD_UNASSIGNED', title: 'Te quitaron de una tarjeta',
      message: `${data.removerName} te quitó de la tarjeta "${data.cardTitle}"`, dedupeKey: `card-unassigned:${data.cardId}`,
      data: { cardId: data.cardId, cardTitle: data.cardTitle, boardId: data.boardId, workspaceId: data.workspaceId, removerId: data.removerId, removerName: data.removerName },
    }, { id: data.removerId, name: data.removerName });
  }

  async createWorkspaceRemovedNotification(data: { userId: string; removerId: string; removerName: string; workspaceId: string; workspaceName: string }): Promise<Notification | null> {
    if (data.userId === data.removerId) return null;
    return this.deliver({
      userId: data.userId, type: 'WORKSPACE_REMOVED', title: 'Te eliminaron de un workspace',
      message: `${data.removerName} te eliminó del workspace "${data.workspaceName}"`, dedupeKey: `workspace-removed:${data.workspaceId}`,
      data: { workspaceId: data.workspaceId, workspaceName: data.workspaceName, removerId: data.removerId, removerName: data.removerName },
    }, { id: data.removerId, name: data.removerName });
  }

  async createTeamMemberAddedNotification(data: { userId: string; adderId: string; adderName: string; teamId: string; teamName: string }): Promise<Notification | null> {
    if (data.userId === data.adderId) return null;
    return this.deliver({
      userId: data.userId, type: 'TEAM_MEMBER_ADDED', title: 'Te añadieron a un equipo',
      message: `${data.adderName} te añadió al equipo "${data.teamName}"`, dedupeKey: `team-member-added:${data.teamId}`,
      data: { teamId: data.teamId, teamName: data.teamName, adderId: data.adderId, adderName: data.adderName },
    }, { id: data.adderId, name: data.adderName });
  }

  async createTeamMemberRemovedNotification(data: { userId: string; removerId: string; removerName: string; teamId: string; teamName: string }): Promise<Notification | null> {
    if (data.userId === data.removerId) return null;
    return this.deliver({
      userId: data.userId, type: 'TEAM_MEMBER_REMOVED', title: 'Te quitaron de un equipo',
      message: `${data.removerName} te quitó del equipo "${data.teamName}"`, dedupeKey: `team-member-removed:${data.teamId}`,
      data: { teamId: data.teamId, teamName: data.teamName, removerId: data.removerId, removerName: data.removerName },
    }, { id: data.removerId, name: data.removerName });
  }

  async createProjectInviteNotification(data: { invitedUserId: string; addedById: string; addedByName: string; projectId: string; projectName: string; workspaceId?: string }): Promise<Notification | null> {
    if (data.invitedUserId === data.addedById) return null;
    return this.deliver({
      userId: data.invitedUserId, type: 'PROJECT_INVITE', title: 'Te invitaron a un proyecto',
      message: `${data.addedByName} te añadió al proyecto "${data.projectName}"`, dedupeKey: `project-invite:${data.projectId}`,
      data: { projectId: data.projectId, projectName: data.projectName, addedById: data.addedById, addedByName: data.addedByName, workspaceId: data.workspaceId },
    }, { id: data.addedById, name: data.addedByName });
  }

  async createMilestoneMissedNotification(data: { targetUserId: string; actorId: string; actorName: string; projectId: string; projectName: string; milestoneId: string; milestoneName: string; milestoneDate: string; workspaceId?: string }): Promise<Notification | null> {
    if (data.targetUserId === data.actorId) return null;
    return this.deliver({
      userId: data.targetUserId, type: 'MILESTONE_MISSED', title: 'Hito perdido',
      message: `El hito "${data.milestoneName}" del proyecto "${data.projectName}" fue marcado como perdido`, dedupeKey: `milestone-missed:${data.milestoneId}`,
      data: { projectId: data.projectId, projectName: data.projectName, milestoneId: data.milestoneId, milestoneName: data.milestoneName, milestoneDate: data.milestoneDate, workspaceId: data.workspaceId },
    }, { id: data.actorId, name: data.actorName });
  }

  async createMilestoneCompletedNotification(data: { targetUserId: string; actorId: string; actorName: string; projectId: string; projectName: string; milestoneId: string; milestoneName: string; milestoneDate: string; workspaceId?: string }): Promise<Notification | null> {
    if (data.targetUserId === data.actorId) return null;
    return this.deliver({
      userId: data.targetUserId, type: 'MILESTONE_COMPLETED', title: 'Hito alcanzado',
      message: `El hito "${data.milestoneName}" del proyecto "${data.projectName}" fue completado`, dedupeKey: `milestone-completed:${data.milestoneId}`,
      data: { projectId: data.projectId, projectName: data.projectName, milestoneId: data.milestoneId, milestoneName: data.milestoneName, milestoneDate: data.milestoneDate, workspaceId: data.workspaceId },
    }, { id: data.actorId, name: data.actorName });
  }

  async createProjectStatusChangedNotification(data: { targetUserId: string; actorId: string; actorName: string; projectId: string; projectName: string; oldStatus: string; newStatus: string; workspaceId?: string }): Promise<Notification | null> {
    if (data.targetUserId === data.actorId) return null;
    const labels: Record<string, string> = { PLANNING: 'Planificación', ACTIVE: 'Activo', ON_HOLD: 'En pausa', COMPLETED: 'Completado', ARCHIVED: 'Archivado' };
    return this.deliver({
      userId: data.targetUserId, type: 'PROJECT_STATUS_CHANGED', title: 'Estado del proyecto actualizado',
      message: `${data.actorName} cambió el estado de "${data.projectName}" a ${labels[data.newStatus] ?? data.newStatus}`,
      dedupeKey: `project-status:${data.projectId}:${data.newStatus}`,
      data: { projectId: data.projectId, projectName: data.projectName, oldStatus: data.oldStatus, newStatus: data.newStatus, workspaceId: data.workspaceId },
    }, { id: data.actorId, name: data.actorName });
  }

  async cleanupReadNotifications(userId: string): Promise<void> {
    await notificationRepository.deleteAllRead(userId);
  }
}

export const notificationService = new NotificationService();
