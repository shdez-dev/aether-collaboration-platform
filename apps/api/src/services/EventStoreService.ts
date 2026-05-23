// apps/api/src/services/EventStoreService.ts

import { pool } from '../lib/db';
import { redisPubClient } from '../lib/redis';
import type {
  AetherEvent,
  AetherActor,
  AetherSubject,
  AetherContext,
  AetherDelta,
  EventType,
  EventId,
} from '@aether/types';
import { isEphemeralEvent } from '@aether/types';
import { v7 as uuidv7 } from 'uuid';
import { userActivityService } from './UserActivityService';

interface EmitParams<T extends EventType = EventType> {
  type:           T;
  actor:          AetherActor;
  subject:        AetherSubject;
  context:        AetherContext;
  delta?:         AetherDelta;
  payload?:       Record<string, unknown>;
  socketId?:      string;
  targetUserId?:  string;
  correlationId?: string;
}

/**
 * Event Store Service
 *
 * Persiste eventos en PostgreSQL, los publica a Redis pub/sub
 * y hace broadcast vía WebSocket.
 *
 * Schema v2: actor / subject / context / delta son campos top-level,
 * no van mezclados en payload.
 */
export class EventStoreService {
  /**
   * Vector clock en memoria: { [userId]: lastCounter }
   * Persiste mientras el proceso esté vivo.
   * En una arquitectura multi-instancia se reemplaza por Redis INCR.
   */
  private vectorClocks = new Map<string, number>();

  private nextClock(userId: string): number {
    const current = this.vectorClocks.get(userId) ?? 0;
    const next = current + 1;
    this.vectorClocks.set(userId, next);
    return next;
  }

  /**
   * Emite un evento al sistema.
   */
  async emit<T extends EventType>(params: EmitParams<T>): Promise<AetherEvent<T>> {
    const {
      type,
      actor,
      subject,
      context,
      delta,
      payload = {},
      socketId,
      targetUserId,
      correlationId,
    } = params;

    const eventId   = uuidv7() as EventId;
    const timestamp = Date.now();
    const vectorClock = { [actor.id]: this.nextClock(actor.id) };

    const event: AetherEvent<T> = {
      eventId,
      type,
      timestamp,
      version: 1,
      actor,
      subject,
      context,
      ...(delta && { delta }),
      payload,
      vectorClock,
      ...(correlationId && { correlationId }),
      ...(socketId && { socketId }),
    };

    const ephemeral = isEphemeralEvent(type);

    if (!ephemeral) {
      await pool.query(
        `INSERT INTO events (
          id, type, timestamp, version,
          actor_id, actor_name,
          subject_type, subject_id, subject_name,
          workspace_id, board_id, list_id, card_id, document_id,
          delta, payload,
          vector_clock, correlation_id,
          created_at
        ) VALUES (
          $1,  $2,  $3,  $4,
          $5,  $6,
          $7,  $8,  $9,
          $10, $11, $12, $13, $14,
          $15, $16,
          $17, $18,
          NOW()
        )`,
        [
          eventId, type, timestamp, 1,
          actor.id, actor.name,
          subject.type, subject.id, subject.name,
          context.workspaceId ?? null,
          context.boardId     ?? null,
          context.listId      ?? null,
          context.cardId      ?? null,
          context.documentId  ?? null,
          delta ? JSON.stringify(delta) : null,
          JSON.stringify(payload),
          JSON.stringify(vectorClock),
          correlationId ?? null,
        ]
      );

      try {
        // Enrich payload with context and subject so processEvent has access
        // to workspaceId, boardId, and entity names even when the original
        // payload is empty (e.g. workspace.created emitted without payload).
        const enrichedPayload = {
          ...payload,
          workspaceId: context.workspaceId ?? (payload as any).workspaceId,
          boardId:     context.boardId     ?? (payload as any).boardId,
          listId:      context.listId      ?? (payload as any).listId,
          cardId:      context.cardId      ?? (payload as any).cardId,
          documentId:  context.documentId  ?? (payload as any).documentId,
          subjectName: subject.name,
          subjectId:   subject.id,
          subjectType: subject.type,
        };
        await userActivityService.processEvent(type, enrichedPayload, actor.id as any);
      } catch {
        // no fallar el evento principal si falla el log de actividad
      }
    }

    try {
      await redisPubClient.publish('aether:events', JSON.stringify(event));
    } catch {
      // no fallar si Redis no está disponible
    }

    try {
      const { getRealtimeGateway } = await import('../websocket/RealtimeGateway');
      const gateway = getRealtimeGateway();

      if (targetUserId) {
        gateway.sendToUser(targetUserId, event);
      }

      if (context.boardId) {
        if (socketId) {
          gateway.broadcastToBoardExcept(context.boardId, event, socketId);
        } else {
          gateway.broadcastToBoard(context.boardId, event);
        }
      }

      if (context.workspaceId && !context.boardId) {
        gateway.broadcastToWorkspace(context.workspaceId, event);
      }
    } catch {
      // no fallar si WebSocket no está disponible
    }

    return event;
  }

