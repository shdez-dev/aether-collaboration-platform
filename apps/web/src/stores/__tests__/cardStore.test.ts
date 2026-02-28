// apps/web/src/stores/__tests__/cardStore.test.ts

import { act, renderHook } from '@testing-library/react';
import { useCardStore } from '../cardStore';
import type { Card } from '@aether/types';

describe('CardStore', () => {
  beforeEach(() => {
    useCardStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useCardStore());

      expect(result.current.cards).toEqual({});
      expect(result.current.selectedCard).toBeNull();
      expect(result.current.currentWorkspaceId).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('setCards', () => {
    it('should set cards for a list', () => {
      const { result } = renderHook(() => useCardStore());

      const mockCards: Card[] = [
        {
          id: 'card-1',
          listId: 'list-1',
          title: 'Card 1',
          position: 1,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'card-2',
          listId: 'list-1',
          title: 'Card 2',
          position: 2,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      act(() => {
        result.current.setCards('list-1', mockCards);
      });

      expect(result.current.cards['list-1']).toEqual(mockCards);
    });
  });

  describe('addCard', () => {
    it('should add a card to a list', () => {
      const { result } = renderHook(() => useCardStore());

      const newCard: Card = {
        id: 'card-new',
        listId: 'list-1',
        title: 'New Card',
        position: 1,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        result.current.addCard('list-1', newCard);
      });

      expect(result.current.cards['list-1']).toHaveLength(1);
      expect(result.current.cards['list-1'][0]).toEqual(newCard);
    });

    it('should add multiple cards to the same list', () => {
      const { result } = renderHook(() => useCardStore());

      const card1: Card = {
        id: 'card-1',
        listId: 'list-1',
        title: 'Card 1',
        position: 1,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const card2: Card = {
        id: 'card-2',
        listId: 'list-1',
        title: 'Card 2',
        position: 2,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        result.current.addCard('list-1', card1);
        result.current.addCard('list-1', card2);
      });

      expect(result.current.cards['list-1']).toHaveLength(2);
      expect(result.current.cards['list-1']).toEqual([card1, card2]);
    });
  });

  describe('updateCard', () => {
    it('should update a card', () => {
      const { result } = renderHook(() => useCardStore());

      const card: Card = {
        id: 'card-1',
        listId: 'list-1',
        title: 'Original Title',
        position: 1,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        result.current.addCard('list-1', card);
      });

      act(() => {
        result.current.updateCard('card-1', { title: 'Updated Title', completed: true });
      });

      expect(result.current.cards['list-1'][0].title).toBe('Updated Title');
      expect(result.current.cards['list-1'][0].completed).toBe(true);
    });
  });

  describe('removeCard', () => {
    it('should remove a card from a list', () => {
      const { result } = renderHook(() => useCardStore());

      const card1: Card = {
        id: 'card-1',
        listId: 'list-1',
        title: 'Card 1',
        position: 1,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const card2: Card = {
        id: 'card-2',
        listId: 'list-1',
        title: 'Card 2',
        position: 2,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        result.current.setCards('list-1', [card1, card2]);
      });

      act(() => {
        result.current.removeCard('card-1', 'list-1');
      });

      expect(result.current.cards['list-1']).toHaveLength(1);
      expect(result.current.cards['list-1'][0].id).toBe('card-2');
    });
  });

  describe('moveCard', () => {
    it('should move card within the same list', () => {
      const { result } = renderHook(() => useCardStore());

      const cards: Card[] = [
        {
          id: 'card-1',
          listId: 'list-1',
          title: 'Card 1',
          position: 0,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'card-2',
          listId: 'list-1',
          title: 'Card 2',
          position: 1,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'card-3',
          listId: 'list-1',
          title: 'Card 3',
          position: 2,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      act(() => {
        result.current.setCards('list-1', cards);
      });

      // Move card-1 to position 2
      act(() => {
        result.current.moveCard('card-1', 'list-1', 'list-1', 2);
      });

      expect(result.current.cards['list-1'][0].id).toBe('card-2');
      expect(result.current.cards['list-1'][1].id).toBe('card-3');
      expect(result.current.cards['list-1'][2].id).toBe('card-1');
    });

    it('should move card to a different list', () => {
      const { result } = renderHook(() => useCardStore());

      const list1Cards: Card[] = [
        {
          id: 'card-1',
          listId: 'list-1',
          title: 'Card 1',
          position: 0,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'card-2',
          listId: 'list-1',
          title: 'Card 2',
          position: 1,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const list2Cards: Card[] = [
        {
          id: 'card-3',
          listId: 'list-2',
          title: 'Card 3',
          position: 0,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      act(() => {
        result.current.setCards('list-1', list1Cards);
        result.current.setCards('list-2', list2Cards);
      });

      // Move card-1 from list-1 to list-2 at position 0
      act(() => {
        result.current.moveCard('card-1', 'list-1', 'list-2', 0);
      });

      expect(result.current.cards['list-1']).toHaveLength(1);
      expect(result.current.cards['list-2']).toHaveLength(2);
      expect(result.current.cards['list-2'][0].id).toBe('card-1');
      expect(result.current.cards['list-2'][0].listId).toBe('list-2');
    });
  });

  describe('setSelectedCard', () => {
    it('should select a card', () => {
      const { result } = renderHook(() => useCardStore());

      const card: Card = {
        id: 'card-1',
        listId: 'list-1',
        title: 'Card 1',
        position: 1,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        result.current.setSelectedCard(card);
      });

      expect(result.current.selectedCard).toEqual(card);
    });

    it('should clear selected card', () => {
      const { result } = renderHook(() => useCardStore());

      const card: Card = {
        id: 'card-1',
        listId: 'list-1',
        title: 'Card 1',
        position: 1,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        result.current.setSelectedCard(card);
      });

      expect(result.current.selectedCard).toEqual(card);

      act(() => {
        result.current.setSelectedCard(null);
      });

      expect(result.current.selectedCard).toBeNull();
    });
  });

  describe('clearAllCards', () => {
    it('should clear all cards', () => {
      const { result } = renderHook(() => useCardStore());

      const cards: Card[] = [
        {
          id: 'card-1',
          listId: 'list-1',
          title: 'Card 1',
          position: 1,
          completed: false,
          createdBy: 'user-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      act(() => {
        result.current.setCards('list-1', cards);
      });

      expect(Object.keys(result.current.cards).length).toBeGreaterThan(0);

      act(() => {
        result.current.clearAllCards();
      });

      expect(result.current.cards).toEqual({});
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useCardStore());

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useCardStore());

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');
    });

    it('should clear error message', () => {
      const { result } = renderHook(() => useCardStore());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset store to initial state', () => {
      const { result } = renderHook(() => useCardStore());

      const card: Card = {
        id: 'card-1',
        listId: 'list-1',
        title: 'Card 1',
        position: 1,
        completed: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      act(() => {
        result.current.addCard('list-1', card);
        result.current.setSelectedCard(card);
        result.current.setLoading(true);
        result.current.setError('Some error');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.cards).toEqual({});
      expect(result.current.selectedCard).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
