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
      return;
    }

    this.isConnecting = true;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';


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
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.flushEventQueue();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnecting = false;

      if (reason === 'io server disconnect') {
        // Servidor desconectó, reconectar manualmente
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.isConnecting = false;
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.reconnectAttempts = 0;
      this.flushEventQueue();
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
    });

    this.socket.on('reconnect_failed', () => {
    });

    // Ping/Pong para mantener conexión activa
    this.socket.on('pong', (data: { timestamp: number }) => {
    });

    this.socket.on('error', (error: { message: string }) => {
    });
  }

  /**
   * Desconectar del servidor WebSocket
   */
  disconnect(): void {
    if (!this.socket) return;

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
  // ==================== DOCUMENT METHODS ====================

  /**
   * Unirse a un documento para colaboración
   */
  joinDocument(documentId: string, workspaceId: string): void {
    if (!this.isConnected()) {
      console.warn('[Socket] Not connected, queueing document:join');
      this.eventQueue.push({ event: 'document:join', data: { documentId, workspaceId } });
      return;
    }
    this.socket?.emit('document:join', { documentId, workspaceId });
  }

  /**
   * Salir de un documento
   */
  leaveDocument(documentId: string): void {
    if (!this.isConnected()) return;
    this.socket?.emit('document:leave', { documentId });
  }

  /**
   * Enviar update de Yjs
   */
  sendYjsUpdate(documentId: string, update: Uint8Array): void {
    if (!this.isConnected()) return;
    this.socket?.emit('document:yjs:update', { documentId, update: Array.from(update) });
  }

  /**
   * Recibir update de Yjs
   */
  onYjsUpdate(callback: (data: { documentId: string; update: number[] }) => void): void {
    this.on('document:yjs:update', callback);
  }

  /**
   * Recibir sincronización inicial
   */
  onYjsSync(callback: (data: { documentId: string; update: number[] }) => void): void {
    this.on('document:sync', callback);
  }

  /**
   * Enviar awareness (cursor/selección)
   */
  sendAwareness(
    documentId: string,
    cursor?: number,
    selection?: { from: number; to: number }
  ): void {
    if (!this.isConnected()) return;
    this.socket?.emit('document:awareness', { documentId, cursor, selection });
  }

  /**
   * Recibir awareness de otros usuarios
   */
  onAwareness(
    callback: (data: { documentId: string; user: any; cursor?: number; selection?: any }) => void
  ): void {
    this.on('document:awareness', callback);
  }

  /**
   * Escuchar cuando un usuario se une al documento
   */
  onDocumentUserJoined(callback: (data: { documentId: string; user: any }) => void): void {
    this.on('document:user:joined', callback);
  }

  /**
   * Escuchar cuando un usuario sale del documento
   */
  onDocumentUserLeft(callback: (data: { documentId: string; userId: string }) => void): void {
    this.on('document:user:left', callback);
  }

  /**
   * Escuchar cambios de permisos en tiempo real
   */
  onPermissionChanged(
    callback: (data: {
      documentId: string;
      permission: 'VIEW' | 'COMMENT' | 'EDIT';
      updatedBy: string;
    }) => void
  ): void {
    this.on('document:permission:changed', callback);
  }
}

// Exportar instancia singleton
export const socketService = new SocketService();

// Exportar clase para testing si es necesario
export default SocketService;
