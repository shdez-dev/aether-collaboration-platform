// apps/web/src/services/socketService.ts

import { io, Socket } from 'socket.io-client';
import type { Event } from '@aether/types';

/**
 * SocketService
 * Maneja la conexión WebSocket con el backend.
 * Singleton para mantener una única conexión activa.
 *
 * Diseño robusto:
 * - Cola de eventos emitidos mientras el socket no está conectado
 * - Cola de listeners registrados antes de que el socket exista
 * - Rejoin automático de documentos tras reconexión
 * - Notificación a suscriptores cuando la conexión (re)se establece
 */
class SocketService {
  private socket: Socket | null = null;
  private reconnectDelay = 1000;

  // Eventos emitidos mientras el socket no estaba conectado
  private eventQueue: Array<{ event: string; data: any }> = [];

  // Listeners registrados antes de que el socket existiera
  private pendingListeners: Array<{ event: string; callback: (data: any) => void }> = [];

  private isConnecting = false;

  // Callbacks que se llaman cuando el socket se conecta o reconecta
  private connectListeners: Array<() => void> = [];

  // Documentos activos: cuando el socket reconecta, los re-joineamos automáticamente
  private activeDocuments = new Map<string, { documentId: string; workspaceId: string }>();
  private activeBoards = new Set<string>();

  // Rooms persistentes: una ruta puede compartir la suscripción con el layout.
  // Cada consumidor libera su propia referencia para que un cambio de ruta no
  // desconecte a los demás consumidores del mismo recurso.
  private workspaceRoomOwners = new Map<string, Set<string>>();
  private projectRoomOwners = new Map<string, Set<string>>();
  private organizationRoomOwners = new Map<string, Set<string>>();

  // ─── Conexión ─────────────────────────────────────────────────────────────

  /** Suscribirse al evento de conexión/reconexión establecida */
  onConnect(cb: () => void): void {
    this.connectListeners.push(cb);
    if (this.socket?.connected) cb();
  }

  offConnect(cb: () => void): void {
    this.connectListeners = this.connectListeners.filter((l) => l !== cb);
  }

  private notifyConnectListeners(): void {
    this.connectListeners.forEach((cb) => cb());
  }

