// apps/api/src/services/__tests__/BoardService.test.ts

import { BoardService } from '../BoardService';
import { pool } from '../../lib/db';
import { eventStore } from '../EventStoreService';

jest.mock('../../lib/db');
jest.mock('../EventStoreService');
jest.mock('../UserActivityService');

describe('BoardService', () => {
  let boardService: BoardService;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    boardService = new BoardService();

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    (pool.connect as jest.Mock) = jest.fn().mockResolvedValue(mockClient);
    (pool.query as jest.Mock) = jest.fn();
    (eventStore.emit as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  describe('createBoard', () => {
    it('should create a new board with default Backlog list', async () => {
      const workspaceId = 'ws-123';
      const userId = 'user-123';
      const boardData = {
        name: 'My Board',
        description: 'Test description',
      };

      // Mock queries
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_position: 0 }] }) // Get max position
        .mockResolvedValueOnce({
          // INSERT board
          rows: [
            {
              id: 'board-new',
              workspace_id: workspaceId,
              name: boardData.name,
              description: boardData.description,
              position: 1,
              archived: false,
              created_by: userId,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}) // INSERT Backlog list
        .mockResolvedValueOnce({}); // COMMIT

      const result = await boardService.createBoard(workspaceId, userId, boardData);

      expect(result.id).toBe('board-new');
      expect(result.name).toBe(boardData.name);
      expect(result.position).toBe(1);

      // Verify Backlog list was created
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO lists'), [
        'board-new',
        'Backlog',
        1,
        userId,
      ]);

      // Verify event was emitted
      expect(eventStore.emit).toHaveBeenCalledWith(
        'board.created',
        expect.objectContaining({
          boardId: 'board-new',
          workspaceId,
          name: boardData.name,
        }),
        userId,
        'board-new',
        undefined,
        undefined,
        workspaceId
      );
    });

    it('should calculate correct position for new board', async () => {
      // Mock existing boards with max position 5
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_position: 5 }] }) // Get max position
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'board-new',
              workspace_id: 'ws-123',
              name: 'New Board',
              position: 6, // Should be max + 1
              created_by: 'user-123',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}) // INSERT list
        .mockResolvedValueOnce({}); // COMMIT

      const result = await boardService.createBoard('ws-123', 'user-123', { name: 'New Board' });

      expect(result.position).toBe(6);
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_position: 0 }] })
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(
        boardService.createBoard('ws-123', 'user-123', { name: 'Board' })
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getWorkspaceBoards', () => {
    it('should return all non-archived boards with counts', async () => {
      const workspaceId = 'ws-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'board-1',
            workspace_id: workspaceId,
            name: 'Board 1',
            position: 1,
            archived: false,
            list_count: '3',
            card_count: '10',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'board-2',
            workspace_id: workspaceId,
            name: 'Board 2',
            position: 2,
            archived: false,
            list_count: '2',
            card_count: '5',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await boardService.getWorkspaceBoards(workspaceId);

      expect(result).toHaveLength(2);
      expect(result[0].listCount).toBe(3);
      expect(result[0].cardCount).toBe(10);
      expect(result[1].listCount).toBe(2);
      expect(result[1].cardCount).toBe(5);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE b.workspace_id = $1 AND b.archived = false'),
        [workspaceId]
      );
    });

    it('should return empty array if no boards', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await boardService.getWorkspaceBoards('ws-empty');

      expect(result).toEqual([]);
    });

    it('should order boards by position', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'board-3',
            position: 3,
            name: 'Third',
            archived: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'board-1',
            position: 1,
            name: 'First',
            archived: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'board-2',
            position: 2,
            name: 'Second',
            archived: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await boardService.getWorkspaceBoards('ws-123');

      // Should be ordered by position
      expect(result[0].position).toBe(3);
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBe(2);
    });
  });

  describe('getBoardById', () => {
    it('should return board with lists and cards', async () => {
      const boardId = 'board-123';

      mockClient.query
        .mockResolvedValueOnce({
          // SELECT board
          rows: [
            {
              id: boardId,
              workspace_id: 'ws-123',
              name: 'My Board',
              position: 1,
              archived: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          // SELECT lists
          rows: [
            { id: 'list-1', board_id: boardId, name: 'To Do', position: 1 },
            { id: 'list-2', board_id: boardId, name: 'In Progress', position: 2 },
          ],
        })
        .mockResolvedValueOnce({
          // SELECT cards
          rows: [
            {
              id: 'card-1',
              list_id: 'list-1',
              title: 'Task 1',
              position: 1,
              created_at: new Date(),
            },
            {
              id: 'card-2',
              list_id: 'list-2',
              title: 'Task 2',
              position: 1,
              created_at: new Date(),
            },
          ],
        });

      const result = await boardService.getBoardById(boardId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(boardId);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null if board not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await boardService.getBoardById('non-existent');

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('updateBoard', () => {
    it('should update board successfully', async () => {
      const boardId = 'board-123';
      const userId = 'user-123';
      const updates = {
        name: 'Updated Board Name',
        description: 'Updated description',
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // UPDATE board
          rows: [
            {
              id: boardId,
              workspace_id: 'ws-123',
              name: updates.name,
              description: updates.description,
              position: 1,
              archived: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      const result = await boardService.updateBoard(boardId, userId, updates);

      expect(result.name).toBe(updates.name);
      expect(result.description).toBe(updates.description);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'board.updated',
        expect.objectContaining({
          boardId,
          changes: updates,
        }),
        userId,
        boardId,
        undefined,
        undefined,
        'ws-123'
      );
    });

    it('should throw error if board not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // UPDATE returns nothing

      await expect(
        boardService.updateBoard('non-existent', 'user-123', { name: 'New' })
      ).rejects.toThrow('Board not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('archiveBoard', () => {
    it('should archive board successfully', async () => {
      const boardId = 'board-123';
      const userId = 'user-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // UPDATE board set archived = true
          rows: [
            {
              id: boardId,
              workspace_id: 'ws-123',
              name: 'Board',
              archived: true,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      await boardService.archiveBoard(boardId, userId);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE boards'),
        expect.arrayContaining([boardId])
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'board.archived',
        expect.objectContaining({
          boardId,
        }),
        userId,
        boardId,
        undefined,
        undefined,
        'ws-123'
      );
    });

    it('should throw error if board not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // UPDATE returns nothing

      await expect(boardService.archiveBoard('non-existent', 'user-123')).rejects.toThrow(
        'Board not found'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('deleteBoard', () => {
    it('should delete board and cascade to lists/cards', async () => {
      const boardId = 'board-123';
      const userId = 'user-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT board
          rows: [{ id: boardId, workspace_id: 'ws-123', archived: true }],
        })
        .mockResolvedValueOnce({
          // SELECT count lists
          rows: [{ count: 0 }],
        })
        .mockResolvedValueOnce({}) // DELETE board
        .mockResolvedValueOnce({}); // COMMIT

      await boardService.deleteBoard(boardId, userId);

      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM boards'), [
        boardId,
      ]);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'board.deleted',
        expect.objectContaining({
          boardId,
        }),
        userId,
        undefined,
        undefined,
        undefined,
        'ws-123'
      );
    });

    it('should throw error if board not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // DELETE returns nothing

      await expect(boardService.deleteBoard('non-existent', 'user-123')).rejects.toThrow(
        'Board not found'
      );
    });
  });
});
