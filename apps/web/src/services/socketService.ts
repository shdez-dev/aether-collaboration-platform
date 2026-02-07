// apps/web/src/services/socketService.ts

import { io, Socket } from 'socket.io-client';
import type { Event } from '@aether/types';

/**
 * SocketService
 * Maneja la conexión WebSocket con el backend
 * Singleton para mantener una única conexión activa
 */
class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventQueue: Array<{ event: string; data: any }> = [];
  private isConnecting = false;

  /**
   * Conectar al servidor WebSocket
   */
  connect(token: string): void {
    if (this.socket?.connected || this.isConnecting) {
      console.log('[Socket] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

    console.log('[Socket] Connecting to:', wsUrl);

    this.socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  /**
   * Configurar event handlers del socket
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected:', this.socket?.id);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.flushEventQueue();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      this.isConnecting = false;

      if (reason === 'io server disconnect') {
        // Servidor desconectó, reconectar manualmente
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.isConnecting = false;
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[Socket] Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
      this.flushEventQueue();
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnection attempt:', attemptNumber);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[Socket] Reconnection failed');
    });

    // Ping/Pong para mantener conexión activa
    this.socket.on('pong', (data: { timestamp: number }) => {
      console.log('[Socket] Pong received, latency:', Date.now() - data.timestamp, 'ms');
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('[Socket] Error:', error.message);
    });
  }

  /**
   * Desconectar del servidor WebSocket
   */
  disconnect(): void {
    if (!this.socket) return;

    console.log('[Socket] Disconnecting...');
    this.socket.disconnect();
    this.socket = null;
    this.eventQueue = [];
    this.isConnecting = false;
  }

  /**
   * Unirse a un board (room)
   */
  joinBoard(boardId: string): void {
    if (!this.isConnected()) {
      console.warn('[Socket] Not connected, queueing join:board');
      this.eventQueue.push({ event: 'join:board', data: { boardId } });
      return;
    }

    console.log('[Socket] Joining board:', boardId);
    this.socket?.emit('join:board', { boardId });
  }

  /**
   * Salir de un board (room)
   */
  leaveBoard(boardId: string): void {
    if (!this.isConnected()) {
      console.warn('[Socket] Not connected, skipping leave:board');
      return;
    }

    console.log('[Socket] Leaving board:', boardId);
    this.socket?.emit('leave:board', { boardId });
  }

  /**
   * Emitir un evento al servidor
   */
  emit(event: string, data: any): void {
    if (!this.isConnected()) {
      console.warn(`[Socket] Not connected, queueing event: ${event}`);
      this.eventQueue.push({ event, data });
      return;
    }

    this.socket?.emit(event, data);
  }

  /**
   * Escuchar un evento del servidor
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.socket) {
      console.warn('[Socket] Socket not initialized');
      return;
    }

    this.socket.on(event, callback);
  }

  /**
   * Dejar de escuchar un evento
   */
  off(event: string, callback?: (data: any) => void): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Escuchar eventos de presencia
   */
  onPresenceUsers(callback: (data: { boardId: string; users: any[] }) => void): void {
    this.on('presence:users', callback);
  }

  /**
   * Escuchar cuando te unes a un board exitosamente
   */
  onJoinedBoard(callback: (data: { boardId: string; users: any[] }) => void): void {
    this.on('joined:board', callback);
  }

  /**
   * Escuchar eventos del sistema (card.created, card.moved, etc.)
   */
  onEvent(callback: (event: Event) => void): void {
    this.on('event', (event: Event) => {
      console.log('[Socket] Event received:', event.type, event);
      callback(event);
    });
  }

  /**
   * Escuchar indicadores de typing
   */
  onTypingStarted(
    callback: (data: { cardId: string; userId: string; userName: string }) => void
  ): void {
    this.on('typing:started', callback);
  }

  onTypingStopped(callback: (data: { cardId: string; userId: string }) => void): void {
    this.on('typing:stopped', callback);
  }

  /**
   * Emitir evento de typing start
   */
  startTyping(cardId: string): void {
    if (!this.isConnected()) {
      console.warn('[Socket] Cannot start typing - not connected');
      return;
    }
    console.log('[Socket] Emitting typing:start for card:', cardId);
    this.emit('typing:start', { cardId });
  }

  /**
   * Emitir evento de typing stop
   */
  stopTyping(cardId: string): void {
    if (!this.isConnected()) {
      console.warn('[Socket] Cannot stop typing - not connected');
      return;
    }
    console.log('[Socket] Emitting typing:stop for card:', cardId);
    this.emit('typing:stop', { cardId });
  }

  /**
   * Enviar ping al servidor
   */
  ping(): void {
    if (!this.isConnected()) return;
    this.socket?.emit('ping');
  }

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Obtener el socket ID actual
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Procesar cola de eventos pendientes
   */
  private flushEventQueue(): void {
    if (this.eventQueue.length === 0) return;

    console.log('[Socket] Flushing event queue:', this.eventQueue.length, 'events');

    while (this.eventQueue.length > 0) {
      const { event, data } = this.eventQueue.shift()!;
      this.socket?.emit(event, data);
    }
  }

  /**
   * Limpiar todos los event listeners
   */
  removeAllListeners(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
  }
}

// Exportar instancia singleton
export const socketService = new SocketService();

// Exportar clase para testing si es necesario
export default SocketService;
