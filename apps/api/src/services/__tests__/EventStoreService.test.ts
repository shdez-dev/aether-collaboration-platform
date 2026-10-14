// apps/api/src/services/__tests__/EventStoreService.test.ts

import { EventStoreService } from '../EventStoreService';
import { pool } from '../../lib/db';
import { redisPubClient } from '../../lib/redis';
import { getRealtimeGateway } from '../../websocket/RealtimeGateway';
import type { EventType } from '@aether/types';

jest.mock('../../lib/db');
jest.mock('../../lib/redis');
jest.mock('../../websocket/RealtimeGateway');
jest.mock('../UserActivityService', () => ({
  userActivityService: {
    processEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

const BASE_PARAMS = {
  actor:   { id: 'user-123', name: 'Test User' },
  subject: { type: 'card' as const, id: 'card-456', name: 'Test Card' },
  context: { workspaceId: 'ws-001', boardId: 'board-789' },
  payload: { position: 1 },
};

describe('EventStoreService', () => {
  let eventStore: EventStoreService;
  let mockPool: jest.Mocked<typeof pool>;
  let mockRedis: jest.Mocked<typeof redisPubClient>;
  let mockGateway: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPool  = pool as jest.Mocked<typeof pool>;
    mockRedis = redisPubClient as jest.Mocked<typeof redisPubClient>;

    mockGateway = {
      broadcastToBoard:       jest.fn(),
      broadcastToBoardExcept: jest.fn(),
      broadcastToWorkspace:   jest.fn(),
      broadcastToProject:     jest.fn(),
      broadcastToDocument:    jest.fn(),
      invalidateWorkspace:    jest.fn(),
      revalidateUserRooms:    jest.fn(),
      revalidateProjectRooms: jest.fn(),
      sendToUser:             jest.fn(),
    };

    (getRealtimeGateway as jest.Mock).mockReturnValue(mockGateway);
    mockPool.query  = jest.fn().mockResolvedValue({ rows: [] });
    mockRedis.publish = jest.fn().mockResolvedValue(1);

    eventStore = new EventStoreService();
  });

  describe('emit', () => {
    it('should persist non-ephemeral events to PostgreSQL', async () => {
      await eventStore.emit({ type: 'card.created', ...BASE_PARAMS });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining(['card.created'])
      );
    });

    it('should NOT persist ephemeral events (presence.*)', async () => {
      await eventStore.emit({
        type:    'presence.user.typing' as EventType,
        actor:   BASE_PARAMS.actor,
        subject: BASE_PARAMS.subject,
        context: BASE_PARAMS.context,
        payload: { cardId: 'card-456' },
      });

      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should publish event to Redis pub/sub', async () => {
      await eventStore.emit({ type: 'card.created', ...BASE_PARAMS });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        'aether:events',
        expect.stringContaining('"type":"card.created"')
      );
    });

    it('should broadcast to board via WebSocket when boardId in context', async () => {
      await eventStore.emit({ type: 'card.created', ...BASE_PARAMS });

      expect(mockGateway.broadcastToBoard).toHaveBeenCalledWith(
        BASE_PARAMS.context.boardId,
        expect.objectContaining({ type: 'card.created' })
      );
    });

    it('should broadcast to board EXCEPT originating socket when socketId provided', async () => {
      await eventStore.emit({
        type: 'card.created',
        ...BASE_PARAMS,
        socketId: 'socket-abc',
      });

      expect(mockGateway.broadcastToBoardExcept).toHaveBeenCalledWith(
        BASE_PARAMS.context.boardId,
        expect.objectContaining({ type: 'card.created' }),
        'socket-abc'
      );
      expect(mockGateway.broadcastToBoard).not.toHaveBeenCalled();
    });

    it('should send event directly to targetUserId if provided', async () => {
      await eventStore.emit({
        type:         'card.member.assigned',
        actor:        BASE_PARAMS.actor,
        subject:      { type: 'member', id: 'user-target', name: 'Target User' },
        context:      BASE_PARAMS.context,
        payload:      { memberId: 'user-target', memberName: 'Target User' },
        targetUserId: 'user-target',
      });

      expect(mockGateway.sendToUser).toHaveBeenCalledWith(
        'user-target',
        expect.objectContaining({ type: 'card.member.assigned' })
      );
    });

    it('routes project-scoped events to authorized project rooms and sends only a workspace invalidation', async () => {
      const event = await eventStore.emit({
        type: 'project.member.added',
        actor: BASE_PARAMS.actor,
        subject: { type: 'project', id: 'project-123', name: 'Private project' },
        context: { workspaceId: 'ws-001' },
        payload: { projectId: 'project-123', projectName: 'Private project' },
      });

      expect(mockGateway.broadcastToProject).toHaveBeenCalledWith('project-123', event);
      expect(mockGateway.invalidateWorkspace).toHaveBeenCalledWith('ws-001', 'projects');
      expect(mockGateway.broadcastToWorkspace).not.toHaveBeenCalled();
    });

    it('broadcasts general workspace events with a data-free full-refresh hint', async () => {
      const event = await eventStore.emit({
        type: 'workspace.updated',
        actor: BASE_PARAMS.actor,
        subject: { type: 'workspace', id: 'ws-001', name: 'Workspace' },
        context: { workspaceId: 'ws-001' },
        payload: { changed: true },
      });

      expect(mockGateway.broadcastToWorkspace).toHaveBeenCalledWith('ws-001', event);
      expect(mockGateway.invalidateWorkspace).toHaveBeenCalledWith('ws-001', 'all');
    });

    it('routes document metadata events only to the authorized document room and invalidates the workspace list', async () => {
      const event = await eventStore.emit({
        type: 'document.updated',
        actor: BASE_PARAMS.actor,
        subject: { type: 'document', id: 'document-123', name: 'Private document' },
        context: { workspaceId: 'ws-001', documentId: 'document-123' },
        payload: { changes: { title: 'New title' } },
      });

      expect(mockGateway.broadcastToDocument).toHaveBeenCalledWith('document-123', event);
      expect(mockGateway.invalidateWorkspace).toHaveBeenCalledWith('ws-001', 'documents');
      expect(mockGateway.broadcastToWorkspace).not.toHaveBeenCalled();
    });

    it('revokes a removed project member before sending the event to any shared room', async () => {
      const order: string[] = [];
      mockGateway.revalidateUserRooms.mockImplementation(async () => { order.push('revalidate'); });
      mockGateway.broadcastToProject.mockImplementation(() => { order.push('project'); });
      mockGateway.sendToUser.mockImplementation(() => { order.push('user'); });

      await eventStore.emit({
        type: 'project.member.removed',
        actor: BASE_PARAMS.actor,
        subject: { type: 'project', id: 'project-123', name: 'Project' },
        context: { workspaceId: 'ws-001' },
        payload: { projectId: 'project-123', memberId: 'removed-user' },
        targetUserId: 'removed-user',
      });

      expect(mockGateway.revalidateUserRooms).toHaveBeenCalledWith('removed-user');
      expect(order.indexOf('revalidate')).toBeLessThan(order.indexOf('project'));
      expect(order.indexOf('revalidate')).toBeLessThan(order.indexOf('user'));
    });

    it('closes project rooms after a project is deleted', async () => {
      await eventStore.emit({
        type: 'project.deleted',
        actor: BASE_PARAMS.actor,
        subject: { type: 'project', id: 'project-123', name: 'Project' },
        context: { workspaceId: 'ws-001' },
        payload: {},
      });

      expect(mockGateway.revalidateProjectRooms).toHaveBeenCalledWith('project-123');
    });

    it('should increment vector clock per user on successive emits', async () => {
      const e1 = await eventStore.emit({ type: 'card.created', ...BASE_PARAMS });
      const e2 = await eventStore.emit({ type: 'card.updated', ...BASE_PARAMS });

      expect(e1.vectorClock['user-123']).toBe(1);
      expect(e2.vectorClock['user-123']).toBe(2);
    });

    it('should include eventId and timestamp on returned event', async () => {
      const event = await eventStore.emit({ type: 'card.created', ...BASE_PARAMS });

      expect(event.eventId).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
      expect(event.version).toBe(1);
      expect(event.actor.id).toBe('user-123');
    });

    it('should not fail if Redis is unavailable', async () => {
      mockRedis.publish = jest.fn().mockRejectedValue(new Error('Redis down'));

      await expect(
        eventStore.emit({ type: 'card.created', ...BASE_PARAMS })
      ).resolves.toBeDefined();
    });

    it('should not fail if WebSocket gateway is unavailable', async () => {
      (getRealtimeGateway as jest.Mock).mockImplementation(() => {
        throw new Error('Gateway not initialized');
      });

      await expect(
        eventStore.emit({ type: 'card.created', ...BASE_PARAMS })
      ).resolves.toBeDefined();
    });

    it('should store delta when provided', async () => {
      await eventStore.emit({
        type:    'card.updated',
        ...BASE_PARAMS,
        delta:   { before: { title: 'Old' }, after: { title: 'New' } },
        payload: {},
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO events'),
        expect.arrayContaining([
          JSON.stringify({ before: { title: 'Old' }, after: { title: 'New' } }),
        ])
      );
    });
  });

  describe('getUserEvents', () => {
    it('should query by actor_id', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await eventStore.getUserEvents('user-123', 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('actor_id = $1'),
        ['user-123', 10]
      );
    });
  });

  describe('getBoardEvents', () => {
    it('should query by board_id', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await eventStore.getBoardEvents('board-789', 20, 40);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('board_id = $1'),
        ['board-789', 20, 40]
      );
    });

    it('should return empty array if query fails', async () => {
      mockPool.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      const events = await eventStore.getBoardEvents('board-789');

      expect(events).toEqual([]);
    });
  });

  describe('getCardEvents', () => {
    it('should query by card_id', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await eventStore.getCardEvents('card-456');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('card_id = $1'),
        ['card-456', 20]
      );
    });

    it('should return empty array if query fails', async () => {
      mockPool.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      const events = await eventStore.getCardEvents('card-456');

      expect(events).toEqual([]);
    });
  });

  describe('getEventsByType', () => {
    it('should query by type', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await eventStore.getEventsByType('card.created' as EventType, 25);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE type = $1'),
        ['card.created', 25]
      );
    });
  });
});
