// apps/web/src/components/providers/SocketProvider.tsx

'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';

interface SocketContextValue {
  /** true en cuanto el socket haya completado el handshake TCP */
  isSocketConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ isSocketConnected: false });

/** Hook para consumir el estado de conexión del socket en cualquier componente hijo */
export function useSocketContext() {
  return useContext(SocketContext);
}

/**
 * Provider que gestiona la conexión global del WebSocket.
 * Expone `isSocketConnected` por contexto para que los listeners
 * (NotificationListener, RealtimeNotificationProvider, etc.) sepan
 * exactamente cuándo el socket está listo, sin race conditions.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  const hasConnectedRef = useRef(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    // Sin token o usuario: desconectar
    if (!accessToken || !user) {
      if (socketService.isConnected()) {
        socketService.disconnect();
        hasConnectedRef.current = false;
      }
      setIsSocketConnected(false);
      return;
    }

    // Callback que dispara cuando la conexión TCP se establece (o reconecta)
    const onConnected = () => setIsSocketConnected(true);

    // Suscribirse ANTES de llamar connect() para no perder el evento
    socketService.onConnect(onConnected);

    // Si ya está conectado, no volver a conectar
    if (!(hasConnectedRef.current && socketService.isConnected())) {
      socketService.connect(accessToken);
      hasConnectedRef.current = true;
    }

    return () => {
      socketService.offConnect(onConnected);
      // No desconectar aquí: puede ser un remount temporal (Strict Mode, HMR)
    };
  }, [accessToken, user]);

  return <SocketContext.Provider value={{ isSocketConnected }}>{children}</SocketContext.Provider>;
}
