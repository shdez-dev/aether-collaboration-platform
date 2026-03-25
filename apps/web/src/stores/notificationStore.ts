// apps/web/src/stores/notificationStore.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Notification } from '@aether/types';
import { notificationService } from '@/services/notificationService';
import { socketService } from '@/services/socketService';
import { toast as showToast } from '@/hooks/use-toast';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  isOpen: boolean;
}

interface NotificationActions {
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  toggleDropdown: () => void;
  closeDropdown: () => void;
  reset: () => void;
  addNotification: (notification: Notification) => void;
  updateUnreadCount: (count: number) => void;
  /** Llamar una sola vez cuando el socket se conecta */
  initSocketListener: () => void;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isOpen: false,
};

// Guardamos la referencia del handler fuera del store para poder hacer off exacto
let _socketHandler: ((event: any) => void) | null = null;

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'WORKSPACE_INVITE':
      return '📩';
    case 'WORKSPACE_REMOVED':
      return '🚪';
    case 'CARD_ASSIGNED':
      return '📌';
    case 'CARD_UNASSIGNED':
      return '📋';
    case 'COMMENT_MENTION':
      return '💬';
    case 'COMMENT_ADDED':
      return '💭';
    case 'CARD_DUE_SOON':
      return '⏰';
    case 'CARD_OVERDUE':
      return '⚠️';
    default:
      return '🔔';
  }
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      fetchNotifications: async () => {
        set({ isLoading: true });
        try {
          const notifications = await notificationService.getNotifications();
          set({ notifications, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      fetchUnreadCount: async () => {
        try {
          const count = await notificationService.getUnreadCount();
          set({ unreadCount: count });
        } catch {}
      },

      markAsRead: async (notificationId) => {
        try {
          await notificationService.markAsRead(notificationId);
          set((s) => ({
            notifications: s.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: Math.max(0, s.unreadCount - 1),
          }));
        } catch {}
      },

      markAllAsRead: async () => {
        try {
          await notificationService.markAllAsRead();
          set((s) => ({
            notifications: s.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
          }));
        } catch {}
      },

      deleteNotification: async (notificationId) => {
        try {
          await notificationService.deleteNotification(notificationId);
          set((s) => {
            const n = s.notifications.find((n) => n.id === notificationId);
            return {
              notifications: s.notifications.filter((n) => n.id !== notificationId),
              unreadCount: n && !n.read ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
            };
          });
        } catch {}
      },

      reset: () => {
        set({ notifications: [], unreadCount: 0, isLoading: false, isOpen: false });
        if (_socketHandler) {
          socketService.off('event', _socketHandler);
          _socketHandler = null;
        }
      },

      toggleDropdown: () => set((s) => ({ isOpen: !s.isOpen })),
      closeDropdown: () => set({ isOpen: false }),

      addNotification: (notification) => {
        // Dedup: nunca agregar la misma notificación dos veces
        const already = get().notifications.some((n) => n.id === notification.id);
        if (already) return;
        set((s) => ({
          notifications: [notification, ...s.notifications],
          unreadCount: s.unreadCount + 1,
        }));
      },

      updateUnreadCount: (count) => set({ unreadCount: count }),

      // ── Listener único de socket ─────────────────────────────────────────────
      initSocketListener: () => {
        // Quitar handler anterior (si existe) antes de registrar el nuevo.
        // Esto cubre el caso de logout/login donde el socket es reemplazado:
        // el off es inofensivo si el socket ya cambió, y el on se registra
        // sobre el socket actual correctamente.
        if (_socketHandler) {
          socketService.off('event', _socketHandler);
        }

        _socketHandler = (event: any) => {
          if (event.type === 'notification.created') {
            const p = event.payload as any;
            const notification: Notification = {
              id: p.notificationId || p.notification?.id,
              userId: p.userId,
              type: p.type,
              title: p.title,
              message: p.message,
              data: p.data,
              read: false,
              createdAt: new Date().toISOString(),
            };
            get().addNotification(notification);
            showToast({
              title: `${getNotificationIcon(notification.type)} ${notification.title}`,
              description: notification.message,
              duration: 5000,
            });
          }

          if (event.type === 'notification.read') {
            const p = event.payload as any;
            if (p.unreadCount !== undefined) get().updateUnreadCount(p.unreadCount);
          }

          if (event.type === 'notification.read_all') {
            get().updateUnreadCount(0);
          }

          if (event.type === 'notification.deleted') {
            const p = event.payload as any;
            if (p.unreadCount !== undefined) get().updateUnreadCount(p.unreadCount);
          }
        };

        socketService.on('event', _socketHandler);
      },
    }),
    { name: 'NotificationStore' }
  )
);

export const selectNotifications = (s: NotificationState & NotificationActions) => s.notifications;
export const selectUnreadNotifications = (s: NotificationState & NotificationActions) =>
  s.notifications.filter((n) => !n.read);
export const selectUnreadCount = (s: NotificationState & NotificationActions) => s.unreadCount;
export const selectIsLoading = (s: NotificationState & NotificationActions) => s.isLoading;
export const selectIsOpen = (s: NotificationState & NotificationActions) => s.isOpen;
