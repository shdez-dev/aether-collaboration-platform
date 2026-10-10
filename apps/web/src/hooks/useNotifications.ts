// apps/web/src/hooks/useNotifications.ts

import { createElement, useCallback, useRef, useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { toast as showToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

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
  const archiveNotification = useNotificationStore((state) => state.archiveNotification);
  const restoreNotification = useNotificationStore((state) => state.restoreNotification);
  const resolveNotification = useNotificationStore((state) => state.resolveNotification);
  const toggleDropdown = useNotificationStore((state) => state.toggleDropdown);
  const closeDropdown = useNotificationStore((state) => state.closeDropdown);
  // NO escuchamos eventos aquí - eso lo hace NotificationListener globalmente
  // Este hook solo proporciona acceso al store y acciones

  // ============================================================================
  // ACTIONS CON MANEJO DE ERRORES
  // ============================================================================

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await markAsRead(notificationId);
      } catch (error: any) {
        showToast({
          title: 'Error al marcar como leída',
          variant: 'destructive',
        });
      }
    },
    [markAsRead]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      showToast({
        title: 'Todas las notificaciones marcadas como leídas',
      });
    } catch (error: any) {
      showToast({
        title: 'Error al marcar todas como leídas',
        variant: 'destructive',
      });
    }
  }, [markAllAsRead]);

  const handleDeleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await deleteNotification(notificationId);
        showToast({
          title: 'Notificación eliminada',
        });
      } catch (error: any) {
        showToast({
          title: 'Error al eliminar notificación',
          variant: 'destructive',
        });
      }
    },
    [deleteNotification]
  );

  const handleRestoreNotification = useCallback(async (notificationId: string) => {
    try {
      await restoreNotification(notificationId);
      showToast({ title: 'Notificación recuperada', description: 'Volvió a aparecer en tu bandeja.' });
    } catch {
      showToast({ title: 'No se pudo recuperar la notificación', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    }
  }, [restoreNotification]);

  const handleArchiveNotification = useCallback(async (notificationId: string) => {
    try {
      await archiveNotification(notificationId);
      showToast({
        title: 'Notificación archivada',
        description: 'Se quitó de tu bandeja. Puedes recuperarla ahora.',
        action: createElement(ToastAction, {
          altText: 'Deshacer el archivado',
          onClick: () => { void handleRestoreNotification(notificationId); },
        }, 'Deshacer'),
      });
    } catch {
      showToast({ title: 'Error al archivar la notificación', description: 'Inténtalo de nuevo.', variant: 'destructive' });
    }
  }, [archiveNotification, handleRestoreNotification]);

  const handleResolveNotification = useCallback(async (notificationId: string) => {
    try { await resolveNotification(notificationId); }
    catch { showToast({ title: 'Error al resolver la notificación', variant: 'destructive' }); }
  }, [resolveNotification]);

  const handleLoadNotifications = useCallback(async () => {
    try {
      await fetchNotifications();
    } catch (error: any) {
      showToast({
        title: 'Error al cargar notificaciones',
        variant: 'destructive',
      });
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
    archiveNotification: handleArchiveNotification,
    resolveNotification: handleResolveNotification,
  };
}

/**
 * Hook simplificado para mostrar solo el contador de notificaciones
 * NO escucha eventos en tiempo real - eso lo hace useNotifications
 * Solo lee del store compartido
 */
export function useNotificationCount() {
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);

  const hasLoadedRef = useRef(false);

  // Fetch inicial SOLO si el store está vacío
  useEffect(() => {
    if (!hasLoadedRef.current) {
      fetchUnreadCount();
      hasLoadedRef.current = true;
    }
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    hasUnread: unreadCount > 0,
  };
}
