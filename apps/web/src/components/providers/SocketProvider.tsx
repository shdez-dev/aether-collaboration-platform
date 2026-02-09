// apps/web/src/components/providers/SocketProvider.tsx

'use client';

import { useEffect, useRef } from 'react';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';

/**
 * Provider que gestiona la conexión global del WebSocket
 * Se encarga de conectar/desconectar automáticamente según el estado de autenticación
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthStore();
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    // Si no hay token o usuario, desconectar
    if (!accessToken || !user) {
      if (socketService.isConnected()) {
        socketService.disconnect();
        hasConnectedRef.current = false;
      }
      return;
    }

    // Si ya está conectado, no volver a conectar
    if (hasConnectedRef.current && socketService.isConnected()) {
      return;
    }

    // Conectar al WebSocket
    socketService.connect(accessToken);
    hasConnectedRef.current = true;

    // Cleanup al desmontar
    return () => {
      // NO desconectar aquí porque puede ser un remount temporal
      // La desconexión se maneja en el logout
    };
  }, [accessToken, user]);

  return <>{children}</>;
}
