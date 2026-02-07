// apps/api/src/services/EventStoreService.ts

import { pool } from '../lib/db';
import { redisPubClient } from '../lib/redis';
import type { Event, EventType, UserId, EventId } from '@aether/types';
import { v7 as uuidv7 } from 'uuid';
import { userActivityService } from './UserActivityService';

/**
 * Event Store Service
 *
 * Responsable de persistir eventos en la base de datos,
 * publicarlos a Redis pub/sub, y hacer broadcast via WebSocket.
 */
export class EventStoreService {
  /**
   * Emite un evento al sistema
   *
   * @param type - Tipo del evento (ej: 'card.created')
   * @param payload - Datos específicos del evento
   * @param userId - ID del usuario que genera el evento
   * @param boardId - ID del board (opcional, para WebSocket broadcast)
   * @param socketId - ID del socket que originó el evento (opcional, para evitar echo)
   * @param targetUserId - ID de usuario específico para envío directo (opcional)
   * @returns El evento creado
   */
  async emit<T extends EventType>(
    type: T,
    payload: unknown,
    userId: UserId,
    boardId?: string,
    socketId?: string,
    targetUserId?: string
  ): Promise<Event> {
    const eventId = uuidv7() as EventId;
    const timestamp = Date.now();

    // Vector clock simple: solo el usuario actual con contador 1
    // En una implementación completa, esto se incrementaría por usuario
    const vectorClock = {
      [userId]: 1,
    };

    const event: Event = {
      type,
      payload,
      meta: {
        eventId,
        timestamp,
        userId,
        version: 1,
        vectorClock,
        socketId: socketId as any,
      },
    };

    // Determinar si es evento efímero (no se persiste en DB)
    const isEphemeral = this.isEphemeralEvent(type);

    // Persistir evento en PostgreSQL (solo si no es efímero)
    if (!isEphemeral) {
      await pool.query(
        `INSERT INTO events (id, event_type, payload, user_id, timestamp, version, vector_clock, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [eventId, type, JSON.stringify(payload), userId, timestamp, 1, JSON.stringify(vectorClock)]
      );

      // ========================================
      // Registrar actividad del usuario
      // ========================================
      try {
        await userActivityService.processEvent(type, payload, userId);
      } catch (error) {
        console.warn('[EventStore] Failed to log user activity:', error);
        // No fallar el evento principal si falla el log
      }
    }

    // Publicar evento a Redis pub/sub
    try {
      await redisPubClient.publish('aether:events', JSON.stringify(event));
    } catch (error) {
      console.error('[EventStore] Failed to publish to Redis:', error);
      // No fallar si Redis no está disponible
    }

    // Broadcast via WebSocket
    try {
      // Import dinámico para evitar dependencia circular
      const { getRealtimeGateway } = await import('../websocket/RealtimeGateway');
      const gateway = getRealtimeGateway();

      // Si hay un usuario objetivo específico, enviar directamente
      if (targetUserId) {
        gateway.sendToUser(targetUserId, event);
      }

      // Si hay boardId, broadcast al board
      if (boardId) {
        if (socketId) {
          // Broadcast a todos EXCEPTO el socket que originó el evento
          gateway.broadcastToBoardExcept(boardId, event, socketId);
        } else {
          // Broadcast a todos
          gateway.broadcastToBoard(boardId, event);
        }
      }
    } catch (error) {
      console.warn('[EventStore] WebSocket gateway not available:', error);
      // No fallar si WebSocket no está disponible
    }

    console.log(`[EVENT] ${type}`, {
      eventId,
      userId,
      boardId: boardId || 'none',
      targetUserId: targetUserId || 'none',
    });

    return event;
  }

  /**
   * Determina si un evento es efímero (no se persiste)
   */
  private isEphemeralEvent(eventType: EventType): boolean {
    return eventType.startsWith('presence.');
  }

  /**
   * Obtiene eventos de un usuario
   */
  async getUserEvents(userId: UserId, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM events 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Obtiene eventos por tipo
   */
  async getEventsByType(type: EventType, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM events 
       WHERE event_type = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [type, limit]
    );

    return result.rows;
  }

  /**
   * Obtiene eventos de un board (Milestone 5)
   */
  async getBoardEvents(boardId: string, limit = 50, offset = 0): Promise<Event[]> {
    try {
      const result = await pool.query(
        `SELECT e.* FROM events e
         WHERE e.event_type LIKE 'board.%' 
            OR e.event_type LIKE 'list.%'
            OR e.event_type LIKE 'card.%'
         AND (
           e.payload->>'boardId' = $1
           OR e.payload->>'listId' IN (
             SELECT id::text FROM lists WHERE board_id = $1
           )
           OR e.payload->>'cardId' IN (
             SELECT c.id::text FROM cards c
             INNER JOIN lists l ON c.list_id = l.id
             WHERE l.board_id = $1
           )
         )
         ORDER BY e.timestamp DESC
         LIMIT $2 OFFSET $3`,
        [boardId, limit, offset]
      );

      return result.rows.map((row) => ({
        type: row.event_type,
        payload: row.payload,
        meta: {
          eventId: row.id,
          timestamp: parseInt(row.timestamp),
          userId: row.user_id,
          version: row.version,
          vectorClock: row.vector_clock,
        },
      }));
    } catch (error) {
      console.error('[EventStore] Error getting board events:', error);
      return [];
    }
  }

  /**
   * Obtiene eventos de una card (Milestone 5)
   */
  async getCardEvents(cardId: string, limit = 20): Promise<Event[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM events
         WHERE event_type LIKE 'card.%'
           AND payload->>'cardId' = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [cardId, limit]
      );

      return result.rows.map((row) => ({
        type: row.event_type,
        payload: row.payload,
        meta: {
          eventId: row.id,
          timestamp: parseInt(row.timestamp),
          userId: row.user_id,
          version: row.version,
          vectorClock: row.vector_clock,
        },
      }));
    } catch (error) {
      console.error('[EventStore] Error getting card events:', error);
      return [];
    }
  }
}

export const eventStore = new EventStoreService();
