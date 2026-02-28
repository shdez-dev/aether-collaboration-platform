// apps/api/src/services/__tests__/EventStoreService.test.ts

import { EventStoreService } from '../EventStoreService';
import { pool } from '../../lib/db';
import { redisPubClient } from '../../lib/redis';
import { getRealtimeGateway } from '../../websocket/RealtimeGateway';
import type { UserId, EventType } from '@aether/types';

// Mock dependencies
jest.mock('../../lib/db');
jest.mock('../../lib/redis');
jest.mock('../../websocket/RealtimeGateway');
jest.mock('../UserActivityService', () => ({
  userActivityService: {
    processEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('EventStoreService', () => {
  let eventStore: EventStoreService;
  let mockPool: jest.Mocked<typeof pool>;
  let mockRedis: jest.Mocked<typeof redisPubClient>;
  let mockGateway: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockPool = pool as jest.Mocked<typeof pool>;
    mockRedis = redisPubClient as jest.Mocked<typeof redisPubClient>;

    mockGateway = {
      broadcastToBoard: jest.fn(),
      broadcastToBoardExcept: jest.fn(),
      sendToUser: jest.fn(),
    };

    (getRealtimeGateway as jest.Mock).mockReturnValue(mockGateway);

    // Setup pool.query mock
    mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

    // Setup redis publish mock
    mockRedis.publish = jest.fn().mockResolvedValue(1);

    // Create new instance
    eventStore = new EventStoreService();
  });

  describe('emit', () => {
    it('should persist non-ephemeral events to PostgreSQL', async () => {
      const userId = 'user-123' as UserId;
      const payload = { cardId: 'card-456', title: 'Test Card' };

      await eventStore.emit('card.created', payload, userId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          expect.any(String), // eventId
          'card.created', // type
          JSON.stringify(payload), // payload
          userId, // userId
          expect.any(Number), // timestamp
          1, // version
          expect.any(String), // vector_clock
        ])
      );
    });

    it('should NOT persist ephemeral events (presence.* events)', async () => {
      const userId = 'user-123' as UserId;
      const payload = { boardId: 'board-789' };

      await eventStore.emit('presence.join' as EventType, payload, userId);

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should publish event to Redis pub/sub', async () => {
      const userId = 'user-123' as UserId;
      const payload = { cardId: 'card-456' };

      await eventStore.emit('card.created', payload, userId);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'aether:events',
        expect.stringContaining('"type":"card.created"')
      );
    });

    it('should broadcast to board via WebSocket if boardId provided', async () => {
      const userId = 'user-123' as UserId;
      const boardId = 'board-789';
      const payload = { cardId: 'card-456' };

      await eventStore.emit('card.created', payload, userId, boardId);

      expect(mockGateway.broadcastToBoard).toHaveBeenCalledWith(
        boardId,
        expect.objectContaining({
          type: 'card.created',
          payload,
        })
      );
    });

    it('should broadcast to board EXCEPT originating socket', async () => {
      const userId = 'user-123' as UserId;
      const boardId = 'board-789';
      const socketId = 'socket-abc';
      const payload = { cardId: 'card-456' };

      await eventStore.emit('card.created', payload, userId, boardId, socketId);

      expect(mockGateway.broadcastToBoardExcept).toHaveBeenCalledWith(
        boardId,
        expect.objectContaining({
          type: 'card.created',
          payload,
        }),
        socketId
      );

      expect(mockGateway.broadcastToBoard).not.toHaveBeenCalled();
    });

    it('should send event directly to targetUserId if provided', async () => {
      const userId = 'user-123' as UserId;
      const targetUserId = 'user-target';
      const payload = { message: 'Hello' };

      await eventStore.emit(
        'notification.created',
        payload,
        userId,
        undefined,
        undefined,
        targetUserId
      );

      expect(mockGateway.sendToUser).toHaveBeenCalledWith(
        targetUserId,
        expect.objectContaining({
          type: 'notification.created',
          payload,
        })
      );
    });

    it('should create event with vector clock', async () => {
      const userId = 'user-123' as UserId;
      const payload = { cardId: 'card-456' };

      const event = await eventStore.emit('card.created', payload, userId);

      expect(event.meta.vectorClock).toEqual({
        [userId]: 1,
      });
    });

    it('should include eventId, timestamp, and version in event meta', async () => {
      const userId = 'user-123' as UserId;
      const payload = { cardId: 'card-456' };

      const event = await eventStore.emit('card.created', payload, userId);

      expect(event.meta.eventId).toBeDefined();
      expect(event.meta.timestamp).toBeGreaterThan(0);
      expect(event.meta.version).toBe(1);
      expect(event.meta.userId).toBe(userId);
    });

    it('should not fail if Redis is unavailable', async () => {
      mockRedis.publish = jest.fn().mockRejectedValue(new Error('Redis down'));

      const userId = 'user-123' as UserId;
      const payload = { cardId: 'card-456' };

      await expect(eventStore.emit('card.created', payload, userId)).resolves.toBeDefined();
    });

    it('should not fail if WebSocket gateway is unavailable', async () => {
      (getRealtimeGateway as jest.Mock).mockImplementation(() => {
        throw new Error('Gateway not initialized');
      });

      const userId = 'user-123' as UserId;
      const payload = { cardId: 'card-456' };

      await expect(eventStore.emit('card.created', payload, userId)).resolves.toBeDefined();
    });
  });

  describe('getUserEvents', () => {
    it('should retrieve events for a specific user', async () => {
      const userId = 'user-123' as UserId;
      const mockEvents = [
        { id: '1', event_type: 'card.created', user_id: userId, timestamp: Date.now() },
        { id: '2', event_type: 'card.updated', user_id: userId, timestamp: Date.now() },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: mockEvents });

      const events = await eventStore.getUserEvents(userId);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), [
        userId,
        50,
      ]);
      expect(events).toEqual(mockEvents);
    });

    it('should limit results to specified limit', async () => {
      const userId = 'user-123' as UserId;
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await eventStore.getUserEvents(userId, 10);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [userId, 10]);
    });
  });

  describe('getEventsByType', () => {
    it('should retrieve events by event type', async () => {
      const eventType = 'card.created' as EventType;
      const mockEvents = [
        { id: '1', event_type: eventType, timestamp: Date.now() },
        { id: '2', event_type: eventType, timestamp: Date.now() },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: mockEvents });

      const events = await eventStore.getEventsByType(eventType);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE event_type = $1'),
        [eventType, 50]
      );
      expect(events).toEqual(mockEvents);
    });
  });

  describe('getBoardEvents', () => {
    it('should retrieve events related to a board', async () => {
      const boardId = 'board-789';
      const mockEvents = [
        {
          id: '1',
          event_type: 'board.created',
          payload: { boardId },
          timestamp: Date.now().toString(),
          user_id: 'user-123',
          version: 1,
          vector_clock: {},
        },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: mockEvents });

      const events = await eventStore.getBoardEvents(boardId);

      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('board.%'), [
        boardId,
        50,
        0,
      ]);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('board.created');
    });

    it('should handle pagination with offset', async () => {
      const boardId = 'board-789';
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await eventStore.getBoardEvents(boardId, 20, 40);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [boardId, 20, 40]);
    });

    it('should return empty array if query fails', async () => {
      const boardId = 'board-789';
      mockPool.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      const events = await eventStore.getBoardEvents(boardId);

      expect(events).toEqual([]);
    });
  });

  describe('getCardEvents', () => {
    it('should retrieve events for a specific card', async () => {
      const cardId = 'card-456';
      const mockEvents = [
        {
          id: '1',
          event_type: 'card.created',
          payload: { cardId },
          timestamp: Date.now().toString(),
          user_id: 'user-123',
          version: 1,
          vector_clock: {},
        },
      ];

      mockPool.query = jest.fn().mockResolvedValue({ rows: mockEvents });

      const events = await eventStore.getCardEvents(cardId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'cardId' = $1"),
        [cardId, 20]
      );
      expect(events).toHaveLength(1);
    });

    it('should return empty array if query fails', async () => {
      const cardId = 'card-456';
      mockPool.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      const events = await eventStore.getCardEvents(cardId);

      expect(events).toEqual([]);
    });
  });
});
