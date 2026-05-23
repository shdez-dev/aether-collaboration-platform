// apps/web/src/components/realtime/RealtimeNotificationProvider.tsx

'use client';

import { useEffect, useRef } from 'react';
import { socketService } from '@/services/socketService';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { type ToastVariant } from '@/components/ui/toast';

interface RealtimeEvent {
  type: string;
  payload: Record<string, any>;
  meta: {
    userId: string;
    eventId: string;
    timestamp: number;
    version: number;
    vectorClock: Record<string, number>;
    socketId?: string;
  };
}

interface NotificationConfig {
  title: string;
  description?: string;
  variant: ToastVariant;
}

/**
 * Provider que muestra toasts temporales para eventos del sistema en tiempo real.
 * Solo toasts — las notificaciones persistentes las maneja NotificationListener.
 */
export function RealtimeNotificationProvider() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { isSocketConnected } = useSocketContext();
  const handlerRef = useRef<((event: any) => void) | null>(null);

  useEffect(() => {
    if (!isSocketConnected) return;

    if (handlerRef.current) {
      socketService.off('event', handlerRef.current);
    }

    const handleEvent = (event: any) => {
      const realtimeEvent = event as RealtimeEvent;

      // No mostrar toast para eventos propios del usuario
      if (realtimeEvent.meta?.userId === user?.id) return;

      const notification = mapEventToNotification(realtimeEvent);
      if (!notification) return;

      toast({
        title:       notification.title,
        description: notification.description,
        variant:     notification.variant,
        duration:    3000,
      });
    };

    handlerRef.current = handleEvent;
    socketService.onEvent(handleEvent);

    return () => {
      socketService.off('event', handleEvent);
      handlerRef.current = null;
    };
  }, [isSocketConnected, toast, user?.id]);

  return null;
}

function mapEventToNotification(event: RealtimeEvent): NotificationConfig | null {
  const userName =
    event.payload?.assignedBy?.name  ||
    event.payload?.unassignedBy?.name ||
    event.payload?.completedBy?.name  ||
    event.payload?.updatedBy?.name    ||
    event.payload?.createdBy?.name    ||
    event.payload?.movedBy?.name      ||
    'Alguien';

  switch (event.type) {
    case 'card.member.assigned':
      return {
        title:       `${userName} te asignó una card`,
        description: event.payload.title ? `"${event.payload.title}"` : undefined,
        variant:     'success',
      };

    case 'card.member.removed':
      return {
        title:       `${userName} te quitó de una card`,
        description: event.payload.title ? `"${event.payload.title}"` : undefined,
        variant:     'warning',
      };

    case 'card.status-changed':
      return {
        title:       `${userName} completó una card`,
        description: event.payload.title ? `"${event.payload.title}"` : undefined,
        variant:     'success',
      };

    case 'workspace.member.invited':
      return {
        title:       `${userName} te agregó a un workspace`,
        description: event.payload.workspace?.name,
        variant:     'info',
      };

    case 'workspace.member.removed':
      return {
        title:       `${userName} te quitó de un workspace`,
        description: event.payload.workspace?.name,
        variant:     'error',
      };

    default:
      return null;
  }
}
