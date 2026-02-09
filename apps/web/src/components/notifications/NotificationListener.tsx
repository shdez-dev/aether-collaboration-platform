// apps/web/src/components/notifications/NotificationListener.tsx

'use client';

import { useEffect, useRef } from 'react';
import { socketService } from '@/services/socketService';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Event, Notification } from '@aether/types';
import { toast as showToast } from '@/hooks/use-toast';

/**
 * Componente invisible que escucha eventos de notificaciones en tiempo real
 * Se monta UNA SOLA VEZ en el layout para evitar listeners duplicados
 */
export function NotificationListener() {
  const addNotification = useNotificationStore((state) => state.addNotification);
  const updateUnreadCount = useNotificationStore((state) => state.updateUnreadCount);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const hasSetupRef = useRef(false);

  // Fetch inicial del contador
  useEffect(() => {
    if (!hasSetupRef.current) {
      fetchUnreadCount();
    }
  }, [fetchUnreadCount]);

  // Listener de eventos en tiempo real (SOLO UNA VEZ)
  useEffect(() => {
    // Evitar configuración duplicada
    if (hasSetupRef.current) {
      return;
    }

    if (!socketService.isConnected()) {
      return;
    }

    hasSetupRef.current = true;

    const handleRealtimeEvent = (event: Event) => {
      // ============================================================
      // NOTIFICATION CREATED
      // ============================================================
      if (event.type === 'notification.created') {
        const payload = event.payload as any;

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

        // Mostrar toast con ícono según tipo de notificación
        const getNotificationIcon = (type: string) => {
          switch (type) {
            case 'WORKSPACE_INVITE':
              return '📩';
            case 'CARD_ASSIGNED':
              return '📌';
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
        };

        const icon = getNotificationIcon(notification.type);

        showToast({
          title: `${icon} ${notification.title}`,
          description: notification.message,
          duration: 5000,
        });
      }

      // ============================================================
      // NOTIFICATION READ
      // ============================================================
      if (event.type === 'notification.read') {
        const payload = event.payload as any;

        if (payload.unreadCount !== undefined) {
          updateUnreadCount(payload.unreadCount);
        }
      }

      // ============================================================
      // NOTIFICATION READ ALL
      // ============================================================
      if (event.type === 'notification.read_all') {
        updateUnreadCount(0);
      }

      // ============================================================
      // NOTIFICATION DELETED
      // ============================================================
      if (event.type === 'notification.deleted') {
        const payload = event.payload as any;

        if (payload.unreadCount !== undefined) {
          updateUnreadCount(payload.unreadCount);
        }
      }
    };

    socketService.onEvent(handleRealtimeEvent);

    return () => {
      socketService.off('event', handleRealtimeEvent);
      hasSetupRef.current = false;
    };
  }, [addNotification, updateUnreadCount, fetchUnreadCount]);

  return null;
}
