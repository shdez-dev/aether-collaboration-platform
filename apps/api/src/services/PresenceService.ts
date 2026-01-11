// apps/api/src/services/PresenceService.ts

import Redis from 'ioredis';
import type { ActiveUser, TypingIndicator } from '@aether/types';

/**
 * PresenceService
 * Maneja la presencia de usuarios en tiempo real usando Redis
 *
 * Keys en Redis:
 * - board:{boardId}:users -> Set de userIds activos
 * - board:{boardId}:user:{userId} -> Hash con info del usuario
 * - card:{cardId}:typing -> Set de userIds escribiendo
 * - user:{userId}:boards -> Set de boardIds donde está activo
 */
export class PresenceService {
  private redis: Redis;
  private readonly USER_TIMEOUT = 300; // 5 minutos en segundos
  private readonly TYPING_TIMEOUT = 5; // 5 segundos

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  // ============================================================================
  // BOARD PRESENCE
  // ============================================================================

  /**
   * Usuario se une a un board
   */
  async joinBoard(boardId: string, user: ActiveUser): Promise<void> {
    const pipeline = this.redis.pipeline();
    const now = new Date().toISOString();

    // Agregar usuario al set de usuarios activos del board
    pipeline.sadd(`board:${boardId}:users`, user.id);

    // Guardar info del usuario con TTL
    pipeline.hset(
      `board:${boardId}:user:${user.id}`,
      'id',
      user.id,
      'name',
      user.name,
      'email',
      user.email,
      'avatar',
      user.avatar || '',
      'joinedAt',
      user.joinedAt || now,
      'lastActivity',
      now
    );
    pipeline.expire(`board:${boardId}:user:${user.id}`, this.USER_TIMEOUT);

    // Agregar board al set de boards del usuario
    pipeline.sadd(`user:${user.id}:boards`, boardId);
    pipeline.expire(`user:${user.id}:boards`, this.USER_TIMEOUT);

    await pipeline.exec();
  }

  /**
   * Usuario sale de un board
   */
  async leaveBoard(boardId: string, userId: string): Promise<void> {
    const pipeline = this.redis.pipeline();

    // Remover usuario del set de usuarios activos
    pipeline.srem(`board:${boardId}:users`, userId);
    pipeline.del(`board:${boardId}:user:${userId}`);

    // Remover board del set de boards del usuario
    pipeline.srem(`user:${userId}:boards`, boardId);

    // Limpiar typing si estaba escribiendo
    const typingKeys = await this.redis.keys(`card:*:typing`);
    for (const key of typingKeys) {
      pipeline.srem(key, userId);
    }

    await pipeline.exec();
  }

  /**
   * Actualizar última actividad del usuario
   */
  async updateActivity(boardId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.redis.hset(`board:${boardId}:user:${userId}`, 'lastActivity', now);
    await this.redis.expire(`board:${boardId}:user:${userId}`, this.USER_TIMEOUT);
  }

  /**
   * Obtener usuarios activos en un board
   */
  async getActiveUsers(boardId: string): Promise<ActiveUser[]> {
    const userIds = await this.redis.smembers(`board:${boardId}:users`);
    const users: ActiveUser[] = [];

    for (const userId of userIds) {
      const userData = await this.redis.hgetall(`board:${boardId}:user:${userId}`);

      if (userData && userData.id) {
        users.push({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          avatar: userData.avatar || undefined,
          joinedAt: userData.joinedAt,
          lastActivity: userData.lastActivity,
        });
      }
    }

    return users;
  }

  /**
   * Contar usuarios activos en un board
   */
  async countActiveUsers(boardId: string): Promise<number> {
    return await this.redis.scard(`board:${boardId}:users`);
  }

  /**
   * Verificar si un usuario está activo en un board
   */
  async isUserActive(boardId: string, userId: string): Promise<boolean> {
    return (await this.redis.sismember(`board:${boardId}:users`, userId)) === 1;
  }

  // ============================================================================
  // TYPING INDICATORS
  // ============================================================================

  /**
   * Usuario empieza a escribir en una card
   */
  async startTyping(cardId: string, userId: string, userName: string): Promise<void> {
    await this.redis.hset(
      `card:${cardId}:typing`,
      userId,
      JSON.stringify({ userId, userName, startedAt: Date.now() })
    );
    await this.redis.expire(`card:${cardId}:typing`, this.TYPING_TIMEOUT);
  }

  /**
   * Usuario deja de escribir en una card
   */
  async stopTyping(cardId: string, userId: string): Promise<void> {
    await this.redis.hdel(`card:${cardId}:typing`, userId);
  }

  /**
   * Obtener quién está escribiendo en una card
   */
  async getTypingUsers(cardId: string): Promise<TypingIndicator[]> {
    const typingData = await this.redis.hgetall(`card:${cardId}:typing`);
    const now = Date.now();
    const indicators: TypingIndicator[] = [];

    for (const [userId, data] of Object.entries(typingData)) {
      try {
        const parsed = JSON.parse(data);
        // Solo retornar si no ha pasado el timeout
        if (now - parsed.startedAt < this.TYPING_TIMEOUT * 1000) {
          indicators.push(parsed);
        } else {
          // Limpiar indicadores expirados
          await this.stopTyping(cardId, userId);
        }
      } catch (e) {
        console.error('Error parsing typing data:', e);
      }
    }

    return indicators;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Limpiar usuario de todos los boards (cuando se desconecta)
   */
  async cleanupUser(userId: string): Promise<void> {
    const boards = await this.redis.smembers(`user:${userId}:boards`);

    for (const boardId of boards) {
      await this.leaveBoard(boardId, userId);
    }

    await this.redis.del(`user:${userId}:boards`);
  }

  /**
   * Limpiar datos expirados de un board (ejecutar periódicamente)
   */
  async cleanupBoard(boardId: string): Promise<void> {
    const userIds = await this.redis.smembers(`board:${boardId}:users`);

    for (const userId of userIds) {
      const exists = await this.redis.exists(`board:${boardId}:user:${userId}`);
      if (!exists) {
        // Remover del set si los datos expiraron
        await this.redis.srem(`board:${boardId}:users`, userId);
      }
    }
  }

  /**
   * Obtener estadísticas de presencia
   */
  async getStats(boardId: string): Promise<{
    activeUsers: number;
    typingCards: number;
  }> {
    const activeUsers = await this.countActiveUsers(boardId);
    const typingKeys = await this.redis.keys(`card:*:typing`);

    let typingCards = 0;
    for (const key of typingKeys) {
      const count = await this.redis.hlen(key);
      if (count > 0) typingCards++;
    }

    return { activeUsers, typingCards };
  }
}

// Export singleton instance
let presenceServiceInstance: PresenceService | null = null;

export function getPresenceService(redisClient: Redis): PresenceService {
  if (!presenceServiceInstance) {
    presenceServiceInstance = new PresenceService(redisClient);
  }
  return presenceServiceInstance;
}
