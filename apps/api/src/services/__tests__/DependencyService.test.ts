// apps/api/src/services/__tests__/DependencyService.test.ts

import { DependencyService } from '../DependencyService';
import { pool } from '../../lib/db';
import { eventStore } from '../EventStoreService';

jest.mock('../../lib/db');
jest.mock('../EventStoreService');

describe('DependencyService', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock) = jest.fn().mockResolvedValue(mockClient);
    (pool.query as jest.Mock) = jest.fn();
    (eventStore.emit as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  describe('getDependencies', () => {
    it('should return blockedBy and blocking dependencies', async () => {
      const cardId = 'card-123';

      // Mock blockedBy query (cards that block this card)
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'dep-1',
              blocking_card_id: 'card-456',
              blocked_card_id: cardId,
              created_by: 'user-1',
              created_at: new Date(),
              related_id: 'card-456',
              related_title: 'Blocking Card',
              related_completed: false,
              related_list_id: 'list-1',
              related_list_name: 'In Progress',
            },
          ],
        })
        // Mock blocking query (cards that this card blocks)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'dep-2',
              blocking_card_id: cardId,
              blocked_card_id: 'card-789',
              created_by: 'user-1',
              created_at: new Date(),
              related_id: 'card-789',
              related_title: 'Blocked Card',
              related_completed: false,
              related_list_id: 'list-2',
              related_list_name: 'Backlog',
            },
          ],
        });

      const result = await DependencyService.getDependencies(cardId);

      expect(result.blockedBy).toHaveLength(1);
      expect(result.blockedBy[0].blockingCardId).toBe('card-456');
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0].blockedCardId).toBe('card-789');
    });

    it('should return empty arrays if no dependencies', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await DependencyService.getDependencies('card-no-deps');

      expect(result.blockedBy).toEqual([]);
      expect(result.blocking).toEqual([]);
    });
  });

  describe('addDependency', () => {
    it('should successfully add a dependency without cycle', async () => {
      const blockingCardId = 'card-blocking';
      const blockedCardId = 'card-blocked';
      const userId = 'user-123';

      // Mock cycle check (no cycle) - pool.query
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // cycle check
        .mockResolvedValueOnce({
          // getBoardAndWorkspace after COMMIT
          rows: [{ board_id: 'board-123', workspace_id: 'ws-123' }],
        });

      // Mock transaction queries
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // INSERT
          rows: [
            {
              id: 'dep-new',
              blocking_card_id: blockingCardId,
              blocked_card_id: blockedCardId,
              created_by: userId,
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          // cardInfo query
          rows: [
            {
              id: blockingCardId,
              title: 'Blocking Card',
              completed: false,
              list_id: 'list-1',
              list_name: 'In Progress',
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      const result = await DependencyService.addDependency(blockingCardId, blockedCardId, userId);

      expect(result.id).toBe('dep-new');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if card depends on itself', async () => {
      const cardId = 'card-self';

      await expect(DependencyService.addDependency(cardId, cardId, 'user-123')).rejects.toThrow(
        'A card cannot depend on itself'
      );
    });

    it('should throw error if circular dependency detected', async () => {
      const blockingCardId = 'card-1';
      const blockedCardId = 'card-2';

      // Mock cycle detection: card-2 already has path to card-1
      (pool.query as jest.Mock)
        // First call: check cycle - return path that leads back to blocking card
        .mockResolvedValueOnce({
          rows: [{ blocked_card_id: 'card-3' }],
        })
        .mockResolvedValueOnce({
          rows: [{ blocked_card_id: blockingCardId }], // Found cycle!
        });

      await expect(
        DependencyService.addDependency(blockingCardId, blockedCardId, 'user-123')
      ).rejects.toThrow('Circular dependency detected');
    });

    it('should rollback transaction on error', async () => {
      const blockingCardId = 'card-1';
      const blockedCardId = 'card-2';

      // Mock cycle check passes
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      // Mock transaction: BEGIN succeeds, INSERT fails
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(
        DependencyService.addDependency(blockingCardId, blockedCardId, 'user-123')
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('removeDependency', () => {
    it('should successfully remove a dependency', async () => {
      const dependencyId = 'dep-123';
      const cardId = 'card-1';
      const userId = 'user-123';

      // Mock getBoardAndWorkspace (pool.query)
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ board_id: 'board-123', workspace_id: 'ws-123' }],
      });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // DELETE
          rows: [
            {
              id: dependencyId,
              blocking_card_id: 'card-1',
              blocked_card_id: 'card-2',
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      await DependencyService.removeDependency(dependencyId, cardId, userId);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM card_dependencies'),
        [dependencyId, cardId]
      );
    });

    it('should throw error if dependency not found', async () => {
      const dependencyId = 'non-existent';
      const cardId = 'card-1';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // DELETE returns nothing

      await expect(
        DependencyService.removeDependency(dependencyId, cardId, 'user-123')
      ).rejects.toThrow('Dependency not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Cycle Detection Algorithm', () => {
    it('should detect direct cycle: A → B, B → A', async () => {
      const cardA = 'card-A';
      const cardB = 'card-B';

      // Existing: A → B
      // Trying to add: B → A (would create cycle)

      // Mock BFS: start from A, find that A blocks B, then B === blockingId (B)
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ blocked_card_id: cardB }], // A → B exists, so adding B → A creates cycle
      });

      await expect(DependencyService.addDependency(cardB, cardA, 'user')).rejects.toThrow(
        'Circular dependency detected'
      );
    });

    it('should detect indirect cycle: A → B → C, C → A', async () => {
      const cardA = 'card-A';
      const cardC = 'card-C';

      // Existing: A → B → C
      // Trying to add: C → A (would create cycle)

      // Mock BFS traversal: start from A, find A→B, then B→C, then C === blockingId
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ blocked_card_id: 'card-B' }], // A → B exists
        })
        .mockResolvedValueOnce({
          rows: [{ blocked_card_id: cardC }], // B → C exists, cycle detected!
        });

      await expect(DependencyService.addDependency(cardC, cardA, 'user')).rejects.toThrow(
        'Circular dependency detected'
      );
    });

    it('should allow valid dependency without cycle', async () => {
      const cardA = 'card-A';
      const cardD = 'card-D';

      // Existing: A → B → C
      // Adding: D → A is valid (no cycle)

      // Mock: D does not have a path to A
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // cycle check
        .mockResolvedValueOnce({
          // getBoardAndWorkspace
          rows: [{ board_id: 'board-123', workspace_id: 'ws-123' }],
        });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'dep-new',
              blocking_card_id: cardD,
              blocked_card_id: cardA,
              created_by: 'user',
              created_at: new Date(),
            },
          ],
        }) // INSERT
        .mockResolvedValueOnce({
          // cardInfo query
          rows: [
            {
              id: cardD,
              title: 'Card D',
              completed: false,
              list_id: 'list-1',
              list_name: 'To Do',
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      const result = await DependencyService.addDependency(cardD, cardA, 'user');

      expect(result).toBeDefined();
      expect(result.blockingCardId).toBe(cardD);
      expect(result.blockedCardId).toBe(cardA);
    });

    it('should handle complex graph without false positives', async () => {
      // Graph: A → B, A → C, B → D, C → D
      // Adding: D → E should be valid (no cycle back to D)

      const cardD = 'card-D';
      const cardE = 'card-E';

      // Mock: D blocks nothing that leads back to D
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // cycle check
        .mockResolvedValueOnce({
          // getBoardAndWorkspace
          rows: [{ board_id: 'board-1', workspace_id: 'ws-1' }],
        });

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'dep-new',
              blocking_card_id: cardD,
              blocked_card_id: cardE,
              created_by: 'user',
              created_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          // cardInfo query
          rows: [
            {
              id: cardD,
              title: 'Card D',
              completed: false,
              list_id: 'list-1',
              list_name: 'In Progress',
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      await expect(DependencyService.addDependency(cardD, cardE, 'user')).resolves.toBeDefined();
    });
  });
});
