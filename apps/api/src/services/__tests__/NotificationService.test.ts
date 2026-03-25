// apps/api/src/services/__tests__/NotificationService.test.ts

import { NotificationService } from '../NotificationService';
import { notificationRepository } from '../../repositories/NotificationRepository';
import { eventStore } from '../EventStoreService';

jest.mock('../../repositories/NotificationRepository');
jest.mock('../EventStoreService');

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
  });

  describe('createMentionNotification', () => {
    it('should create a mention notification', async () => {
      const mentionData = {
        mentionedUserId: 'user-1',
        authorId: 'user-2',
        authorName: 'John Doe',
        cardId: 'card-123',
        cardTitle: 'Test Card',
        commentId: 'comment-1',
        commentPreview: 'This is a test comment',
      };

      (notificationRepository.existsRecent as jest.Mock).mockResolvedValue(false);
      (notificationRepository.create as jest.Mock).mockResolvedValue({
        id: 'notif-1',
        userId: mentionData.mentionedUserId,
        type: 'COMMENT_MENTION',
        title: 'Te mencionaron en un comentario',
        message: `${mentionData.authorName} te mencionó en "${mentionData.cardTitle}"`,
        data: {
          cardId: mentionData.cardId,
          cardTitle: mentionData.cardTitle,
          commentId: mentionData.commentId,
          commentPreview: mentionData.commentPreview.substring(0, 100),
          authorId: mentionData.authorId,
          authorName: mentionData.authorName,
        },
        read: false,
        createdAt: new Date(),
      });

      const result = await notificationService.createMentionNotification(mentionData);

      expect(result).toBeDefined();
      expect(result?.type).toBe('COMMENT_MENTION');
      expect(notificationRepository.existsRecent).toHaveBeenCalledWith({
        userId: mentionData.mentionedUserId,
        type: 'COMMENT_MENTION',
        cardId: mentionData.cardId,
        commentId: mentionData.commentId,
      });
      expect(notificationRepository.create).toHaveBeenCalled();
      expect(eventStore.emit).toHaveBeenCalledWith(
        'notification.created',
        expect.objectContaining({
          notificationId: 'notif-1',
          userId: mentionData.mentionedUserId,
        }),
        mentionData.authorId,
        undefined,
        undefined,
        mentionData.mentionedUserId
      );
    });

    it('should not create notification if user mentions themselves', async () => {
      const mentionData = {
        mentionedUserId: 'user-1',
        authorId: 'user-1', // Same user
        authorName: 'John Doe',
        cardId: 'card-123',
        cardTitle: 'Test Card',
        commentId: 'comment-1',
        commentPreview: 'This is a test comment',
      };

      const result = await notificationService.createMentionNotification(mentionData);

      expect(result).toBeNull();
      expect(notificationRepository.existsRecent).not.toHaveBeenCalled();
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    it('should not create notification if duplicate exists', async () => {
      const mentionData = {
        mentionedUserId: 'user-1',
        authorId: 'user-2',
        authorName: 'John Doe',
        cardId: 'card-123',
        cardTitle: 'Test Card',
        commentId: 'comment-1',
        commentPreview: 'This is a test comment',
      };

      (notificationRepository.existsRecent as jest.Mock).mockResolvedValue(true);

      const result = await notificationService.createMentionNotification(mentionData);

      expect(result).toBeNull();
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('should get all notifications for a user', async () => {
      const userId = 'user-123';
      const mockNotifications = [
        { id: 'notif-1', userId, type: 'COMMENT_MENTION', read: false },
        { id: 'notif-2', userId, type: 'CARD_ASSIGNED', read: true },
      ];

      (notificationRepository.findByUserId as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await notificationService.getNotifications(userId);

      expect(result).toEqual(mockNotifications);
      expect(notificationRepository.findByUserId).toHaveBeenCalledWith(userId);
    });

    it('should get only unread notifications when onlyUnread is true', async () => {
      const userId = 'user-123';
      const mockUnreadNotifications = [
        { id: 'notif-1', userId, type: 'COMMENT_MENTION', read: false },
      ];

      (notificationRepository.findUnreadByUserId as jest.Mock).mockResolvedValue(
        mockUnreadNotifications
      );

      const result = await notificationService.getNotifications(userId, true);

      expect(result).toEqual(mockUnreadNotifications);
      expect(notificationRepository.findUnreadByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notif-123';
      const userId = 'user-123';

      (notificationRepository.markAsRead as jest.Mock).mockResolvedValue(undefined);
      (notificationRepository.getUnreadCount as jest.Mock).mockResolvedValue(5);

      await notificationService.markAsRead(notificationId, userId);

      expect(notificationRepository.markAsRead).toHaveBeenCalledWith(notificationId, userId);
      expect(notificationRepository.getUnreadCount).toHaveBeenCalledWith(userId);
      expect(eventStore.emit).toHaveBeenCalledWith(
        'notification.read',
        expect.objectContaining({
          notificationId,
          unreadCount: 5,
        }),
        userId,
        undefined,
        undefined,
        userId
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const userId = 'user-123';

      (notificationRepository.markAllAsRead as jest.Mock).mockResolvedValue(undefined);

      await notificationService.markAllAsRead(userId);

      expect(notificationRepository.markAllAsRead).toHaveBeenCalledWith(userId);
      expect(eventStore.emit).toHaveBeenCalledWith(
        'notification.read_all',
        expect.objectContaining({
          unreadCount: 0,
        }),
        userId,
        undefined,
        undefined,
        userId
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const userId = 'user-123';
      (notificationRepository.getUnreadCount as jest.Mock).mockResolvedValue(7);

      const result = await notificationService.getUnreadCount(userId);

      expect(result).toBe(7);
      expect(notificationRepository.getUnreadCount).toHaveBeenCalledWith(userId);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification and update count', async () => {
      const notificationId = 'notif-123';
      const userId = 'user-123';

      (notificationRepository.delete as jest.Mock).mockResolvedValue(undefined);
      (notificationRepository.getUnreadCount as jest.Mock).mockResolvedValue(3);

      await notificationService.deleteNotification(notificationId, userId);

      expect(notificationRepository.delete).toHaveBeenCalledWith(notificationId, userId);
      expect(notificationRepository.getUnreadCount).toHaveBeenCalledWith(userId);
      expect(eventStore.emit).toHaveBeenCalledWith(
        'notification.deleted',
        expect.objectContaining({
          notificationId,
          unreadCount: 3,
        }),
        userId,
        undefined,
        undefined,
        userId
      );
    });
  });
});
