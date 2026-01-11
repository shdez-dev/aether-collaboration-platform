// apps/api/src/lib/redis.ts

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

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
  console.log('[Redis] Connected');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Error:', err);
});

redisClient.on('close', () => {
  console.log('[Redis] Connection closed');
});

/**
 * Pub/Sub Client (separate connection)
 * Redis requires separate connections for pub/sub
 */
export const redisPubClient = new Redis(REDIS_URL, { lazyConnect: true });
export const redisSubClient = new Redis(REDIS_URL, { lazyConnect: true });

redisPubClient.on('connect', () => {
  console.log('[Redis] Pub/Sub publisher connected');
});

redisSubClient.on('connect', () => {
  console.log('[Redis] Pub/Sub subscriber connected');
});

/**
 * Initialize Redis connections
 * Call this on server startup
 */
export async function initializeRedis(): Promise<void> {
  try {
    await Promise.all([redisClient.connect(), redisPubClient.connect(), redisSubClient.connect()]);

    // Subscribe to event stream
    await redisSubClient.subscribe('aether:events');
    console.log('[Redis] Subscribed to aether:events channel');

    redisSubClient.on('message', (channel, message) => {
      if (channel === 'aether:events') {
        // Handle event broadcasting (future use)
        // console.log('Event received:', message);
      }
    });
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Health check for Redis
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

/**
 * Graceful shutdown
 */
export async function closeRedisConnections(): Promise<void> {
  await Promise.all([redisClient.quit(), redisPubClient.quit(), redisSubClient.quit()]);
  console.log('[Redis] All connections closed');
}
