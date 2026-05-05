// apps/api/src/websocket/YjsGateway.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import * as Y from 'yjs';
import { documentService } from '../services/DocumentService';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
  userAvatar?: string;
}

export class YjsGateway {
  private docs = new Map<string, Y.Doc>();
  private io: SocketIOServer;

  // Guardado con debounce después de cada cambio
  private saveTimers = new Map<string, NodeJS.Timeout>();
  private readonly SAVE_DEBOUNCE = 2000; // 2 segundos tras el último cambio

  // Máximo de reintentos de guardado antes de rendirse
  private readonly MAX_SAVE_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  // Rastreo de qué sockets están en qué documentos
  // CRÍTICO: socket.rooms está vacío en el evento 'disconnect',
  // por eso rastreamos esto manualmente antes de que ocurra
  private socketToDocuments = new Map<string, Set<string>>(); // socketId → Set<documentId>

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
          const { documentId } = data;

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

          // CRÍTICO: Registrar manualmente qué documentos tiene este socket
          if (!this.socketToDocuments.has(socket.id)) {
            this.socketToDocuments.set(socket.id, new Set());
          }
          this.socketToDocuments.get(socket.id)!.add(documentId);

          // Obtener o crear documento Yjs en memoria
          let doc = this.docs.get(documentId);

          if (!doc) {
            doc = new Y.Doc();
            this.docs.set(documentId, doc);

            // Cargar estado desde DB
            const yjsState = await documentService.getYjsState(documentId);

            if (yjsState && yjsState.length > 0) {
              // Marcar como 'load' para que el auto-save del cliente no reaccione
              // a esta carga inicial y genere un guardado redundante
              Y.applyUpdate(doc, yjsState, 'load');
            }
          }

          // Enviar estado completo al cliente que se acaba de unir
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
      // REQUEST SYNC — El cliente pide el estado completo sin re-join
      // Útil cuando el cliente pierde el document:sync inicial por una
      // reconexión o cambio de transporte (polling → websocket)
      // ================================================================
      socket.on('document:request-sync', async (data: { documentId: string }) => {
        try {
          const { documentId } = data;

          const doc = this.docs.get(documentId);
          if (doc) {
            const stateVector = Y.encodeStateAsUpdate(doc);
            socket.emit('document:sync', { documentId, update: Array.from(stateVector) });
          } else {
            // El doc no está en memoria (servidor reiniciado) — pedir al cliente que haga join
            socket.emit('document:reload', { documentId });
          }
        } catch (error) {}
      });

      // ================================================================
      // YJS UPDATE — Recibir cambio del cliente y persistir
      // ================================================================
      socket.on('document:yjs:update', async (data: { documentId: string; update: number[] }) => {
        try {
          const { documentId, update } = data;

          let doc = this.docs.get(documentId);
          if (!doc) {
            // El documento no está en memoria — puede pasar si el servidor se reinició
            // sin que el cliente lo supiera. Intentar recargar desde DB antes de pedir
            // al cliente que vuelva a hacer join, para no perder el update recibido.
            try {
              const yjsState = await documentService.getYjsState(documentId);
              doc = new Y.Doc();
              if (yjsState && yjsState.length > 0) {
                Y.applyUpdate(doc, yjsState, 'load');
              }
              this.docs.set(documentId, doc);

              // Registrar el socket en este documento si no lo estaba
              if (!this.socketToDocuments.has(socket.id)) {
                this.socketToDocuments.set(socket.id, new Set());
              }
              this.socketToDocuments.get(socket.id)!.add(documentId);
              socket.join(`document:${documentId}`);
            } catch (reloadError) {
              socket.emit('document:reload', { documentId });
              return;
            }
          }

          // Aplicar el update al documento Yjs en memoria
          Y.applyUpdate(doc, new Uint8Array(update));

          // Hacer broadcast a los demás usuarios del mismo documento
          socket.to(`document:${documentId}`).emit('document:yjs:update', {
            documentId,
            update,
          });

          // Programar guardado a DB con debounce
          this.scheduleSave(documentId, doc);
        } catch (error) {}
      });

      // ================================================================
      // AWARENESS UPDATE (cursores y presencia)
      // ================================================================
      socket.on('document:awareness:update', (data: { documentId: string; update: number[] }) => {
        socket.to(`document:${data.documentId}`).emit('document:awareness:update', data);
      });

      // ================================================================
      // LEAVE DOCUMENT (el cliente sale explícitamente)
      // ================================================================
      socket.on('document:leave', async (data: { documentId: string }) => {
        try {
          const { documentId } = data;

          socket.leave(`document:${documentId}`);

          // Actualizar rastreo manual
          this.socketToDocuments.get(socket.id)?.delete(documentId);

          socket.to(`document:${documentId}`).emit('document:user:left', {
            documentId,
            userId: authSocket.userId,
          });

          // Si no quedan usuarios, guardar y limpiar
          const room = this.io.sockets.adapter.rooms.get(`document:${documentId}`);
          if (!room || room.size === 0) {
            await this.saveAndCleanup(documentId);
          }
        } catch (error) {}
      });

