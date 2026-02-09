// apps/api/src/websocket/YjsGateway.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import * as Y from 'yjs';
import { documentService } from '../services/DocumentService';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
  userAvatar?: string;
}

/**
 * YjsGateway
 * Maneja sincronización de documentos Yjs en tiempo real
 *
 * SISTEMA DE GUARDADO:
 * - Cada 50 operaciones (SNAPSHOT_INTERVAL)
 * - Cada 5 minutos (SNAPSHOT_TIME)
 * - Al salir el último usuario (cleanupDocument)
 */
export class YjsGateway {
  private docs = new Map<string, Y.Doc>();
  private io: SocketIOServer;

  // Snapshots automáticos cada 50 operaciones o 5 minutos
  private snapshotCounters = new Map<string, number>();
  private snapshotTimers = new Map<string, NodeJS.Timeout>();
  private readonly SNAPSHOT_INTERVAL = 50; // Guardar cada 50 cambios
  private readonly SNAPSHOT_TIME = 5 * 60 * 1000; // Guardar cada 5 minutos

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;

      // ================================================================
      // JOIN DOCUMENT
      // ================================================================
      socket.on('document:join', async (data: { documentId: string; workspaceId: string }) => {
        try {
          const { documentId, workspaceId } = data;

          // Verificar acceso
          const hasAccess = await documentService.checkDocumentAccess(
            documentId,
            authSocket.userId
          );
          if (!hasAccess) {
            socket.emit('error', { message: 'No access to document' });
            return;
          }

          // Unirse al room del documento
          socket.join(`document:${documentId}`);

          // Obtener o crear documento Yjs
          let doc = this.docs.get(documentId);
          if (!doc) {
            doc = new Y.Doc();
            this.docs.set(documentId, doc);

            // Cargar estado desde DB
            const yjsState = await documentService.getYjsState(documentId);
            if (yjsState) {
              Y.applyUpdate(doc, yjsState);
            }

            // Setup listeners
            this.setupDocumentListeners(documentId, doc);
          }

          // Enviar estado actual al cliente
          const stateVector = Y.encodeStateAsUpdate(doc);
          socket.emit('document:sync', {
            documentId,
            update: Array.from(stateVector),
          });

          // Notificar a otros usuarios
          socket.to(`document:${documentId}`).emit('document:user:joined', {
            documentId,
            user: {
              id: authSocket.userId,
              name: authSocket.userName,
              avatar: authSocket.userAvatar,
              color: this.getRandomColor(),
            },
          });

        } catch (error) {
          socket.emit('error', { message: 'Failed to join document' });
        }
      });

