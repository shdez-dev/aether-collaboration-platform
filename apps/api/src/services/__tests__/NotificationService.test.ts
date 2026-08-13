import { NotificationService } from '../NotificationService';
import { notificationRepository } from '../../repositories/NotificationRepository';
import { eventStore } from '../EventStoreService';

jest.mock('../../repositories/NotificationRepository');
jest.mock('../EventStoreService');

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  it('creates a mention once using an explicit event key', async () => {
    (notificationRepository.createOnce as jest.Mock).mockResolvedValue({
      id: 'notification-1', userId: 'mentioned-user', type: 'COMMENT_MENTION',
      title: 'Te mencionaron en un comentario', message: 'mensaje', data: {}, read: false,
      createdAt: new Date().toISOString(),
    });

    await service.createMentionNotification({
      mentionedUserId: 'mentioned-user', authorId: 'author', authorName: 'Autor',
      cardId: 'card', cardTitle: 'Tarjeta', commentId: 'comment', commentPreview: 'texto',
    });

    expect(notificationRepository.createOnce).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'mentioned-user', dedupeKey: 'comment-mention:comment',
    }));
    expect(eventStore.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'notification.created', targetUserId: 'mentioned-user',
    }));
  });

  it('does not create a self-mention', async () => {
    const result = await service.createMentionNotification({
      mentionedUserId: 'user', authorId: 'user', authorName: 'Autor',
      cardId: 'card', cardTitle: 'Tarjeta', commentId: 'comment', commentPreview: 'texto',
    });
    expect(result).toBeNull();
    expect(notificationRepository.createOnce).not.toHaveBeenCalled();
  });

  it('passes lifecycle filters to the repository', async () => {
    (notificationRepository.findByUserId as jest.Mock).mockResolvedValue([]);
    await service.getNotifications('user', { onlyUnread: true, includeArchived: true });
    expect(notificationRepository.findByUserId).toHaveBeenCalledWith('user', {
      onlyUnread: true, includeArchived: true,
    });
  });

  it('archives without deleting and publishes the new unread count', async () => {
    (notificationRepository.getUnreadCount as jest.Mock).mockResolvedValue(2);
    await service.archiveNotification('notification', 'user');
    expect(notificationRepository.archive).toHaveBeenCalledWith('notification', 'user');
    expect(eventStore.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'notification.archived', targetUserId: 'user',
      payload: expect.objectContaining({ notificationId: 'notification', unreadCount: 2 }),
    }));
  });

  it('uses a status-specific key, preserving different project transitions', async () => {
    (notificationRepository.upsertActive as jest.Mock).mockResolvedValue(null);
    await service.createProjectStatusChangedNotification({
      targetUserId: 'recipient', actorId: 'actor', actorName: 'Actor', projectId: 'project',
      projectName: 'Proyecto', oldStatus: 'PLANNING', newStatus: 'ACTIVE',
    });
    expect(notificationRepository.upsertActive).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: 'project-status:project:ACTIVE',
    }));
  });
});
