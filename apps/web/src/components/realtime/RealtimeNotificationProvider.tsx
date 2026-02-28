// apps/web/src/components/realtime/RealtimeNotificationProvider.tsx

'use client';

import { useEffect, useRef } from 'react';
import { socketService } from '@/services/socketService';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { CheckCircle2, Trash2, Edit3, MoveRight, Plus, ListPlus } from 'lucide-react';

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
  message: string;
  description?: string;
  icon: any;
  variant?: 'default' | 'destructive';
}

/**
 * Provider que muestra toasts temporales para eventos del sistema en tiempo real.
 * Solo toasts — las notificaciones persistentes las maneja NotificationListener.
 */
export function RealtimeNotificationProvider() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { isSocketConnected } = useSocketContext();
  // Guardamos la referencia al handler activo para poder hacer off preciso
  const handlerRef = useRef<((event: any) => void) | null>(null);

  useEffect(() => {
    if (!isSocketConnected) return;

    // Limpiar handler previo si existe (evita acumulación en re-renders)
    if (handlerRef.current) {
      socketService.off('event', handlerRef.current);
    }

    const handleEvent = (event: any) => {
      const realtimeEvent = event as RealtimeEvent;

      // No mostrar toast para eventos propios del usuario
      if (realtimeEvent.meta?.userId === user?.id) return;

      const notification = mapEventToNotification(realtimeEvent);
      if (!notification) return;

      const Icon = notification.icon;
      toast({
        description: (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">{notification.message}</span>
              {notification.description && (
                <span className="text-xs text-muted-foreground">{notification.description}</span>
              )}
            </div>
          </div>
        ),
        variant: notification.variant || 'default',
        duration: 3000,
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
    event.payload?.assignedBy?.name ||
    event.payload?.unassignedBy?.name ||
    event.payload?.completedBy?.name ||
    event.payload?.updatedBy?.name ||
    event.payload?.createdBy?.name ||
    event.payload?.movedBy?.name ||
    'Alguien';

  switch (event.type) {
    case 'card.member.assigned':
      return {
        message: `${userName} te asignó una card`,
        description: event.payload.title ? `"${event.payload.title}"` : undefined,
        icon: Plus,
      };

    case 'card.member.unassigned':
      return {
        message: `${userName} te quitó de una card`,
        description: event.payload.title ? `"${event.payload.title}"` : undefined,
        icon: Trash2,
      };

    case 'card.completed':
      return {
        message: `${userName} completó una card`,
        description: event.payload.title ? `"${event.payload.title}"` : undefined,
        icon: CheckCircle2,
      };

    case 'workspace.member.invited':
      return {
        message: `${userName} te agregó a un workspace`,
        description: event.payload.workspace?.name,
        icon: Plus,
      };

    case 'workspace.member.removed':
      return {
        message: `${userName} te quitó de un workspace`,
        description: event.payload.workspace?.name,
        icon: Trash2,
        variant: 'destructive',
      };

    default:
      return null;
  }
}
