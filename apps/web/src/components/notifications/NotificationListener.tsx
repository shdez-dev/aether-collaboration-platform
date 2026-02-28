// apps/web/src/components/notifications/NotificationListener.tsx

'use client';

import { useEffect } from 'react';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useNotificationStore } from '@/stores/notificationStore';

/**
 * Componente invisible que inicializa el listener de notificaciones
 * en tiempo real. Delega toda la lógica al store (singleton) para
 * garantizar que el listener se registre exactamente una vez,
 * independiente de re-renders, StrictMode o reconexiones.
 */
export function NotificationListener() {
  const { isSocketConnected } = useSocketContext();
  const initSocketListener = useNotificationStore((s) => s.initSocketListener);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  useEffect(() => {
    if (!isSocketConnected) return;
    // Inicializar listener (el store garantiza que solo ocurre una vez)
    initSocketListener();
    // Sincronizar contador con el servidor al conectarse
    fetchUnreadCount();
  }, [isSocketConnected, initSocketListener, fetchUnreadCount]);

  return null;
}
