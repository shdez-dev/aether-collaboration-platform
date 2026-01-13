// apps/web/src/stores/notificationStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Notification } from '@aether/types';
import { notificationService } from '@/services/notificationService';
import { socketService } from '@/services/socketService';

/**
 * Estado del store de notificaciones
 */
interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isOpen: boolean; // Para el dropdown
}

/**
 * Acciones del store
 */
interface NotificationActions {
  // Fetch
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;

  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;

  // UI
  toggleDropdown: () => void;
  closeDropdown: () => void;

  // Real-time
  addNotification: (notification: Notification) => void;
  updateUnreadCount: (count: number) => void;
}

/**
 * Estado inicial
 */
const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isOpen: false,
};

/**
 * NotificationStore
 * Maneja el estado global de notificaciones
 */
export const useNotificationStore = create<NotificationState & NotificationActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ======================================================================
      // FETCH NOTIFICATIONS
      // ======================================================================
      fetchNotifications: async () => {
        set({ isLoading: true });

        try {
          const notifications = await notificationService.getNotifications();

          set({
            notifications,
            isLoading: false,
          });
        } catch (error) {
          console.error('[NotificationStore] Error fetching notifications:', error);
          set({ isLoading: false });
        }
      },

      // ======================================================================
      // FETCH UNREAD COUNT
      // ======================================================================
      fetchUnreadCount: async () => {
        try {
          const count = await notificationService.getUnreadCount();
          set({ unreadCount: count });
        } catch (error) {
          console.error('[NotificationStore] Error fetching unread count:', error);
        }
      },

      // ======================================================================
      // MARK AS READ
      // ======================================================================
      markAsRead: async (notificationId: string) => {
        try {
          await notificationService.markAsRead(notificationId);

          // Actualizar localmente
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }));
        } catch (error) {
          console.error('[NotificationStore] Error marking as read:', error);
        }
      },

      // ======================================================================
      // MARK ALL AS READ
      // ======================================================================
      markAllAsRead: async () => {
        try {
          await notificationService.markAllAsRead();

          // Actualizar localmente
          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
          }));
        } catch (error) {
          console.error('[NotificationStore] Error marking all as read:', error);
        }
      },

      // ======================================================================
      // DELETE NOTIFICATION
      // ======================================================================
      deleteNotification: async (notificationId: string) => {
        try {
          await notificationService.deleteNotification(notificationId);

          // Actualizar localmente
          set((state) => {
            const notification = state.notifications.find((n) => n.id === notificationId);
            const wasUnread = notification && !notification.read;

            return {
              notifications: state.notifications.filter((n) => n.id !== notificationId),
              unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
            };
          });
        } catch (error) {
          console.error('[NotificationStore] Error deleting notification:', error);
        }
      },

      // ======================================================================
      // UI ACTIONS
      // ======================================================================
      toggleDropdown: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },

      closeDropdown: () => {
        set({ isOpen: false });
      },

      // ======================================================================
      // REAL-TIME UPDATES
      // ======================================================================
      addNotification: (notification: Notification) => {
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
      },

      updateUnreadCount: (count: number) => {
        set({ unreadCount: count });
      },
    }),
    { name: 'NotificationStore' }
  )
);

// ============================================================================
// SELECTORES
// ============================================================================

export const selectNotifications = (state: NotificationState & NotificationActions) =>
  state.notifications;

export const selectUnreadNotifications = (state: NotificationState & NotificationActions) =>
  state.notifications.filter((n) => !n.read);

export const selectUnreadCount = (state: NotificationState & NotificationActions) =>
  state.unreadCount;

export const selectIsLoading = (state: NotificationState & NotificationActions) => state.isLoading;

export const selectIsOpen = (state: NotificationState & NotificationActions) => state.isOpen;