      // ================================================================
      // YJS UPDATE
      // ================================================================
      socket.on('document:yjs:update', async (data: { documentId: string; update: number[] }) => {
        try {
          const { documentId, update } = data;

          const doc = this.docs.get(documentId);
          if (!doc) {
            socket.emit('error', { message: 'Document not loaded' });
            return;
          }

          // Aplicar update al documento Yjs
          const updateArray = new Uint8Array(update);
          Y.applyUpdate(doc, updateArray);

          // Broadcast a otros usuarios (excepto el emisor)
          socket.to(`document:${documentId}`).emit('document:yjs:update', {
            documentId,
            update,
          });

          // Incrementar contador de snapshots
          const count = (this.snapshotCounters.get(documentId) || 0) + 1;
          this.snapshotCounters.set(documentId, count);

          // Crear snapshot si se alcanzó el límite de operaciones
          if (count >= this.SNAPSHOT_INTERVAL) {
            await this.createSnapshot(documentId, doc);
            this.snapshotCounters.set(documentId, 0);

            // Reiniciar timer después de snapshot por operaciones
            this.resetSnapshotTimer(documentId, doc);
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to apply update' });
        }
      });

      // ================================================================
      // AWARENESS (cursor y selección)
      // ================================================================
      socket.on(
        'document:awareness',
        (data: {
          documentId: string;
          cursor?: number;
          selection?: { from: number; to: number };
        }) => {
          const { documentId, cursor, selection } = data;

          socket.to(`document:${documentId}`).emit('document:awareness', {
            documentId,
            user: {
              id: authSocket.userId,
              name: authSocket.userName,
              color: this.getRandomColor(),
            },
            cursor,
            selection,
          });
        }
      );

      // ================================================================
      // LEAVE DOCUMENT
      // ================================================================
      socket.on('document:leave', async (data: { documentId: string }) => {
        try {
          const { documentId } = data;

          socket.leave(`document:${documentId}`);

          // Notificar a otros usuarios
          socket.to(`document:${documentId}`).emit('document:user:left', {
            documentId,
            userId: authSocket.userId,
          });

          // Limpiar documento si no hay usuarios
          const room = this.io.sockets.adapter.rooms.get(`document:${documentId}`);
          if (!room || room.size === 0) {
            await this.cleanupDocument(documentId);
          }

        } catch (error) {
        }
      });

      // ================================================================
      // DISCONNECT
      // ================================================================
      socket.on('disconnect', async () => {
        // Limpiar documentos donde el usuario estaba activo
        const rooms = Array.from(socket.rooms);
        for (const room of rooms) {
          if (room.startsWith('document:')) {
            const documentId = room.replace('document:', '');

            socket.to(room).emit('document:user:left', {
              documentId,
              userId: authSocket.userId,
            });

            // Limpiar si no hay usuarios
            const activeRoom = this.io.sockets.adapter.rooms.get(room);
            if (!activeRoom || activeRoom.size === 0) {
              await this.cleanupDocument(documentId);
            }
          }
        }
      });
    });
  }

  /**
   * Setup listeners para el documento Yjs
   */
  private setupDocumentListeners(documentId: string, doc: Y.Doc) {
    this.resetSnapshotTimer(documentId, doc);
  }

  /**
   * Reiniciar timer de snapshot periódico
   */
  private resetSnapshotTimer(documentId: string, doc: Y.Doc) {
    // Limpiar timer anterior si existe
    const existingTimer = this.snapshotTimers.get(documentId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Crear nuevo timer para snapshot automático por tiempo
    const timer = setTimeout(async () => {
      await this.createSnapshot(documentId, doc);
      this.snapshotCounters.set(documentId, 0);

      // Reiniciar timer recursivamente
      this.resetSnapshotTimer(documentId, doc);
    }, this.SNAPSHOT_TIME);

    this.snapshotTimers.set(documentId, timer);
  }

  /**
   * Crear snapshot del documento
   */
  private async createSnapshot(documentId: string, doc: Y.Doc) {
    try {
      const stateVector = Y.encodeStateAsUpdate(doc);
      await documentService.updateYjsState(documentId, stateVector);
    } catch (error) {
    }
  }

  /**
   * Limpiar documento de memoria
   */
  private async cleanupDocument(documentId: string) {
    try {
      const doc = this.docs.get(documentId);
      if (!doc) return;


      // Guardar estado final
      const stateVector = Y.encodeStateAsUpdate(doc);
      await documentService.updateYjsState(documentId, stateVector);

      // Limpiar timers
      const timer = this.snapshotTimers.get(documentId);
      if (timer) {
        clearTimeout(timer);
        this.snapshotTimers.delete(documentId);
      }

      // Limpiar contadores
      this.snapshotCounters.delete(documentId);

      // Destruir documento
      doc.destroy();
      this.docs.delete(documentId);

    } catch (error) {
    }
  }

  /**
   * Obtener color aleatorio para cursores
   */
  private getRandomColor(): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#DFE6E9',
      '#74B9FF',
      '#A29BFE',
      '#FD79A8',
      '#FDCB6E',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Obtener documento activo
   */
  public getDocument(documentId: string): Y.Doc | undefined {
    return this.docs.get(documentId);
  }

  /**
   * Broadcast evento a documento
   */
  public broadcastToDocument(documentId: string, event: string, data: any) {
    this.io.to(`document:${documentId}`).emit(event, data);
  }

  /**
   * Broadcast evento a usuario específico en un documento
   */
  public broadcastToUserInDocument(userId: string, event: string, data: any) {
    // Buscar el socket del usuario y enviarle el evento
    const sockets = Array.from(this.io.sockets.sockets.values());
    const userSocket = sockets.find((socket: any) => socket.userId === userId);

    if (userSocket) {
      userSocket.emit(event, data);
    }
  }
}

// Export singleton
let yjsGatewayInstance: YjsGateway | null = null;

export function initializeYjsGateway(io: SocketIOServer): YjsGateway {
  if (!yjsGatewayInstance) {
    yjsGatewayInstance = new YjsGateway(io);
  }
  return yjsGatewayInstance;
}

export function getYjsGateway(): YjsGateway {
  if (!yjsGatewayInstance) {
    throw new Error('Yjs Gateway not initialized');
  }
  return yjsGatewayInstance;
}
