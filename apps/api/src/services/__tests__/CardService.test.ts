// apps/api/src/services/__tests__/CardService.test.ts

import { CardService } from '../CardService';
import { pool } from '../../lib/db';
import { eventStore } from '../EventStoreService';

jest.mock('../../lib/db');
jest.mock('../EventStoreService');
jest.mock('../UserActivityService');

describe('CardService', () => {
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

  describe('getCardsByListId', () => {
    it('should return cards with members and labels', async () => {
      const listId = 'list-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'card-1',
            list_id: listId,
            title: 'Task 1',
            position: 1,
            completed: false,
            created_at: new Date(),
            updated_at: new Date(),
            members: [{ id: 'user-1', name: 'User 1', email: 'user1@test.com' }],
            labels: [{ id: 'label-1', name: 'Bug', color: '#ff0000' }],
          },
          {
            id: 'card-2',
            list_id: listId,
            title: 'Task 2',
            position: 2,
            completed: false,
            created_at: new Date(),
            updated_at: new Date(),
            members: [],
            labels: [],
          },
        ],
      });

      const result = await CardService.getCardsByListId(listId);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Task 1');
      expect(result[1].title).toBe('Task 2');
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE c.list_id = $1'), [
        listId,
      ]);
    });

    it('should order cards by position', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: 'card-3',
            position: 3,
            title: 'Third',
            list_id: 'list-1',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'card-1',
            position: 1,
            title: 'First',
            list_id: 'list-1',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      const result = await CardService.getCardsByListId('list-1');

      expect(result[0].position).toBe(3);
      expect(result[1].position).toBe(1);
    });
  });

  describe('createCard', () => {
    it('should create card with correct position', async () => {
      const listId = 'list-123';
      const userId = 'user-123';
      const cardData = {
        title: 'New Card',
        description: 'Card description',
        priority: 'HIGH' as const,
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_pos: 5 }] }) // Get max position
        .mockResolvedValueOnce({
          // INSERT card
          rows: [
            {
              id: 'card-new',
              list_id: listId,
              title: cardData.title,
              description: cardData.description,
              position: 6,
              priority: cardData.priority,
              completed: false,
              created_by: userId,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [{ name: 'To Do' }] }); // SELECT list name

      // Mock helper queries
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ board_id: 'board-123' }] }) // getBoardIdFromList
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-123' }] }); // getWorkspaceIdFromBoard

      const result = await CardService.createCard(listId, userId, cardData);

      expect(result.title).toBe(cardData.title);
      expect(result.position).toBe(6);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'card.created',
        expect.objectContaining({
          cardId: 'card-new',
          title: cardData.title,
        }),
        userId,
        'board-123',
        undefined
      );
    });

    it('should set position to 1 for first card in list', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_pos: 0 }] }) // No cards yet
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'card-first',
              list_id: 'list-1',
              title: 'First Card',
              position: 1,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [{ name: 'Backlog' }] }); // SELECT list name

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ board_id: 'board-1' }] })
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] });

      const result = await CardService.createCard('list-1', 'user-1', { title: 'First Card' });

      expect(result.position).toBe(1);
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ max_pos: 0 }] })
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(CardService.createCard('list-1', 'user-1', { title: 'Card' })).rejects.toThrow(
        'Database error'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getCardById', () => {
    it('should return card with all relations', async () => {
      const cardId = 'card-123';

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          {
            id: cardId,
            list_id: 'list-1',
            title: 'Test Card',
            description: 'Test description',
            position: 1,
            completed: false,
            created_at: new Date(),
            updated_at: new Date(),
            members: [{ id: 'user-1', name: 'User 1', email: 'user1@test.com' }],
            labels: [{ id: 'label-1', name: 'Bug', color: '#ff0000' }],
          },
        ],
      });

      const result = await CardService.getCardById(cardId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(cardId);
      expect(result?.title).toBe('Test Card');
    });

    it('should return null if card not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const result = await CardService.getCardById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateCard', () => {
    it('should update card successfully', async () => {
      const cardId = 'card-123';
      const userId = 'user-123';
      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
        priority: 'HIGH' as const,
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT current card
          rows: [
            {
              id: cardId,
              list_id: 'list-1',
              title: 'Old Title',
              completed: false,
              position: 1,
            },
          ],
        })
        .mockResolvedValueOnce({
          // UPDATE
          rows: [
            {
              id: cardId,
              list_id: 'list-1',
              title: updates.title,
              description: updates.description,
              priority: updates.priority,
              position: 1,
              completed: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ board_id: 'board-1' }],
        })
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] });

      const result = await CardService.updateCard(cardId, userId, updates);

      expect(result.title).toBe(updates.title);
      expect(result.description).toBe(updates.description);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'card.updated',
        expect.objectContaining({
          cardId,
          changes: updates,
        }),
        userId,
        'board-1',
        undefined
      );
    });

    it('should throw error if card not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // UPDATE returns nothing

      await expect(
        CardService.updateCard('non-existent', 'user-1', { title: 'New' })
      ).rejects.toThrow('Card not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('deleteCard', () => {
    it('should delete card successfully', async () => {
      const cardId = 'card-123';
      const userId = 'user-123';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // DELETE
          rows: [
            {
              id: cardId,
              list_id: 'list-1',
            },
          ],
        })
        .mockResolvedValueOnce({}); // COMMIT

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ board_id: 'board-1' }] })
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] });

      await CardService.deleteCard(cardId, userId);

      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM cards'), [
        cardId,
      ]);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'card.deleted',
        expect.objectContaining({ cardId }),
        userId,
        'board-1',
        undefined
      );
    });

    it('should throw error if card not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] });

      await expect(CardService.deleteCard('non-existent', 'user-1')).rejects.toThrow(
        'Card not found'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('moveCard', () => {
    it('should move card to different list', async () => {
      const cardId = 'card-123';
      const userId = 'user-123';
      const moveData = {
        toListId: 'list-target',
        position: 2,
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          // SELECT current card
          rows: [
            {
              id: cardId,
              list_id: 'list-source',
              position: 1,
              title: 'Card',
            },
          ],
        })
        .mockResolvedValueOnce({}) // UPDATE positions in source list
        .mockResolvedValueOnce({}) // UPDATE positions in target list
        .mockResolvedValueOnce({
          // UPDATE card
          rows: [
            {
              id: cardId,
              list_id: moveData.toListId,
              title: 'Card',
              position: moveData.position,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({ rows: [{ name: 'Source List' }] }) // SELECT from list name
        .mockResolvedValueOnce({ rows: [{ name: 'Target List' }] }); // SELECT to list name

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ board_id: 'board-1' }] })
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] });

      const result = await CardService.moveCard(cardId, userId, moveData);

      expect(result.listId).toBe(moveData.toListId);
      expect(result.position).toBe(moveData.position);

      expect(eventStore.emit).toHaveBeenCalledWith(
        'card.moved',
        expect.objectContaining({
          cardId,
          toListId: moveData.toListId,
        }),
        userId,
        'board-1',
        undefined
      );
    });
  });

  describe('assignMember', () => {
    it('should assign member to card', async () => {
      const cardId = 'card-123';
      const userId = 'user-to-assign';
      const assignedBy = 'user-admin';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing (not found, so can assign)
        .mockResolvedValueOnce({}) // INSERT into card_members
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({
          // SELECT card title
          rows: [{ title: 'Card Title' }],
        })
        .mockResolvedValueOnce({
          // SELECT user name/email
          rows: [{ name: 'Assigner Name', email: 'assigner@example.com' }],
        });

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ board_id: 'board-1' }] })
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] })
        .mockResolvedValueOnce({ rows: [{ name: 'Member Name' }] }); // SELECT name del usuario asignado

      await CardService.assignMember(cardId, userId, assignedBy);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO card_members'),
        [cardId, userId]
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'card.member.assigned',
        expect.objectContaining({ cardId, userId }),
        assignedBy,
        'board-1',
        undefined,
        userId // The service also sends notification directly to the assigned user
      );
    });
  });

  describe('unassignMember', () => {
    it('should unassign member from card', async () => {
      const cardId = 'card-123';
      const userId = 'user-to-remove';
      const removedBy = 'user-admin';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // DELETE from card_members
        .mockResolvedValueOnce({}) // COMMIT
        .mockResolvedValueOnce({
          // SELECT card title
          rows: [{ title: 'Card Title' }],
        });

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ board_id: 'board-1' }] })
        .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }] })
        .mockResolvedValueOnce({ rows: [{ name: 'Remover Name' }] }) // SELECT name del que desasigna
        .mockResolvedValueOnce({ rows: [{ name: 'Member Name' }] }); // SELECT name del desasignado

      await CardService.unassignMember(cardId, userId, removedBy);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM card_members'),
        [cardId, userId]
      );

      expect(eventStore.emit).toHaveBeenCalledWith(
        'card.member.unassigned',
        expect.objectContaining({ cardId, userId }),
        removedBy,
        'board-1',
        undefined,
        userId // The service also sends notification directly to the unassigned user
      );
    });
  });
});
