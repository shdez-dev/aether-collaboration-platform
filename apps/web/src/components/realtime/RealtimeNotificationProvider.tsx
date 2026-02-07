// apps/web/src/components/realtime/RealtimeNotificationProvider.tsx

'use client';

import { useEffect, useRef } from 'react';
import { socketService } from '@/services/socketService';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { CheckCircle2, Trash2, Edit3, MoveRight, Plus, ListPlus } from 'lucide-react';

/**
 * Estructura de eventos recibidos del WebSocket
 */
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

/**
 * Configuración para cada tipo de notificación
 */
interface NotificationConfig {
  message: string;
  description?: string;
  icon: any;
  variant?: 'default' | 'destructive';
}

/**
 * Provider que gestiona toasts de notificaciones en tiempo real
 *
 * IMPORTANTE: Este provider SOLO muestra toasts.
 * Las notificaciones persistentes se manejan en useNotifications.ts
 *
 * Responsabilidades:
 * - Escuchar eventos del WebSocket
 * - Mostrar toasts temporales
 * - Filtrar eventos propios del usuario
 */
export function RealtimeNotificationProvider() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const hasSetupRef = useRef(false);

  useEffect(() => {
    // Evitar configuración duplicada
    if (hasSetupRef.current) return;

    if (!socketService.isConnected()) {
      console.log('[RealtimeNotificationProvider] Socket not connected, skipping setup');
      return;
    }

    console.log('[RealtimeNotificationProvider] Initializing toast event listeners');
    hasSetupRef.current = true;

    /**
     * Handler para eventos del sistema
     * Solo muestra toasts, NO maneja notificaciones persistentes
     */
    const handleEvent = (event: any) => {
      const realtimeEvent = event as RealtimeEvent;

      // Ignorar eventos generados por el usuario actual
      if (realtimeEvent.meta?.userId === user?.id) {
        return;
      }

      const notification = mapEventToNotification(realtimeEvent);

      if (notification) {
        const Icon = notification.icon;

        // Mostrar toast temporal
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

        console.log('[RealtimeNotificationProvider] Toast displayed:', notification.message);
      }
    };

    // Registrar listener solo para eventos del sistema
    socketService.onEvent(handleEvent);

    // Cleanup al desmontar
    return () => {
      console.log('[RealtimeNotificationProvider] Removing toast event listeners');
      socketService.off('event', handleEvent);
      hasSetupRef.current = false;
    };
  }, [toast, user?.id]);

  return null;
}

/**
 * Mapea eventos del sistema a configuraciones de toast
 *
 * NOTA: Solo eventos que merecen un toast visible, no todos los eventos.
 * Las notificaciones persistentes se manejan en el hook useNotifications.
 *
 * @param event - Evento recibido del WebSocket
 * @returns Configuración de toast o null si no debe mostrarse
 */
function mapEventToNotification(event: RealtimeEvent): NotificationConfig | null {
  // Extraer nombre del usuario que generó el evento
  const userName =
    event.payload?.assignedBy?.name ||
    event.payload?.unassignedBy?.name ||
    event.payload?.completedBy?.name ||
    event.payload?.updatedBy?.name ||
    event.payload?.createdBy?.name ||
    event.payload?.movedBy?.name ||
    'Alguien';

  switch (event.type) {
    // EVENTOS DE CARDS - Solo los más relevantes
    case 'card.member.assigned': {
      const title = event.payload.title;
      return {
        message: `${userName} te asignó una card`,
        description: title ? `"${title}"` : undefined,
        icon: Plus,
      };
    }

    case 'card.member.unassigned': {
      const title = event.payload.title;
      return {
        message: `${userName} te quitó de una card`,
        description: title ? `"${title}"` : undefined,
        icon: Trash2,
      };
    }

    case 'card.completed': {
      const title = event.payload.title;
      return {
        message: `${userName} completó una card`,
        description: title ? `"${title}"` : undefined,
        icon: CheckCircle2,
      };
    }

    // EVENTOS DE WORKSPACES - Muy importantes
    case 'workspace.member.added': {
      return {
        message: `${userName} te agregó a un workspace`,
        description: event.payload.workspace?.name,
        icon: Plus,
      };
    }

    case 'workspace.member.removed': {
      return {
        message: `${userName} te quitó de un workspace`,
        description: event.payload.workspace?.name,
        icon: Trash2,
        variant: 'destructive',
      };
    }

    // No mostrar toast para otros eventos
    // (pueden generar ruido innecesario)
    default:
      return null;
  }
}