  // ============================================================================
  // READ METHODS
  // ============================================================================

  private mapRow(row: Record<string, any>): AetherEvent {
    return {
      eventId:   row.id,
      type:      row.type,
      timestamp: parseInt(row.timestamp),
      version:   1,
      actor:     { id: row.actor_id, name: row.actor_name },
      subject:   { type: row.subject_type, id: row.subject_id, name: row.subject_name },
      context: {
        workspaceId: row.workspace_id,
        boardId:     row.board_id    ?? undefined,
        listId:      row.list_id     ?? undefined,
        cardId:      row.card_id     ?? undefined,
        documentId:  row.document_id ?? undefined,
      },
      delta:   row.delta   ?? undefined,
      payload: row.payload ?? {},
      vectorClock:    row.vector_clock,
      correlationId:  row.correlation_id ?? undefined,
    };
  }

  async getBoardEvents(boardId: string, limit = 50, offset = 0): Promise<AetherEvent[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM events
         WHERE board_id = $1
         ORDER BY timestamp DESC
         LIMIT $2 OFFSET $3`,
        [boardId, limit, offset]
      );
      return result.rows.map((r) => this.mapRow(r));
    } catch {
      return [];
    }
  }

  async getCardEvents(cardId: string, limit = 20): Promise<AetherEvent[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM events
         WHERE card_id = $1
            OR (subject_type = 'card' AND subject_id = $1)
         ORDER BY timestamp DESC
         LIMIT $2`,
        [cardId, limit]
      );
      return result.rows.map((r) => this.mapRow(r));
    } catch {
      return [];
    }
  }

  async getWorkspaceEvents(workspaceId: string, limit = 100, offset = 0): Promise<AetherEvent[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM events
         WHERE workspace_id = $1
         ORDER BY timestamp DESC
         LIMIT $2 OFFSET $3`,
        [workspaceId, limit, offset]
      );
      return result.rows.map((r) => this.mapRow(r));
    } catch {
      return [];
    }
  }

  async getDocumentEvents(documentId: string, limit = 50): Promise<AetherEvent[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM events
         WHERE document_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [documentId, limit]
      );
      return result.rows.map((r) => this.mapRow(r));
    } catch {
      return [];
    }
  }

  async getEventsByType(type: EventType, limit = 50): Promise<AetherEvent[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM events WHERE type = $1 ORDER BY timestamp DESC LIMIT $2`,
        [type, limit]
      );
      return result.rows.map((r) => this.mapRow(r));
    } catch {
      return [];
    }
  }

  async getUserEvents(actorId: string, limit = 50): Promise<AetherEvent[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM events WHERE actor_id = $1 ORDER BY timestamp DESC LIMIT $2`,
        [actorId, limit]
      );
      return result.rows.map((r) => this.mapRow(r));
    } catch {
      return [];
    }
  }
}

export const eventStore = new EventStoreService();