  connect(token: string): void {
    // Si ya hay socket y está conectado o conectando, no volver a crear
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    // Si hay socket desconectado del mismo token, reconectar directamente
    if (this.socket && !this.socket.connected) {
      this.socket.auth = { token };
      this.socket.connect();
      return;
    }

    this.isConnecting = true;

    // Normalizar URL: polling usa HTTP, no WebSocket puro
    const rawUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';
    const wsUrl = rawUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');

    this.socket = io(wsUrl, {
      auth: { token },
      // polling primero garantiza la conexión inicial en Render/cloud donde el upgrade
      // WebSocket puede fallar en el primer handshake. socket.io-client hará upgrade
      // automático a WebSocket una vez que polling esté establecido.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      // A server or its reverse proxy can briefly lose connectivity. Keep
      // retrying so chat and presence recover without a page reload.
      reconnectionAttempts: Infinity,
      // Tiempo máximo esperando antes de considerar timeout de conexión
      timeout: 20000,
    });

    // Aplicar listeners que se encolaron antes de que el socket existiera
    this.flushPendingListeners();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnecting = false;
      // Primero emitir la cola de eventos generales
      this.flushEventQueue();
      // Socket.IO rooms se pierden al reconectar. Restaurar las suscripciones
      // activas antes de avisar a los componentes que ya pueden sincronizarse.
      this.rejoinScopedRooms();
      // Luego notificar a los suscriptores (incluido el CollaborativeEditor)
      this.notifyConnectListeners();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnecting = false;
      // socket.io reconecta automáticamente excepto cuando el servidor desconectó
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', () => {
      this.isConnecting = false;
    });

    this.socket.on('reconnect', () => {
      this.flushEventQueue();
      this.notifyConnectListeners();
    });
  }

  /**
   * Actualizar el token y reconectar el socket.
   * Se llama automáticamente desde apiService cuando renueva el access token.
   */
  updateToken(newToken: string): void {
    if (!this.socket) return;
    this.socket.auth = { token: newToken };
    if (this.socket.connected) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
    this.eventQueue = [];
    this.pendingListeners = [];
    this.isConnecting = false;
    this.connectListeners = [];
    this.activeDocuments.clear();
    this.activeBoards.clear();
    this.workspaceRoomOwners.clear();
    this.projectRoomOwners.clear();
    this.organizationRoomOwners.clear();
  }

  // ─── Emit / On / Off ──────────────────────────────────────────────────────

  emit(event: string, data: any): void {
    if (!this.isConnected()) {
      this.eventQueue.push({ event, data });
      return;
    }
    this.socket?.emit(event, data);
  }

  /**
   * Registrar listener de evento.
   * Si el socket aún no existe, se encola y se aplica en cuanto se cree.
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.socket) {
      this.pendingListeners.push({ event, callback });
      return;
    }
    this.socket.on(event, callback);
  }

  /**
   * Eliminar listener de evento.
   * También lo saca de la cola pendiente si todavía no se aplicó.
   */
  off(event: string, callback?: (data: any) => void): void {
    if (callback) {
      this.pendingListeners = this.pendingListeners.filter(
        (l) => !(l.event === event && l.callback === callback)
      );
    } else {
      this.pendingListeners = this.pendingListeners.filter((l) => l.event !== event);
    }

    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // ─── Colas internas ───────────────────────────────────────────────────────

  private flushEventQueue(): void {
    while (this.eventQueue.length > 0) {
      const { event, data } = this.eventQueue.shift()!;
      this.socket?.emit(event, data);
    }
  }

  private flushPendingListeners(): void {
    if (!this.socket) return;
    while (this.pendingListeners.length > 0) {
      const { event, callback } = this.pendingListeners.shift()!;
      this.socket.on(event, callback);
    }
  }

  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }

  // ─── Workspaces ───────────────────────────────────────────────────────────

  joinWorkspace(workspaceId: string, owner = 'default'): void {
    this.retainRoom(this.workspaceRoomOwners, workspaceId, owner, 'join:workspace');
  }

  leaveWorkspace(workspaceId: string, owner = 'default'): void {
    this.releaseRoom(this.workspaceRoomOwners, workspaceId, owner, 'leave:workspace');
  }

  joinProject(projectId: string, owner = 'default'): void {
    this.retainRoom(this.projectRoomOwners, projectId, owner, 'join:project', 'projectId');
  }

  leaveProject(projectId: string, owner = 'default'): void {
    this.releaseRoom(this.projectRoomOwners, projectId, owner, 'leave:project', 'projectId');
  }

  joinOrganization(organizationId: string, owner = 'default'): void {
    this.retainRoom(this.organizationRoomOwners, organizationId, owner, 'join:organization', 'organizationId');
  }

  leaveOrganization(organizationId: string, owner = 'default'): void {
    this.releaseRoom(this.organizationRoomOwners, organizationId, owner, 'leave:organization', 'organizationId');
  }

  private retainRoom(
    rooms: Map<string, Set<string>>,
    id: string,
    owner: string,
    event: string,
    idKey = 'workspaceId',
  ): void {
    if (!id) return;
    const owners = rooms.get(id) ?? new Set<string>();
    if (owners.has(owner)) return;
    const wasEmpty = owners.size === 0;
    owners.add(owner);
    rooms.set(id, owners);
    if (wasEmpty && this.isConnected()) this.socket?.emit(event, { [idKey]: id });
  }

  private releaseRoom(
    rooms: Map<string, Set<string>>,
    id: string,
    owner: string,
    event: string,
    idKey = 'workspaceId',
  ): void {
    const owners = rooms.get(id);
    if (!owners?.delete(owner)) return;
    if (owners.size > 0) return;
    rooms.delete(id);
    if (this.isConnected()) this.socket?.emit(event, { [idKey]: id });
  }

  private rejoinScopedRooms(): void {
    if (!this.isConnected()) return;
    this.workspaceRoomOwners.forEach((_owners, workspaceId) => {
      this.socket?.emit('join:workspace', { workspaceId });
    });
    this.projectRoomOwners.forEach((_owners, projectId) => {
      this.socket?.emit('join:project', { projectId });
    });
    this.organizationRoomOwners.forEach((_owners, organizationId) => {
      this.socket?.emit('join:organization', { organizationId });
    });
    this.activeBoards.forEach((boardId) => {
      this.socket?.emit('join:board', { boardId });
    });
  }

  // ─── Boards ───────────────────────────────────────────────────────────────

  joinBoard(boardId: string): void {
    if (!boardId || this.activeBoards.has(boardId)) return;
    this.activeBoards.add(boardId);
    if (this.isConnected()) this.socket?.emit('join:board', { boardId });
  }

  leaveBoard(boardId: string): void {
    if (!this.activeBoards.delete(boardId)) return;
    if (this.isConnected()) this.socket?.emit('leave:board', { boardId });
  }

  onPresenceUsers(callback: (data: { boardId: string; users: any[] }) => void): void {
    this.on('presence:users', callback);
  }

  onJoinedBoard(callback: (data: { boardId: string; users: any[] }) => void): void {
    this.on('joined:board', callback);
  }

  onEvent(callback: (event: Event) => void): void {
    this.on('event', callback);
  }

  onTypingStarted(
    callback: (data: { cardId: string; userId: string; userName: string }) => void
  ): void {
    this.on('typing:started', callback);
  }

  onTypingStopped(callback: (data: { cardId: string; userId: string }) => void): void {
    this.on('typing:stopped', callback);
  }

  // ─── Cursores ─────────────────────────────────────────────────────────────

  emitCursorMove(boardId: string, x: number, y: number): void {
    if (!this.isConnected()) return;
    this.socket?.emit('cursor:move', { boardId, x, y });
  }

  onCursorMoved(callback: (data: { userId: string; name: string; x: number; y: number }) => void): void {
    this.on('cursor:moved', callback);
  }

  offCursorMoved(callback: (data: any) => void): void {
    this.off('cursor:moved', callback);
  }

  startTyping(cardId: string): void {
    if (!this.isConnected()) return;
    this.emit('typing:start', { cardId });
  }

  stopTyping(cardId: string): void {
    if (!this.isConnected()) return;
    this.emit('typing:stop', { cardId });
  }

  ping(): void {
    if (!this.isConnected()) return;
    this.socket?.emit('ping');
  }

  // ─── Documentos ───────────────────────────────────────────────────────────

  /**
   * Unirse a un documento para colaboración en tiempo real.
   *
   * - Si el socket ya está conectado, emite document:join inmediatamente.
   * - Si el socket aún no está conectado, encola el join y se emitirá
   *   en cuanto el socket conecte (flushEventQueue).
   * - Registra el documento como "activo" para rehacer el join automáticamente
   *   en caso de reconexión.
   */
  joinDocument(documentId: string, workspaceId: string): void {
    // Registrar como documento activo para rejoin automático en reconexiones
    this.activeDocuments.set(documentId, { documentId, workspaceId });

    if (!this.isConnected()) {
      this.eventQueue.push({ event: 'document:join', data: { documentId, workspaceId } });
      return;
    }
    this.socket?.emit('document:join', { documentId, workspaceId });
  }

  /**
   * Salir de un documento.
   * Lo elimina de la lista de documentos activos para no reconectarlo.
   */
  leaveDocument(documentId: string): void {
    this.activeDocuments.delete(documentId);
    if (!this.isConnected()) return;
    this.socket?.emit('document:leave', { documentId });
  }

  sendYjsUpdate(documentId: string, update: Uint8Array, restoreGeneration: number): void {
    if (!this.isConnected()) return;
    this.socket?.emit('document:yjs:update', {
      documentId,
      update: Array.from(update),
      restoreGeneration,
    });
  }

  onYjsUpdate(callback: (data: { documentId: string; update: number[] }) => void): void {
    this.on('document:yjs:update', callback);
  }

  onYjsSync(
    callback: (data: { documentId: string; update: number[]; restoreGeneration: number }) => void
  ): void {
    this.on('document:sync', callback);
  }

  onForceReload(callback: (data: { documentId: string; reason: string }) => void): void {
    this.on('document:force-reload', callback);
  }

  onDocumentUserJoined(callback: (data: { documentId: string; user: any }) => void): void {
    this.on('document:user:joined', callback);
  }

  onDocumentUserLeft(callback: (data: { documentId: string; userId: string }) => void): void {
    this.on('document:user:left', callback);
  }

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