      // ================================================================
      // DISCONNECT — El socket se cierra (pestaña cerrada, red cortada, etc.)
      // CRÍTICO: socket.rooms está VACÍO aquí, usamos socketToDocuments
      // ================================================================
      socket.on('disconnect', async (reason) => {
        // Obtener los documentos de este socket desde nuestro rastreo manual
        const documents = this.socketToDocuments.get(socket.id);
        this.socketToDocuments.delete(socket.id);

        if (!documents || documents.size === 0) {
          return;
        }

        for (const documentId of documents) {
          socket.to(`document:${documentId}`).emit('document:user:left', {
            documentId,
            userId: authSocket.userId,
          });

          // Comprobar si quedan otros sockets en este documento
          const room = this.io.sockets.adapter.rooms.get(`document:${documentId}`);
          if (!room || room.size === 0) {
            await this.saveAndCleanup(documentId);
          }
        }
      });
    });
  }

  /**
   * Programar guardado con debounce.
   * Cada cambio reinicia el timer. El guardado ocurre 2s después del último cambio.
   */
  private scheduleSave(documentId: string, doc: Y.Doc) {
    const existing = this.saveTimers.get(documentId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.saveTimers.delete(documentId);
      await this.persistDocument(documentId, doc);
    }, this.SAVE_DEBOUNCE);

    this.saveTimers.set(documentId, timer);
  }

  /**
   * Guardar el documento a la base de datos con reintentos automáticos.
   */
  private async persistDocument(documentId: string, doc: Y.Doc, attempt = 1): Promise<void> {
    try {
      const state = Y.encodeStateAsUpdate(doc);

      // PROTECCIÓN: nunca guardar un estado vacío (2 bytes = Y.Doc vacío)
      if (state.length <= 2) {
        return;
      }

      await documentService.updateYjsState(documentId, state);

      // Notificar a los clientes que el guardado fue exitoso
      this.io.to(`document:${documentId}`).emit('document:saved', {
        documentId,
        timestamp: Date.now(),
        size: state.length,
      });
    } catch (error) {
      if (attempt < this.MAX_SAVE_RETRIES) {
        const delay = this.RETRY_DELAY_MS * attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.persistDocument(documentId, doc, attempt + 1);
      } else {
        this.io.to(`document:${documentId}`).emit('document:save-error', {
          documentId,
          error: 'Failed to save after multiple retries',
        });
      }
    }
  }

  /**
   * Guardar inmediatamente y liberar el documento de memoria.
   * Se llama cuando no quedan usuarios en el documento.
   *
   * IMPORTANTE: el doc solo se destruye si el guardado fue exitoso
   * (o después de agotar reintentos). Nunca se destruye en el `finally`
   * porque eso perdería datos si el save falló.
   */
  private async saveAndCleanup(documentId: string): Promise<void> {
    const doc = this.docs.get(documentId);
    if (!doc) return;

    // Cancelar cualquier guardado pendiente — haremos uno inmediato aquí
    const timer = this.saveTimers.get(documentId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(documentId);
    }

    const state = Y.encodeStateAsUpdate(doc);

    if (state.length <= 2) {
      // Nothing to save — clean up memory
      doc.destroy();
      this.docs.delete(documentId);
      return;
    }

    let saved = false;

    for (let attempt = 1; attempt <= this.MAX_SAVE_RETRIES; attempt++) {
      try {
        await documentService.updateYjsState(documentId, state);
        saved = true;
        break;
      } catch (error) {
        if (attempt < this.MAX_SAVE_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY_MS * attempt));
        }
      }
    }

    if (!saved) {
      // No pudimos guardar — mantener el doc en memoria como último recurso
      // y reprogramar un intento tardío en 30 segundos
      const retryTimer = setTimeout(async () => {
        this.saveTimers.delete(documentId);
        const currentDoc = this.docs.get(documentId);
        if (currentDoc) {
          await this.persistDocument(documentId, currentDoc);
          const room = this.io.sockets.adapter.rooms.get(`document:${documentId}`);
          if (!room || room.size === 0) {
            currentDoc.destroy();
            this.docs.delete(documentId);
          }
        }
      }, 30_000);
      this.saveTimers.set(documentId, retryTimer);
      return;
    }

    // Guardado exitoso — ahora sí liberar de memoria
    doc.destroy();
    this.docs.delete(documentId);
  }

  private getRandomColor(): string {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FFEAA7',
      '#74B9FF',
      '#A29BFE',
      '#FD79A8',
      '#FDCB6E',
      '#55EFC4',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public getDocument(documentId: string): Y.Doc | undefined {
    return this.docs.get(documentId);
  }

  public broadcastToDocument(documentId: string, event: string, data: any) {
    this.io.to(`document:${documentId}`).emit(event, data);
  }

  public broadcastToUserInDocument(userId: string, event: string, data: any) {
    const sockets = Array.from(this.io.sockets.sockets.values());
    const userSocket = sockets.find((s: any) => s.userId === userId);
    if (userSocket) userSocket.emit(event, data);
  }
}

// Singleton
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
