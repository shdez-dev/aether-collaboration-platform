import { pool } from '../lib/db';
import type { Event, EventType, UserId, EventId } from '@aether/types';
import { v7 as uuidv7 } from 'uuid';

/**
 * Event Store Service
 *
 * Responsable de persistir eventos en la base de datos y
 * publicarlos al sistema de mensajería (Redis pub/sub en el futuro).
 */
export class EventStoreService {
  /**
   * Emite un evento al sistema
   *
   * @param type - Tipo del evento (ej: 'auth.user.registered')
   * @param payload - Datos específicos del evento
   * @param userId - ID del usuario que genera el evento
   * @returns El evento creado
   */
  async emit<T extends EventType>(type: T, payload: unknown, userId: UserId): Promise<Event> {
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
      },
    };

    // Persistir evento en PostgreSQL
    await pool.query(
      `INSERT INTO events (id, event_type, payload, user_id, timestamp, version, vector_clock, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [eventId, type, JSON.stringify(payload), userId, timestamp, 1, JSON.stringify(vectorClock)]
    );

    // TODO: Publicar evento a Redis pub/sub para tiempo real
    // await redisClient.publish('events', JSON.stringify(event));

    console.log(`[EVENT] ${type}`, { eventId, userId });

    return event;
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
}

export const eventStore = new EventStoreService();
