// apps/web/src/hooks/useNotifications.ts

import { useEffect, useCallback, useRef } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { socketService } from '@/services/socketService';
import type { Event, Notification } from '@aether/types';
import { toast } from 'sonner';

/**
 * Hook para manejar notificaciones
 * Integra Zustand store + WebSocket para tiempo real
 */
export function useNotifications() {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const isLoading = useNotificationStore((state) => state.isLoading);
  const isOpen = useNotificationStore((state) => state.isOpen);

  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const deleteNotification = useNotificationStore((state) => state.deleteNotification);
  const toggleDropdown = useNotificationStore((state) => state.toggleDropdown);
  const closeDropdown = useNotificationStore((state) => state.closeDropdown);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const updateUnreadCount = useNotificationStore((state) => state.updateUnreadCount);

  const hasLoadedRef = useRef(false);

  // ============================================================================
  // FETCH INITIAL DATA
  // ============================================================================
  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchUnreadCount();
      hasLoadedRef.current = true;
    }
  }, [fetchUnreadCount]);

  // ============================================================================
  // REALTIME LISTENERS
  // ============================================================================
  useEffect(() => {
    const handleRealtimeEvent = (event: Event) => {
      // Notification Created
      if (event.type === 'notification.created') {
        const payload = event.payload as any;
        console.log('[useNotifications] Notification created:', payload);

        // Agregar notificación al store
        const notification: Notification = {
          id: payload.notificationId || payload.notification?.id,
          userId: payload.userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data,
          read: false,
          createdAt: new Date().toISOString(),
        };

        addNotification(notification);

        // Mostrar toast
        toast.info(notification.title, {
          description: notification.message,
          duration: 5000,
        });
      }

      // Notification Read
      if (event.type === 'notification.read') {
        const payload = event.payload as any;
        console.log('[useNotifications] Notification read:', payload);

        if (payload.unreadCount !== undefined) {
          updateUnreadCount(payload.unreadCount);
        }
      }

      // Notification Read All
      if (event.type === 'notification.read_all') {
        const payload = event.payload as any;
        console.log('[useNotifications] All notifications marked as read');

        updateUnreadCount(0);
      }

      // Notification Deleted
      if (event.type === 'notification.deleted') {
        const payload = event.payload as any;
        console.log('[useNotifications] Notification deleted:', payload);

        if (payload.unreadCount !== undefined) {
          updateUnreadCount(payload.unreadCount);
        }
      }
    };

    socketService.onEvent(handleRealtimeEvent);

    return () => {
      socketService.off('event', handleRealtimeEvent);
    };
  }, [addNotification, updateUnreadCount]);

  // ============================================================================
  // ACTIONS CON MANEJO DE ERRORES
  // ============================================================================

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await markAsRead(notificationId);
      } catch (error: any) {
        toast.error('Error al marcar como leída');
        console.error('[useNotifications] Error marking as read:', error);
      }
    },
    [markAsRead]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (error: any) {
      toast.error('Error al marcar todas como leídas');
      console.error('[useNotifications] Error marking all as read:', error);
    }
  }, [markAllAsRead]);

  const handleDeleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await deleteNotification(notificationId);
        toast.success('Notificación eliminada');
      } catch (error: any) {
        toast.error('Error al eliminar notificación');
        console.error('[useNotifications] Error deleting notification:', error);
      }
    },
    [deleteNotification]
  );

  const handleLoadNotifications = useCallback(async () => {
    try {
      await fetchNotifications();
    } catch (error: any) {
      toast.error('Error al cargar notificaciones');
      console.error('[useNotifications] Error loading notifications:', error);
    }
  }, [fetchNotifications]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const unreadNotifications = notifications.filter((n) => !n.read);
  const hasUnread = unreadCount > 0;

  return {
    // Data
    notifications,
    unreadNotifications,
    unreadCount,
    hasUnread,

    // Loading states
    isLoading,

    // UI state
    isOpen,
    toggleDropdown,
    closeDropdown,

    // Actions
    loadNotifications: handleLoadNotifications,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDeleteNotification,
  };
}

/**
 * Hook para escuchar notificaciones en tiempo real sin cargar la lista completa
 * Útil para mostrar solo el badge de contador
 */
export function useNotificationCount() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const updateUnreadCount = useNotificationStore((state) => state.updateUnreadCount);

  const hasLoadedRef = useRef(false);

  // Fetch inicial
  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchUnreadCount();
      hasLoadedRef.current = true;
    }
  }, [fetchUnreadCount]);

  // Escuchar eventos de tiempo real
  useEffect(() => {
    const handleRealtimeEvent = (event: Event) => {
      if (event.type === 'notification.created') {
        // Incrementar contador
        useNotificationStore.setState((state) => ({
          unreadCount: state.unreadCount + 1,
        }));
      }

      if (
        event.type === 'notification.read' ||
        event.type === 'notification.read_all' ||
        event.type === 'notification.deleted'
      ) {
        const payload = event.payload as any;
        if (payload.unreadCount !== undefined) {
          updateUnreadCount(payload.unreadCount);
        }
      }
    };

    socketService.onEvent(handleRealtimeEvent);

    return () => {
      socketService.off('event', handleRealtimeEvent);
    };
  }, [updateUnreadCount]);

  return {
    unreadCount,
    hasUnread: unreadCount > 0,
  };
}
