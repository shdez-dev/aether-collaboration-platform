// apps/api/src/services/__tests__/ListService.test.ts

import { ListService } from '../ListService';
import { pool } from '../../lib/db';
import { eventStore } from '../EventStoreService';

jest.mock('../../lib/db');
jest.mock('../EventStoreService');
jest.mock('../UserActivityService');

describe('ListService', () => {
  let listService: ListService;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    listService = new ListService();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock) = jest.fn().mockResolvedValue(mockClient);
    (pool.query as jest.Mock) = jest.fn().mockResolvedValue({ rows: [] });
    (eventStore.emit as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  describe('createList', () => {
    it('should create list with correct position', async () => {
      const boardId = 'board-123';
      const userId = 'user-123';
      const listData = { name: 'To Do' };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_position: 2 }] }) // Get max position
        .mockResolvedValueOnce({
          // INSERT list
          rows: [
            {
              id: 'list-new',
              board_id: boardId,
              name: listData.name,
              position: 3,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      // pool.query calls: getWorkspaceIdFromBoard, actor name lookup, board name lookup
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-123' }] }) // getWorkspaceIdFromBoard
        .mockResolvedValueOnce({ rows: [{ name: 'Test User' }] }) // actor name
        .mockResolvedValueOnce({ rows: [{ board_name: 'Test Board', project_name: null }] }); // board name

      const result = await listService.createList(boardId, userId, listData);

      expect(result.name).toBe(listData.name);
      expect(result.position).toBe(3);

      expect(eventStore.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list.created',
          actor: expect.objectContaining({ id: userId }),
          subject: expect.objectContaining({ id: 'list-new' }),
        })
      );
    });

    it('should set position to 1 for first list', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_position: 0 }] }) // No lists yet
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'list-first',
              board_id: 'board-1',
              name: 'First List',
              position: 1,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      const result = await listService.createList('board-1', 'user-1', { name: 'First List' });

      expect(result.position).toBe(1);
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_position: 0 }] })
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(listService.createList('board-1', 'user-1', { name: 'List' })).rejects.toThrow(
        'Database error'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getBoardLists', () => {
    it('should return lists with card counts', async () => {
      const boardId = 'board-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'list-1',
            board_id: boardId,
            name: 'To Do',
            position: 1,
            card_count: '5',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'list-2',
            board_id: boardId,
            name: 'In Progress',
            position: 2,
            card_count: '3',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await listService.getBoardLists(boardId);

      expect(result).toHaveLength(2);
      expect(result[0].cardCount).toBe(5);
      expect(result[1].cardCount).toBe(3);
    });

    it('should order lists by position', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'list-3',
            position: 3,
            name: 'Third',
            board_id: 'board-1',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'list-1',
            position: 1,
            name: 'First',
            board_id: 'board-1',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await listService.getBoardLists('board-1');

      expect(result[0].position).toBe(3);
      expect(result[1].position).toBe(1);
    });
  });

  describe('getListById', () => {
    it('should return list by id', async () => {
      const listId = 'list-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: listId,
            board_id: 'board-1',
            name: 'My List',
            position: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await listService.getListById(listId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(listId);
      expect(result?.name).toBe('My List');
    });

    it('should return null if list not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await listService.getListById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateList', () => {
    it('should update list name', async () => {
      const listId = 'list-123';
      const userId = 'user-123';
      const updates = { name: 'Updated Name' };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ name: 'Old Name' }] }) // SELECT before
        .mockResolvedValueOnce({
          // UPDATE
          rows: [
            {
              id: listId,
              board_id: 'board-1',
              name: updates.name,
              position: 1,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      // pool.query calls: getWorkspaceIdFromBoard, actor name lookup
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] }) // getWorkspaceIdFromBoard
        .mockResolvedValueOnce({ rows: [{ name: 'Test User' }] }); // actor name

      const result = await listService.updateList(listId, userId, updates);

      expect(result.name).toBe(updates.name);

      expect(eventStore.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list.updated',
          actor: expect.objectContaining({ id: userId }),
          subject: expect.objectContaining({ id: listId }),
        })
      );
    });

    it('should throw error if list not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ name: 'Old Name' }] }) // SELECT before
        .mockResolvedValueOnce({ rows: [] }); // UPDATE returns nothing

      await expect(
        listService.updateList('non-existent', 'user-1', { name: 'New' })
      ).rejects.toThrow('List not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('deleteList', () => {
    it('should delete list successfully', async () => {
      const listId = 'list-123';
      const userId = 'user-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT COUNT cards
          rows: [{ count: 0 }],
        })
        .mockResolvedValueOnce({
          // SELECT board_id
          rows: [{ board_id: 'board-1', name: 'My List' }],
        })
        .mockResolvedValueOnce({}) // DELETE
        .mockResolvedValueOnce({}); // COMMIT

      // pool.query calls: getWorkspaceIdFromBoard, actor name lookup
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] }) // getWorkspaceIdFromBoard
        .mockResolvedValueOnce({ rows: [{ name: 'Test User' }] }); // actor name

      await listService.deleteList(listId, userId);

      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM lists'), [
        listId,
      ]);

      expect(eventStore.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list.deleted',
          actor: expect.objectContaining({ id: userId }),
          subject: expect.objectContaining({ id: listId }),
        })
      );
    });

    it('should throw error if list not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT COUNT cards
          rows: [{ count: 0 }],
        })
        .mockResolvedValueOnce({ rows: [] }); // SELECT board_id - not found

      await expect(listService.deleteList('non-existent', 'user-1')).rejects.toThrow(
        'List not found'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('reorderList', () => {
    it('should reorder list to new position', async () => {
      const listId = 'list-123';
      const userId = 'user-123';
      const newPosition = 2;

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT current list
          rows: [
            {
              id: listId,
              board_id: 'board-1',
              position: 1,
            },
          ],
        })
        .mockResolvedValueOnce({}) // UPDATE other lists
        .mockResolvedValueOnce({}) // UPDATE this list
        .mockResolvedValueOnce({}); // COMMIT

      // pool.query calls: getWorkspaceIdFromBoard, actor name lookup
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] }) // getWorkspaceIdFromBoard
        .mockResolvedValueOnce({ rows: [{ name: 'Test User' }] }); // actor name

      await listService.reorderList(listId, userId, newPosition);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      expect(eventStore.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'list.order-changed',
          actor: expect.objectContaining({ id: userId }),
        })
      );
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(listService.reorderList('list-1', 'user-1', 2)).rejects.toThrow(
        'Database error'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
