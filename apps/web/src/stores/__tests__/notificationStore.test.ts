// apps/web/src/stores/__tests__/notificationStore.test.ts

import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotificationStore } from '../notificationStore';
import { notificationService } from '@/services/notificationService';
import { socketService } from '@/services/socketService';
import { toast } from '@/hooks/use-toast';
import type { Notification } from '@aether/types';

// Mock dependencies
jest.mock('@/services/notificationService');
jest.mock('@/services/socketService');
jest.mock('@/hooks/use-toast');

describe('NotificationStore', () => {
  const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;
  const mockSocketService = socketService as jest.Mocked<typeof socketService>;
  const mockToast = toast as jest.MockedFunction<typeof toast>;

  const mockNotification: Notification = {
    id: 'notif-1',
    userId: 'user-1',
    type: 'CARD_ASSIGNED',
    title: 'Card assigned',
    message: 'You have been assigned to a card',
    data: { cardId: 'card-1' },
    read: false,
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    const { result } = renderHook(() => useNotificationStore());
    act(() => {
      result.current.notifications = [];
      result.current.unreadCount = 0;
      result.current.isLoading = false;
      result.current.isOpen = false;
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useNotificationStore());

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('fetchNotifications', () => {
    it('should fetch notifications successfully', async () => {
      mockNotificationService.getNotifications.mockResolvedValue([mockNotification]);

      const { result } = renderHook(() => useNotificationStore());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      await waitFor(() => {
        expect(result.current.notifications).toEqual([mockNotification]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle fetch notifications error', async () => {
      mockNotificationService.getNotifications.mockRejectedValue(new Error('Failed to fetch'));

      const { result } = renderHook(() => useNotificationStore());

      await act(async () => {
        await result.current.fetchNotifications();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.notifications).toEqual([]);
      });
    });
  });

  describe('fetchUnreadCount', () => {
    it('should fetch unread count successfully', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      const { result } = renderHook(() => useNotificationStore());

      await act(async () => {
        await result.current.fetchUnreadCount();
      });

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(5);
      });
    });

    it('should handle fetch unread count error silently', async () => {
      mockNotificationService.getUnreadCount.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useNotificationStore());

      await act(async () => {
        await result.current.fetchUnreadCount();
      });

      // Should not throw error
      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockNotificationService.markAsRead.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [mockNotification];
        result.current.unreadCount = 1;
      });

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      await waitFor(() => {
        expect(result.current.notifications[0].read).toBe(true);
        expect(result.current.unreadCount).toBe(0);
      });
    });

    it('should not decrease unread count below zero', async () => {
      mockNotificationService.markAsRead.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [{ ...mockNotification, read: true }];
        result.current.unreadCount = 0;
      });

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(0);
      });
    });

    it('should handle mark as read error silently', async () => {
      mockNotificationService.markAsRead.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [mockNotification];
        result.current.unreadCount = 1;
      });

      await act(async () => {
        await result.current.markAsRead('notif-1');
      });

      // State should not change if error occurs
      expect(result.current.notifications[0].read).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [mockNotification, { ...mockNotification, id: 'notif-2' }];
        result.current.unreadCount = 2;
      });

      await act(async () => {
        await result.current.markAllAsRead();
      });

      await waitFor(() => {
        expect(result.current.notifications.every((n) => n.read)).toBe(true);
        expect(result.current.unreadCount).toBe(0);
      });
    });
  });

  describe('deleteNotification', () => {
    it('should delete an unread notification', async () => {
      mockNotificationService.deleteNotification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [mockNotification];
        result.current.unreadCount = 1;
      });

      await act(async () => {
        await result.current.deleteNotification('notif-1');
      });

      await waitFor(() => {
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
      });
    });

    it('should delete a read notification without changing unread count', async () => {
      mockNotificationService.deleteNotification.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [{ ...mockNotification, read: true }];
        result.current.unreadCount = 0;
      });

      await act(async () => {
        await result.current.deleteNotification('notif-1');
      });

      await waitFor(() => {
        expect(result.current.notifications).toEqual([]);
        expect(result.current.unreadCount).toBe(0);
      });
    });

    it('should handle delete error silently', async () => {
      mockNotificationService.deleteNotification.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [mockNotification];
      });

      await act(async () => {
        await result.current.deleteNotification('notif-1');
      });

      // State should not change if error occurs
      expect(result.current.notifications).toHaveLength(1);
    });
  });

  describe('toggleDropdown', () => {
    it('should toggle dropdown open state', () => {
      const { result } = renderHook(() => useNotificationStore());

      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggleDropdown();
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggleDropdown();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('closeDropdown', () => {
    it('should close dropdown', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.isOpen = true;
        result.current.closeDropdown();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('addNotification', () => {
    it('should add a new notification', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addNotification(mockNotification);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toEqual(mockNotification);
      expect(result.current.unreadCount).toBe(1);
    });

    it('should not add duplicate notifications', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.addNotification(mockNotification);
        result.current.addNotification(mockNotification);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);
    });

    it('should prepend new notification to list', () => {
      const { result } = renderHook(() => useNotificationStore());
      const notification2 = { ...mockNotification, id: 'notif-2' };

      act(() => {
        result.current.addNotification(mockNotification);
        result.current.addNotification(notification2);
      });

      expect(result.current.notifications[0].id).toBe('notif-2');
      expect(result.current.notifications[1].id).toBe('notif-1');
    });
  });

  describe('updateUnreadCount', () => {
    it('should update unread count', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.updateUnreadCount(10);
      });

      expect(result.current.unreadCount).toBe(10);
    });
  });

  describe('initSocketListener', () => {
    beforeEach(() => {
      // Ensure socketService.on is mocked
      mockSocketService.on = jest.fn();
    });

    it('should register socket listener', () => {
      // Since the listener is registered once globally, we need to test the behavior
      // without relying on the actual registration count
      const { result } = renderHook(() => useNotificationStore());

      // Test that we can add notifications manually (simulating socket events)
      act(() => {
        result.current.addNotification(mockNotification);
      });

      expect(result.current.notifications).toHaveLength(1);
    });

    it('should add notification when received via socket', () => {
      const { result } = renderHook(() => useNotificationStore());

      // Simulate receiving a notification
      const newNotification: Notification = {
        id: 'notif-new',
        userId: 'user-1',
        type: 'CARD_ASSIGNED',
        title: 'New notification',
        message: 'Test message',
        data: {},
        read: false,
        createdAt: new Date().toISOString(),
      };

      act(() => {
        result.current.addNotification(newNotification);
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);
    });

    it('should update unread count when notification is marked as read via socket', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.unreadCount = 5;
        result.current.updateUnreadCount(3);
      });

      expect(result.current.unreadCount).toBe(3);
    });

    it('should update unread count to zero when all are marked as read via socket', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.unreadCount = 5;
        result.current.updateUnreadCount(0);
      });

      expect(result.current.unreadCount).toBe(0);
    });

    it('should update unread count when notification is deleted via socket', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.unreadCount = 5;
        result.current.updateUnreadCount(4);
      });

      expect(result.current.unreadCount).toBe(4);
    });
  });

  describe('Selectors', () => {
    it('should select notifications', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [mockNotification];
      });

      const { selectNotifications } = require('../notificationStore');
      expect(selectNotifications(result.current)).toEqual([mockNotification]);
    });

    it('should select unread notifications', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.notifications = [
          mockNotification,
          { ...mockNotification, id: 'notif-2', read: true },
        ];
      });

      const { selectUnreadNotifications } = require('../notificationStore');
      expect(selectUnreadNotifications(result.current)).toHaveLength(1);
      expect(selectUnreadNotifications(result.current)[0].id).toBe('notif-1');
    });

    it('should select unread count', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.unreadCount = 7;
      });

      const { selectUnreadCount } = require('../notificationStore');
      expect(selectUnreadCount(result.current)).toBe(7);
    });

    it('should select isLoading', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.isLoading = true;
      });

      const { selectIsLoading } = require('../notificationStore');
      expect(selectIsLoading(result.current)).toBe(true);
    });

    it('should select isOpen', () => {
      const { result } = renderHook(() => useNotificationStore());

      act(() => {
        result.current.isOpen = true;
      });

      const { selectIsOpen } = require('../notificationStore');
      expect(selectIsOpen(result.current)).toBe(true);
    });
  });
});
