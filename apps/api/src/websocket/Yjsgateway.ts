// apps/api/src/websocket/YjsGateway.ts

import { Server as SocketIOServer, Socket } from 'socket.io';
import * as Y from 'yjs';
import {
  documentService,
  DOCUMENT_TEXT_LIMIT,
  DocumentRestoreConflictError,
} from '../services/DocumentService';
import { OrganizationStorageLimitError } from '../services/OrganizationStorageService';

interface AuthenticatedSocket extends Socket {
  userId: string;
  userName: string;
  userAvatar?: string;
}

const MAX_YJS_UPDATE_BYTES = 1024 * 1024;
const YJS_UPDATE_WINDOW_MS = 60_000;
const MAX_YJS_UPDATES_PER_WINDOW = 300;
const MAX_YJS_UPDATE_BYTES_PER_WINDOW = 5 * 1024 * 1024;

interface YjsUpdateBudget {
  windowStartedAt: number;
  updateCount: number;
  byteCount: number;
}

export class YjsGateway {
  private docs = new Map<string, Y.Doc>();
  private documentLoads = new Map<string, Promise<Y.Doc>>();
  private restoreGenerations = new Map<string, number>();
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
  private documentAccessTimers = new Map<string, Map<string, NodeJS.Timeout | null>>();
  private yjsUpdateBudgets = new Map<string, YjsUpdateBudget>();

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
          await this.scheduleDocumentAccessRevalidation(socket, documentId);

          // Esperar la carga compartida antes de enviar el estado inicial. Si el
          // primer socket aún lee la DB, un segundo join no debe recibir un Y.Doc vacío.
          const doc = await this.getOrLoadDocument(documentId);
          if (!(await documentService.checkDocumentAccess(documentId, authSocket.userId))) {
            await this.revalidateUserDocuments(authSocket.userId);
            return;
          }

