// apps/web/src/hooks/useRealtimeBoard.ts

import { useEffect, useCallback, useRef } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook para manejo automático de sincronización en tiempo real de un board
 *
 * @param boardId - ID del board a sincronizar
 * @param options - Opciones de configuración
 * @returns Estado y métodos del board en tiempo real
 *
 */
export function useRealtimeBoard(
  boardId: string | null,
  options: {
    /**
     * Si es false, no se conecta automáticamente
     * Útil para boards archivados o en modo lectura
     */
    autoConnect?: boolean;

    /**
     * Callback cuando se conecta exitosamente
     */
    onConnect?: () => void;

    /**
     * Callback cuando se desconecta
     */
    onDisconnect?: () => void;

    /**
     * Callback cuando cambia la lista de usuarios activos
     */
    onActiveUsersChange?: (users: any[]) => void;
  } = {}
) {
  const { autoConnect = true, onConnect, onDisconnect, onActiveUsersChange } = options;

  // ==================== STATE FROM STORES ====================
  const {
    currentBoard,
    lists,
    isLoading,
    error,
    isSocketConnected,
    activeUsers,
    fetchBoardById,
    connectSocket,
    disconnectSocket,
    joinBoard,
    leaveBoard,
    selectBoard,
  } = useBoardStore();

  const { isAuthenticated } = useAuthStore();

  // ==================== REFS ====================
  const prevBoardIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // ==================== CALLBACKS ====================

  /**
   * Inicializar conexión al board
   */
  const initialize = useCallback(() => {
    if (!boardId || !isAuthenticated || !autoConnect) {
      return;
    }

    console.log('[useRealtimeBoard] Initializing board:', boardId);

    // 1. Fetch board data
    fetchBoardById(boardId);

    // 2. Socket se conecta automáticamente dentro de fetchBoardById
    // (ver boardStore.ts línea ~420)

    isInitializedRef.current = true;
  }, [boardId, isAuthenticated, autoConnect, fetchBoardById]);

  /**
   * Limpiar conexión al board
   */
  const cleanup = useCallback(() => {
    if (!prevBoardIdRef.current) return;

    console.log('[useRealtimeBoard] Cleaning up board:', prevBoardIdRef.current);

    // Salir del board actual
    leaveBoard(prevBoardIdRef.current);

    // No desconectar socket (puede usarse en otro board)
    // Solo se desconecta cuando el componente se desmonta completamente

    isInitializedRef.current = false;
  }, [leaveBoard]);

  /**
   * Refrescar datos del board (sin perder conexión)
   */
  const refresh = useCallback(async () => {
    if (!boardId) return;

    console.log('[useRealtimeBoard] Refreshing board:', boardId);
    await fetchBoardById(boardId);
  }, [boardId, fetchBoardById]);

  /**
   * Reconectar socket manualmente
   */
  const reconnect = useCallback(() => {
    console.log('[useRealtimeBoard] Manual reconnect');
    disconnectSocket();
    setTimeout(() => {
      connectSocket();
      if (boardId) {
        joinBoard(boardId);
      }
    }, 100);
  }, [boardId, connectSocket, disconnectSocket, joinBoard]);

  // ==================== EFFECTS ====================

  /**
   * Effect 1: Inicializar/Cambiar board
   */
  useEffect(() => {
    if (!boardId || !isAuthenticated) {
      return;
    }

    // Si cambió el boardId, hacer cleanup del anterior
    if (prevBoardIdRef.current && prevBoardIdRef.current !== boardId) {
      cleanup();
    }

    // Inicializar nuevo board
    initialize();

    // Guardar referencia
    prevBoardIdRef.current = boardId;

    // Cleanup cuando se desmonta o cambia boardId
    return () => {
      cleanup();
    };
  }, [boardId, isAuthenticated, initialize, cleanup]);

  /**
   * Effect 2: Cleanup global al desmontar componente
   */
  useEffect(() => {
    return () => {
      // Al desmontar el componente completamente, desconectar socket
      console.log('[useRealtimeBoard] Component unmounting, disconnecting socket');
      disconnectSocket();
      selectBoard(null);
    };
  }, [disconnectSocket, selectBoard]);

  /**
   * Effect 3: Callbacks de conexión
   */
  useEffect(() => {
    if (isSocketConnected && onConnect) {
      onConnect();
    }

    if (!isSocketConnected && onDisconnect) {
      onDisconnect();
    }
  }, [isSocketConnected, onConnect, onDisconnect]);

  /**
   * Effect 4: Callback de usuarios activos
   */
  useEffect(() => {
    if (onActiveUsersChange) {
      onActiveUsersChange(activeUsers);
    }
  }, [activeUsers, onActiveUsersChange]);

  // ==================== RETURN ====================

  return {
    // Estado del board
    board: currentBoard,
    lists,
    isLoading,
    error,

    // Estado de conexión
    isConnected: isSocketConnected,
    activeUsers,

    // Métodos
    refresh,
    reconnect,

    // Información útil
    isInitialized: isInitializedRef.current,
    boardId,
  };
}

/**
 * Hook simplificado para solo verificar si estás conectado a un board
 *
 * @example
 * ```tsx
 * function SomeComponent() {
 *   const isConnected = useBoardConnection();
 *
 *   return <ConnectionIndicator active={isConnected} />;
 * }
 * ```
 */
export function useBoardConnection() {
  const { isSocketConnected } = useBoardStore();
  return isSocketConnected;
}

/**
 * Hook para obtener solo la lista de usuarios activos
 *
 * @example
 * ```tsx
 * function ActiveUsersWidget() {
 *   const users = useActiveUsers();
 *
 *   return (
 *     <div>
 *       {users.map(user => (
 *         <Avatar key={user.id} {...user} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useActiveUsers() {
  const { activeUsers } = useBoardStore();
  return activeUsers;
}
