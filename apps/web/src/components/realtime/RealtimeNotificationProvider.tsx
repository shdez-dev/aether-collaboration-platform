// apps/web/src/components/realtime/RealtimeNotificationProvider.tsx

'use client';

import { useEffect, useRef } from 'react';
import { socketService } from '@/services/socketService';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { CheckCircle2, Trash2, Edit3, MoveRight, Plus, ListPlus } from 'lucide-react';

/**
 * Tipo personalizado para eventos de WebSocket
 */
interface RealtimeEvent {
  type: string;
  payload: Record<string, any>;
  metadata?: {
    userId?: string;
    user?: {
      id: string;
      name: string;
      email?: string;
    };
    timestamp?: string;
    socketId?: string;
  };
}

/**
 * Configuración de notificación
 */
interface NotificationConfig {
  message: string;
  description?: string;
  icon: any;
  variant?: 'default' | 'destructive';
}

/**
 * RealtimeNotificationProvider
 * Provider que escucha eventos de WebSocket y muestra notificaciones toast
 * Debe montarse en el layout del board, después del Toaster
 *
 * @example
 * ```tsx
 * // apps/web/src/app/(authenticated)/boards/[boardId]/layout.tsx
 *
 * export default function BoardLayout({ children }) {
 *   return (
 *     <>
 *       <Toaster />
 *       <RealtimeNotificationProvider />
 *       {children}
 *     </>
 *   );
 * }
 * ```
 */
export function RealtimeNotificationProvider() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const hasSetupRef = useRef(false);

  useEffect(() => {
    // Evitar setup múltiple
    if (hasSetupRef.current) return;
    if (!socketService.isConnected()) return;

    console.log('[RealtimeNotificationProvider] Setting up event listeners');
    hasSetupRef.current = true;

    // Listener principal de eventos
    const handleEvent = (event: any) => {
      // Type casting seguro
      const realtimeEvent = event as RealtimeEvent;

      // No mostrar notificación de mis propios eventos
      if (realtimeEvent.metadata?.userId === user?.id) {
        console.log('[RealtimeNotificationProvider] Ignoring own event:', realtimeEvent.type);
        return;
      }

      const notification = mapEventToNotification(realtimeEvent);

      if (notification) {
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

        console.log('[RealtimeNotificationProvider] Notification shown:', notification.message);
      }
    };

    // Suscribirse a eventos
    socketService.onEvent(handleEvent);

    // Cleanup
    return () => {
      console.log('[RealtimeNotificationProvider] Cleaning up event listeners');
      socketService.off('event', handleEvent);
      hasSetupRef.current = false;
    };
  }, [toast, user?.id]);

  // Este componente no renderiza nada
  return null;
}

/**
 * Mapear eventos a notificaciones
 */
function mapEventToNotification(event: RealtimeEvent): NotificationConfig | null {
  const userName = event.metadata?.user?.name || 'Alguien';

  switch (event.type) {
    // ========== CARD EVENTS ==========
    case 'card.created': {
      const card = event.payload.card;
      return {
        message: `${userName} creó una card`,
        description: card?.title ? `"${card.title}"` : undefined,
        icon: Plus,
      };
    }

    case 'card.updated': {
      const changes = event.payload.changes;
      const field = changes ? Object.keys(changes)[0] : undefined;

      return {
        message: `${userName} actualizó una card`,
        description: field ? `Cambió ${getFieldLabel(field)}` : undefined,
        icon: Edit3,
      };
    }

    case 'card.moved': {
      const { fromListId, toListId } = event.payload;
      return {
        message: `${userName} movió una card`,
        description: fromListId !== toListId ? 'A otra lista' : 'Cambió posición',
        icon: MoveRight,
      };
    }

    case 'card.deleted':
      return {
        message: `${userName} eliminó una card`,
        icon: Trash2,
        variant: 'destructive',
      };

    // ========== LIST EVENTS ==========
    case 'list.created': {
      const list = event.payload.list;
      return {
        message: `${userName} creó una lista`,
        description: list?.name ? `"${list.name}"` : undefined,
        icon: ListPlus,
      };
    }

    case 'list.updated': {
      const changes = event.payload.changes;
      return {
        message: `${userName} renombró una lista`,
        description: changes?.name ? `"${changes.name}"` : undefined,
        icon: Edit3,
      };
    }

    case 'list.deleted':
      return {
        message: `${userName} eliminó una lista`,
        icon: Trash2,
        variant: 'destructive',
      };

    case 'list.reordered':
      return {
        message: `${userName} reordenó las listas`,
        icon: MoveRight,
      };

    // ========== BOARD EVENTS ==========
    case 'board.updated': {
      const changes = event.payload.changes;
      return {
        message: `${userName} actualizó el board`,
        description: changes?.name ? `"${changes.name}"` : undefined,
        icon: Edit3,
      };
    }

    // No mostrar notificación para eventos no implementados
    default:
      return null;
  }
}

/**
 * Obtener label legible para campos
 */
function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    title: 'el título',
    description: 'la descripción',
    dueDate: 'la fecha de vencimiento',
    priority: 'la prioridad',
    position: 'la posición',
    name: 'el nombre',
  };

  return labels[field] || field;
}