          // Enviar estado completo al cliente que se acaba de unir
          const stateVector = Y.encodeStateAsUpdate(doc);
          socket.emit('document:sync', {
            documentId,
            update: Array.from(stateVector),
            restoreGeneration: this.restoreGenerations.get(documentId) ?? 0,
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
          const hasAccess = await documentService.checkDocumentAccess(documentId, authSocket.userId);
          if (!hasAccess) {
            socket.emit('error', { message: 'No access to document' });
            return;
          }
          await this.ensureSocketDocumentMembership(socket, documentId);
          const doc = await this.getOrLoadDocument(documentId);
          if (!(await documentService.checkDocumentAccess(documentId, authSocket.userId))) {
            await this.revalidateUserDocuments(authSocket.userId);
            return;
          }
          const stateVector = Y.encodeStateAsUpdate(doc);
          socket.emit('document:sync', {
            documentId,
            update: Array.from(stateVector),
            restoreGeneration: this.restoreGenerations.get(documentId) ?? 0,
          });
        } catch (error) {
          console.error('[document] request-sync failed', { documentId: data?.documentId, error });
          socket.emit('document:save-error', { documentId: data?.documentId, error: 'No se pudo sincronizar el documento' });
        }
      });

      // ================================================================
      // YJS UPDATE — Recibir cambio del cliente y persistir
      // ================================================================
      socket.on(
        'document:yjs:update',
        async (data: { documentId: string; update: number[]; restoreGeneration: number }) => {
          try {
            if (
              typeof data?.documentId !== 'string' ||
              data.documentId.length === 0 ||
              data.documentId.length > 100 ||
              !Array.isArray(data.update) ||
              data.update.length === 0 ||
              data.update.length > MAX_YJS_UPDATE_BYTES ||
              !data.update.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255) ||
              !Number.isSafeInteger(data.restoreGeneration) ||
              data.restoreGeneration < 0
            ) {
              socket.emit('error', { message: 'Invalid document update' });
              return;
            }

            const retryAfterMs = this.consumeYjsUpdateBudget(socket.id, data.update.length);
            if (retryAfterMs !== null) {
              socket.emit('document:rate-limited', {
                documentId: data.documentId,
                retryAfterMs,
              });
              return;
            }

            const { documentId, update, restoreGeneration } = data;
            const hasAccess = await documentService.checkDocumentAccess(documentId, authSocket.userId);
            if (!hasAccess) {
              socket.emit('error', { message: 'No access to document' });
              return;
            }
            const permission = await documentService.getEffectiveUserPermission(documentId, authSocket.userId);
            if (permission !== 'EDIT') {
              socket.emit('error', { message: 'Edit permission required' });
              return;
            }

            let doc = this.docs.get(documentId);
            if (!doc) {
              // El proceso pudo reiniciarse antes de que llegara un update. Cargar
              // una sola instancia desde DB antes de aplicar el cambio.
              try {
                doc = await this.getOrLoadDocument(documentId);
                if (!this.socketToDocuments.has(socket.id)) {
                  this.socketToDocuments.set(socket.id, new Set());
                }
                this.socketToDocuments.get(socket.id)!.add(documentId);
                await socket.join(`document:${documentId}`);
              } catch {
                socket.emit('document:reload', { documentId });
                return;
              }
            }

            await this.ensureSocketDocumentMembership(socket, documentId);

            const currentAccess = await documentService.checkDocumentAccess(documentId, authSocket.userId);
            if (!currentAccess) {
              await this.revalidateUserDocuments(authSocket.userId);
              return;
            }
            const currentPermission = await documentService.getEffectiveUserPermission(
              documentId,
              authSocket.userId,
            );
            if (currentPermission !== 'EDIT') {
              socket.emit('error', { message: 'Edit permission required' });
              return;
            }

            if (
              !Number.isSafeInteger(restoreGeneration) ||
              restoreGeneration !== this.restoreGenerations.get(documentId)
            ) {
              socket.emit('document:force-reload', {
                documentId,
                reason: 'Document version changed',
              });
              return;
            }

            // Aplicar el update al documento Yjs en memoria
            const currentState = Y.encodeStateAsUpdate(doc);
            const currentLength = documentService.getVisibleTextLength(currentState);
            const candidate = new Y.Doc();
            try {
              Y.applyUpdate(candidate, currentState);
              Y.applyUpdate(candidate, new Uint8Array(update));
              const nextLength = documentService.getVisibleTextLength(Y.encodeStateAsUpdate(candidate));
              if (nextLength > DOCUMENT_TEXT_LIMIT && nextLength > currentLength) {
                socket.emit('document:text-limit', { documentId, limit: DOCUMENT_TEXT_LIMIT });
                return;
              }
            } finally {
              candidate.destroy();
            }
            Y.applyUpdate(doc, new Uint8Array(update));

            // Hacer broadcast a los demás usuarios del mismo documento
            socket.to(`document:${documentId}`).emit('document:yjs:update', {
              documentId,
              update,
            });

            // Programar guardado a DB con debounce
            this.scheduleSave(documentId, doc);
          } catch (error) {
            console.error('[document] update failed', { documentId: data?.documentId, error });
            socket.emit('document:save-error', { documentId: data?.documentId, error: 'No se pudo sincronizar el cambio' });
          }
        }
      );

      // ================================================================
      // AWARENESS UPDATE (cursores y presencia)
      // ================================================================
      socket.on('document:awareness:update', async (data: { documentId: string; update: number[] }) => {
        try {
          if (typeof data?.documentId !== 'string' ||
              !Array.isArray(data.update) || data.update.length > 16_384 ||
              !data.update.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
            socket.emit('error', { message: 'Invalid awareness update' });
            return;
          }
          const hasAccess = await documentService.checkDocumentAccess(data.documentId, authSocket.userId);
          if (!hasAccess || !this.isSocketInDocument(socket, data.documentId)) {
            socket.emit('error', { message: 'No access to document' });
            return;
          }
          socket.to(`document:${data.documentId}`).emit('document:awareness:update', data);
        } catch {
          socket.emit('error', { message: 'Failed to update document presence' });
        }
      });

      // ================================================================
      // LEAVE DOCUMENT (el cliente sale explícitamente)
      // ================================================================
      socket.on('document:leave', async (data: { documentId: string }) => {
        try {
          const { documentId } = data;

          socket.leave(`document:${documentId}`);
          this.clearDocumentAccessTimer(socket.id, documentId);

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
        } catch (error) {
          console.error('[document] leave failed', { documentId: data?.documentId, error });
        }
      });

      // ================================================================
      // DISCONNECT — El socket se cierra (pestaña cerrada, red cortada, etc.)
      // CRÍTICO: socket.rooms está VACÍO aquí, usamos socketToDocuments
      // ================================================================
      socket.on('disconnect', async (reason) => {
        this.yjsUpdateBudgets.delete(socket.id);
        this.clearAllDocumentAccessTimers(socket.id);
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
            try {
              await this.saveAndCleanup(documentId);
            } catch {
              const doc = this.docs.get(documentId);
              if (doc) this.scheduleSave(documentId, doc);
            }
          }
        }
      });
    });
  }

  /** Remove document subscriptions immediately after workspace/project/grant revocation. */
  public async revalidateUserDocuments(userId: string): Promise<void> {
    const sockets = Array.from(this.io.sockets.sockets.values()).filter(
      (socket) => (socket as AuthenticatedSocket).userId === userId,
    );

    for (const socket of sockets) {
      const documents = this.socketToDocuments.get(socket.id);
      if (!documents) continue;

      for (const documentId of Array.from(documents)) {
        let hasAccess = false;
        try {
          // Fail closed if the access decision cannot be refreshed.
          hasAccess = await documentService.checkDocumentAccess(documentId, userId);
        } catch {
          hasAccess = false;
        }
        if (hasAccess) {
          this.clearDocumentAccessTimer(socket.id, documentId);
          await this.scheduleDocumentAccessRevalidation(socket, documentId);
          continue;
        }

        const room = `document:${documentId}`;
        socket.emit('document:access:revoked', { documentId });
        await socket.leave(room);
        documents.delete(documentId);
        this.clearDocumentAccessTimer(socket.id, documentId);
        socket.to(room).emit('document:user:left', { documentId, userId });

        const roomSockets = this.io.sockets.adapter.rooms.get(room);
        if (!roomSockets || roomSockets.size === 0) {
          try {
            await this.saveAndCleanup(documentId);
          } catch {
            const doc = this.docs.get(documentId);
            if (doc) this.scheduleSave(documentId, doc);
          }
        }
      }

      if (documents.size === 0) this.socketToDocuments.delete(socket.id);
    }
  }

  private consumeYjsUpdateBudget(socketId: string, updateBytes: number): number | null {
    const now = Date.now();
    let budget = this.yjsUpdateBudgets.get(socketId);
    if (!budget || now - budget.windowStartedAt >= YJS_UPDATE_WINDOW_MS) {
      budget = { windowStartedAt: now, updateCount: 0, byteCount: 0 };
      this.yjsUpdateBudgets.set(socketId, budget);
    }

    if (
      budget.updateCount >= MAX_YJS_UPDATES_PER_WINDOW ||
      budget.byteCount + updateBytes > MAX_YJS_UPDATE_BYTES_PER_WINDOW
    ) {
      return Math.max(1, YJS_UPDATE_WINDOW_MS - (now - budget.windowStartedAt));
    }

    budget.updateCount += 1;
    budget.byteCount += updateBytes;
    return null;
  }

  /**
   * Programar guardado con debounce.
   * Cada cambio reinicia el timer. El guardado ocurre 2s después del último cambio.
   */
  private scheduleSave(documentId: string, doc: Y.Doc) {
    const restoreGeneration = this.restoreGenerations.get(documentId);
    if (restoreGeneration === undefined) return;

    const existing = this.saveTimers.get(documentId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.saveTimers.delete(documentId);
      await this.persistDocument(documentId, doc, restoreGeneration);
    }, this.SAVE_DEBOUNCE);

    this.saveTimers.set(documentId, timer);
  }

  /**
   * Guardar el documento a la base de datos con reintentos automáticos.
   */
  private async persistDocument(
    documentId: string,
    doc: Y.Doc,
    expectedRestoreGeneration: number,
    attempt = 1
  ): Promise<void> {
    try {
      const state = Y.encodeStateAsUpdate(doc);
      if (!Number.isSafeInteger(expectedRestoreGeneration) || expectedRestoreGeneration < 0) {
        throw new DocumentRestoreConflictError();
      }

      // PROTECCIÓN: nunca guardar un estado vacío (2 bytes = Y.Doc vacío)
      if (state.length <= 2) {
        return;
      }

      await documentService.updateYjsState(documentId, state, expectedRestoreGeneration);

      // Notificar a los clientes que el guardado fue exitoso
      this.io.to(`document:${documentId}`).emit('document:saved', {
        documentId,
        timestamp: Date.now(),
        size: state.length,
      });
    } catch (error) {
      if (error instanceof DocumentRestoreConflictError) {
        await this.reloadDocumentFromDatabase(documentId);
        return;
      }
      if (error instanceof OrganizationStorageLimitError) {
        this.io.to(`document:${documentId}`).emit('document:save-error', {
          documentId,
          code: error.code,
          error: error.message,
          details: { usedBytes: error.usedBytes.toString(), limitBytes: error.limitBytes.toString() },
        });
        return;
      }
      if (attempt < this.MAX_SAVE_RETRIES) {
        const delay = this.RETRY_DELAY_MS * attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.persistDocument(documentId, doc, expectedRestoreGeneration, attempt + 1);
      } else {
        this.io.to(`document:${documentId}`).emit('document:save-error', {
          documentId,
          error: 'No se pudo guardar el documento después de varios intentos.',
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
    const restoreGeneration = this.restoreGenerations.get(documentId);

    if (state.length <= 2) {
      // Nothing to save — clean up memory
      doc.destroy();
      if (this.docs.get(documentId) === doc) {
        this.docs.delete(documentId);
        this.restoreGenerations.delete(documentId);
      }
      return;
    }

    let saved = false;

    for (let attempt = 1; attempt <= this.MAX_SAVE_RETRIES; attempt++) {
      try {
        if (restoreGeneration === undefined) throw new DocumentRestoreConflictError();
        await documentService.updateYjsState(documentId, state, restoreGeneration);
        saved = true;
        break;
      } catch (error) {
        if (error instanceof DocumentRestoreConflictError) {
          await this.reloadDocumentFromDatabase(documentId);
          return;
        }
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
          const currentGeneration = this.restoreGenerations.get(documentId);
          if (currentGeneration === undefined) {
            await this.reloadDocumentFromDatabase(documentId);
            return;
          }
          await this.persistDocument(documentId, currentDoc, currentGeneration);
          const room = this.io.sockets.adapter.rooms.get(`document:${documentId}`);
          if (!room || room.size === 0) {
            if (this.docs.get(documentId) === currentDoc) {
              currentDoc.destroy();
              this.docs.delete(documentId);
              this.restoreGenerations.delete(documentId);
            }
          }
        }
      }, 30_000);
      this.saveTimers.set(documentId, retryTimer);
      return;
    }

    // Guardado exitoso — ahora sí liberar de memoria
    if (this.docs.get(documentId) === doc) {
      doc.destroy();
      this.docs.delete(documentId);
      this.restoreGenerations.delete(documentId);
    }
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

  public replaceDocument(documentId: string, state: Uint8Array, restoreGeneration: number): void {
    if (!Number.isSafeInteger(restoreGeneration) || restoreGeneration < 0) return;
    const currentGeneration = this.restoreGenerations.get(documentId);
    if (currentGeneration !== undefined && restoreGeneration < currentGeneration) return;

    const pendingSave = this.saveTimers.get(documentId);
    if (pendingSave) clearTimeout(pendingSave);
    this.saveTimers.delete(documentId);
    const existing = this.docs.get(documentId);
    existing?.destroy();
    this.restoreGenerations.set(documentId, restoreGeneration);
    if (existing) {
      const restored = new Y.Doc();
      Y.applyUpdate(restored, state);
      this.docs.set(documentId, restored);
    } else {
      this.docs.delete(documentId);
    }
    this.broadcastToDocument(documentId, 'document:force-reload', {
      documentId,
      reason: 'Version restored',
    });
  }

  public broadcastToDocument(documentId: string, event: string, data: any) {
    this.io.to(`document:${documentId}`).emit(event, data);
  }

  private async reloadDocumentFromDatabase(documentId: string): Promise<void> {
    try {
      const snapshot = await documentService.getYjsSnapshot(documentId);
      let state = snapshot.state;
      if (!state) {
        const empty = new Y.Doc();
        state = Y.encodeStateAsUpdate(empty);
        empty.destroy();
      }
      this.replaceDocument(documentId, state, snapshot.restoreGeneration);
    } catch (error) {
      console.error('[document] failed to reload after version conflict', { documentId, error });
      this.broadcastToDocument(documentId, 'document:force-reload', {
        documentId,
        reason: 'Document version changed',
      });
    }
  }

  public broadcastToUserInDocument(userId: string, event: string, data: any) {
    const sockets = Array.from(this.io.sockets.sockets.values());
    const userSocket = sockets.find((s: any) => s.userId === userId);
    if (userSocket) userSocket.emit(event, data);
  }

  private isSocketInDocument(socket: Socket, documentId: string): boolean {
    return socket.rooms.has(`document:${documentId}`);
  }

  private async getOrLoadDocument(documentId: string): Promise<Y.Doc> {
    const existing = this.docs.get(documentId);
    if (existing) return existing;

    const pending = this.documentLoads.get(documentId);
    if (pending) return pending;

    const load = (async () => {
      const doc = new Y.Doc();
      try {
        let snapshot = await documentService.getYjsSnapshot(documentId);
        const minimumGeneration = this.restoreGenerations.get(documentId);
        if (minimumGeneration !== undefined && snapshot.restoreGeneration < minimumGeneration) {
          const replaced = this.docs.get(documentId);
          if (replaced) {
            doc.destroy();
            return replaced;
          }
          snapshot = await documentService.getYjsSnapshot(documentId);
          if (snapshot.restoreGeneration < minimumGeneration) {
            throw new DocumentRestoreConflictError();
          }
        }
        if (snapshot.state && snapshot.state.length > 0) Y.applyUpdate(doc, snapshot.state, 'load');
        this.restoreGenerations.set(documentId, snapshot.restoreGeneration);
        this.docs.set(documentId, doc);
        return doc;
      } catch (error) {
        doc.destroy();
        throw error;
      }
    })();
    this.documentLoads.set(documentId, load);

    try {
      return await load;
    } finally {
      if (this.documentLoads.get(documentId) === load) this.documentLoads.delete(documentId);
    }
  }

  private async ensureSocketDocumentMembership(socket: Socket, documentId: string): Promise<void> {
    if (!this.socketToDocuments.has(socket.id)) {
      this.socketToDocuments.set(socket.id, new Set());
    }
    this.socketToDocuments.get(socket.id)!.add(documentId);

    if (!this.isSocketInDocument(socket, documentId)) {
      await socket.join(`document:${documentId}`);
    }
    await this.scheduleDocumentAccessRevalidation(socket, documentId);
  }

  private async scheduleDocumentAccessRevalidation(socket: Socket, documentId: string): Promise<void> {
    let socketTimers = this.documentAccessTimers.get(socket.id);
    if (!socketTimers) {
      socketTimers = new Map();
      this.documentAccessTimers.set(socket.id, socketTimers);
    }
    if (socketTimers.has(documentId)) return;
    // Mark the check as pending to prevent duplicate DB reads from concurrent updates.
    socketTimers.set(documentId, null);

    const userId = (socket as AuthenticatedSocket).userId;
    let expiresAt: number | null;
    try {
      expiresAt = await documentService.getDocumentAccessExpiresAt(documentId, userId);
    } catch {
      // If expiry cannot be established, re-check immediately and fail closed.
      expiresAt = Date.now();
    }

    if (!this.socketToDocuments.get(socket.id)?.has(documentId) || !socket.connected) {
      this.clearDocumentAccessTimer(socket.id, documentId);
      return;
    }
    if (expiresAt === null) return;

    const delay = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(async () => {
      socketTimers?.delete(documentId);
      if (socketTimers?.size === 0) this.documentAccessTimers.delete(socket.id);

      let hasAccess = false;
      try {
        hasAccess = await documentService.checkDocumentAccess(documentId, userId);
      } catch {
        hasAccess = false;
      }

      if (!hasAccess) {
        await this.revalidateUserDocuments(userId);
        return;
      }

      // Another active grant or baseline membership still authorizes access.
      await this.scheduleDocumentAccessRevalidation(socket, documentId);
    }, Math.min(delay, 2_147_483_647));
    timer.unref?.();
    socketTimers.set(documentId, timer);
  }

  private clearDocumentAccessTimer(socketId: string, documentId: string): void {
    const timers = this.documentAccessTimers.get(socketId);
    const timer = timers?.get(documentId);
    if (timer) clearTimeout(timer);
    timers?.delete(documentId);
    if (timers?.size === 0) this.documentAccessTimers.delete(socketId);
  }

  private clearAllDocumentAccessTimers(socketId: string): void {
    const timers = this.documentAccessTimers.get(socketId);
    if (!timers) return;
    for (const timer of timers.values()) {
      if (timer) clearTimeout(timer);
    }
    this.documentAccessTimers.delete(socketId);
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

export async function revalidateYjsUserDocuments(userId: string): Promise<void> {
  if (yjsGatewayInstance) await yjsGatewayInstance.revalidateUserDocuments(userId);
}
