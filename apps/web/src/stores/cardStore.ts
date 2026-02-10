// apps/web/src/stores/cardStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Card } from '@aether/types';

interface CardState {
  cards: Record<string, Card[]>;
  selectedCard: Card | null;
  currentWorkspaceId: string | null;
  isLoading: boolean;
  error: string | null;

  setCards: (listId: string, cards: Card[]) => void;
  addCard: (listId: string, card: Card) => void;
  updateCard: (cardId: string, updates: Partial<Card>) => void;
  removeCard: (cardId: string, listId: string) => void;
  moveCard: (cardId: string, fromListId: string, toListId: string, position: number) => void;
  setSelectedCard: (card: Card | null) => void;
  setCurrentWorkspaceId: (workspaceId: string | null) => void;
  clearAllCards: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  cards: {},
  selectedCard: null,
  currentWorkspaceId: null,
  isLoading: false,
  error: null,
};

export const useCardStore = create<CardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCards: (listId, cards) =>
        set((state) => ({
          cards: {
            ...state.cards,
            [listId]: cards,
          },
        })),

      addCard: (listId, card) =>
        set((state) => ({
          cards: {
            ...state.cards,
            [listId]: [...(state.cards[listId] || []), card],
          },
        })),

      updateCard: (cardId, updates) =>
        set((state) => {
          const newCards = { ...state.cards };

          for (const listId in newCards) {
            const listCards = newCards[listId];
            const cardIndex = listCards.findIndex((c) => c.id === cardId);

            if (cardIndex !== -1) {
              newCards[listId] = [
                ...listCards.slice(0, cardIndex),
                { ...listCards[cardIndex], ...updates },
                ...listCards.slice(cardIndex + 1),
              ];
              break;
            }
          }

          return { cards: newCards };
        }),

      removeCard: (cardId, listId) =>
        set((state) => ({
          cards: {
            ...state.cards,
            [listId]: (state.cards[listId] || []).filter((c) => c.id !== cardId),
          },
        })),

      moveCard: (cardId, fromListId, toListId, position) =>
        set((state) => {
          const newCards = { ...state.cards };
          const fromList = [...(newCards[fromListId] || [])];
          const toList = [...(newCards[toListId] || [])];

          const cardIndex = fromList.findIndex((c) => c.id === cardId);
          if (cardIndex === -1) return state;

          const [movedCard] = fromList.splice(cardIndex, 1);

          if (fromListId === toListId) {
            fromList.splice(position, 0, movedCard);
            newCards[fromListId] = fromList;
          } else {
            movedCard.listId = toListId;
            toList.splice(position, 0, movedCard);
            newCards[fromListId] = fromList;
            newCards[toListId] = toList;
          }

          return { cards: newCards };
        }),

      setSelectedCard: (card) => set({ selectedCard: card }),

      setCurrentWorkspaceId: (workspaceId) => set({ currentWorkspaceId: workspaceId }),

      clearAllCards: () => set({ cards: {} }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'aether-card-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cards: state.cards,
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    }
  )
);
