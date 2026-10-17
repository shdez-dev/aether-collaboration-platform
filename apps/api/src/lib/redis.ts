// apps/api/src/lib/redis.ts

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SOCKET_INVALIDATION_CHANNEL = 'aether:socket:invalidate';

export type SocketInvalidationKind = 'disconnect' | 'revalidate';
export interface SocketInvalidation {
  kind: SocketInvalidationKind;
  userId: string;
  sourceId: string;
}

const socketInvalidationHandlers = new Set<(message: SocketInvalidation) => void>();

export function onSocketInvalidation(handler: (message: SocketInvalidation) => void): void {
  socketInvalidationHandlers.add(handler);
}

export async function publishSocketInvalidation(
  kind: SocketInvalidationKind,
  userId: string,
  sourceId: string,
): Promise<void> {
  await redisPubClient.publish(
    SOCKET_INVALIDATION_CHANNEL,
    JSON.stringify({ kind, userId, sourceId } satisfies SocketInvalidation),
  );
}

/**
 * Redis Client for AETHER
 * Used for:
 * - User presence (ephemeral data)
 * - Typing indicators
 * - Pub/Sub for events
 * - Caching (future)
 */
export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Reconnect on READONLY error
      return true;
    }
    return false;
  },
  lazyConnect: true, // Don't connect immediately
});

redisClient.on('connect', () => {
});

let lastRedisErrorLog = 0;
const logRedisError = (err: Error) => {
  if (Date.now() - lastRedisErrorLog < 30_000) return;
  lastRedisErrorLog = Date.now();
  console.error('[redis] connection error:', err.message);
};
redisClient.on('error', logRedisError);

redisClient.on('close', () => {
});

/**
 * Pub/Sub Client (separate connection)
 * Redis requires separate connections for pub/sub
 */
export const redisPubClient = new Redis(REDIS_URL, { lazyConnect: true });
export const redisSubClient = new Redis(REDIS_URL, { lazyConnect: true });
redisPubClient.on('error', logRedisError);
redisSubClient.on('error', logRedisError);

redisPubClient.on('connect', () => {
});

redisSubClient.on('connect', () => {
});

/**
 * Initialize Redis connections
 * Call this on server startup
 */
export async function initializeRedis(): Promise<void> {
  await Promise.all([redisClient.connect(), redisPubClient.connect(), redisSubClient.connect()]);

  // Subscribe to event stream
  await redisSubClient.subscribe('aether:events', SOCKET_INVALIDATION_CHANNEL);

  redisSubClient.on('message', (channel, message) => {
    if (channel === 'aether:events') {
      // Handle event broadcasting (future use)
      return;
    }

    if (channel === SOCKET_INVALIDATION_CHANNEL) {
      try {
        const parsed = JSON.parse(message) as Partial<SocketInvalidation>;
        if (
          (parsed.kind !== 'disconnect' && parsed.kind !== 'revalidate') ||
          typeof parsed.userId !== 'string' ||
          parsed.userId.length === 0 ||
          typeof parsed.sourceId !== 'string'
        ) {
          return;
        }

        for (const handler of socketInvalidationHandlers) {
          handler(parsed as SocketInvalidation);
        }
      } catch {
        // Ignore malformed messages on the internal invalidation channel.
      }
    }
  });
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function closeRedisConnections(): Promise<void> {
  await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
}
