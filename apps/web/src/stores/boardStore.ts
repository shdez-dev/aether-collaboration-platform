// apps/web/src/stores/boardStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { socketService } from '@/services/socketService';
import { apiService } from '@/services/apiService';
import { useCardStore } from './cardStore';
import { useAuthStore } from './authStore';
import type { Event, Board, List, Card } from '@aether/types';

// ==================== TYPES ====================

interface ActiveUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string;
  lastActivity: string;
}

interface BoardState {
  // Estado
  boards: Board[];
  currentBoard: Board | null;
  lists: List[];
  isLoading: boolean;
  error: string | null;

  // Estado de WebSocket
  isSocketConnected: boolean;
  activeUsers: ActiveUser[];

  // Acciones - Boards
  fetchBoards: (workspaceId: string) => Promise<void>;
  fetchBoardById: (boardId: string) => Promise<void>;
  createBoard: (workspaceId: string, data: CreateBoardData) => Promise<Board>;
  updateBoard: (boardId: string, data: UpdateBoardData) => Promise<void>;
  archiveBoard: (boardId: string) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;

  // Acciones - Lists
  createList: (boardId: string, name: string) => Promise<void>;
  updateList: (listId: string, name: string) => Promise<void>;
  reorderList: (listId: string, newPosition: number) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;

  // Acciones - WebSocket
  connectSocket: () => void;
  disconnectSocket: () => void;
  joinBoard: (boardId: string) => void;
  leaveBoard: (boardId: string) => void;
  handleEvent: (event: Event) => void;
  setActiveUsers: (users: ActiveUser[]) => void;

  // Helpers
  clearError: () => void;
  selectBoard: (board: Board | null) => void;
}

interface CreateBoardData {
  name: string;
  description?: string;
}

interface UpdateBoardData {
  name?: string;
  description?: string;
}

// ==================== STORE ====================

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      boards: [],
      currentBoard: null,
      lists: [],
      isLoading: false,
      error: null,
      isSocketConnected: false,
      activeUsers: [],

      // ==================== WEBSOCKET - CONNECT ====================
      connectSocket: () => {
        const { accessToken } = useAuthStore.getState();

        if (!accessToken) {
          console.warn('[BoardStore] No access token available for WebSocket');
          return;
        }

        if (socketService.isConnected()) {
          return;
        }

        socketService.connect(accessToken);

        // Configurar event listeners
        socketService.on('connect', () => {
          set({ isSocketConnected: true });

          // Re-unirse al board actual si existe
          const currentBoard = get().currentBoard;
          if (currentBoard) {
            socketService.joinBoard(currentBoard.id);
          }
        });

        socketService.on('disconnect', () => {
          set({ isSocketConnected: false, activeUsers: [] });
        });

        // Escuchar eventos del sistema
        socketService.onEvent((event: Event) => {
          get().handleEvent(event);
        });

        // Escuchar actualizaciones de usuarios activos
        socketService.onPresenceUsers((data) => {
          set({ activeUsers: data.users });
        });

        // Cuando te unes exitosamente a un board
        socketService.onJoinedBoard((data) => {
          set({ activeUsers: data.users });
        });
      },

      // ==================== WEBSOCKET - DISCONNECT ====================
      disconnectSocket: () => {
        socketService.removeAllListeners();
        socketService.disconnect();
        set({ isSocketConnected: false, activeUsers: [] });
      },

      // ==================== WEBSOCKET - JOIN BOARD ====================
      joinBoard: (boardId: string) => {
        socketService.joinBoard(boardId);
      },

      // ==================== WEBSOCKET - LEAVE BOARD ====================
      leaveBoard: (boardId: string) => {
        socketService.leaveBoard(boardId);
        set({ activeUsers: [] });
      },

      // ==================== WEBSOCKET - HANDLE EVENT ====================
      handleEvent: (event: Event) => {
        const cardStore = useCardStore.getState();

        switch (event.type) {
          // ========== CARD EVENTS ==========
          case 'card.created': {
            const { card } = event.payload as any;
            if (card) {
              cardStore.addCard(card.listId, card);
            }
            break;
          }

          case 'card.updated': {
            const { cardId, changes } = event.payload as any;
            if (cardId && changes) {
              cardStore.updateCard(cardId, changes);
            }
            break;
          }

          case 'card.moved': {
            const { cardId, fromListId, toListId, toPosition } = event.payload as any;
            if (cardId && fromListId && toListId !== undefined && toPosition !== undefined) {
              cardStore.moveCard(cardId, fromListId, toListId, toPosition);
            }
            break;
          }

          case 'card.deleted': {
            const { cardId, listId } = event.payload as any;
            if (cardId && listId) {
              cardStore.removeCard(cardId, listId);
            }
            break;
          }

          // ✅ FIXED: Actualización en tiempo real de miembros asignados
          case 'card.member.assigned': {
            const { cardId, member } = event.payload as any;
            if (cardId && member) {
              // Obtener la card actual del store
              const allCards = cardStore.cards;
              let currentCard: Card | null = null;

              // Buscar la card en todas las listas
              for (const cards of Object.values(allCards)) {
                const found = cards.find((c) => c.id === cardId);
                if (found) {
                  currentCard = found;
                  break;
                }
              }

              if (currentCard) {
                // Verificar que el miembro no esté ya asignado (evitar duplicados)
                const alreadyAssigned = (currentCard.members || []).some((m) => m.id === member.id);

                if (!alreadyAssigned) {
                  // Agregar el nuevo miembro a la lista de miembros
                  const updatedMembers = [...(currentCard.members || []), member];
                  cardStore.updateCard(cardId, { members: updatedMembers });

                  // Si la card está seleccionada en el modal, actualizarla también
                  if (cardStore.selectedCard?.id === cardId) {
                    cardStore.setSelectedCard({ ...currentCard, members: updatedMembers });
                  }
                }
              }
            }
            break;
          }

          case 'card.member.unassigned': {
            const { cardId, memberId } = event.payload as any;
            if (cardId && memberId) {
              // Obtener la card actual del store
              const allCards = cardStore.cards;
              let currentCard: Card | null = null;

              // Buscar la card en todas las listas
              for (const cards of Object.values(allCards)) {
                const found = cards.find((c) => c.id === cardId);
                if (found) {
                  currentCard = found;
                  break;
                }
              }

              if (currentCard) {
                // Remover el miembro de la lista
                const updatedMembers = (currentCard.members || []).filter((m) => m.id !== memberId);
                cardStore.updateCard(cardId, { members: updatedMembers });

                // Si la card está seleccionada en el modal, actualizarla también
                if (cardStore.selectedCard?.id === cardId) {
                  cardStore.setSelectedCard({ ...currentCard, members: updatedMembers });
                }
              }
            }
            break;
          }

          // ✅ FIXED: Actualización en tiempo real de labels
          case 'card.label.added': {
            const { cardId, label } = event.payload as any;
            if (cardId && label) {
              // Obtener la card actual del store
              const allCards = cardStore.cards;
              let currentCard: Card | null = null;

              // Buscar la card en todas las listas
              for (const cards of Object.values(allCards)) {
                const found = cards.find((c) => c.id === cardId);
                if (found) {
                  currentCard = found;
                  break;
                }
              }

              if (currentCard) {
                // Verificar que el label no esté ya asignado
                const alreadyAssigned = (currentCard.labels || []).some((l) => l.id === label.id);

                if (!alreadyAssigned) {
                  const updatedLabels = [...(currentCard.labels || []), label];
                  cardStore.updateCard(cardId, { labels: updatedLabels });

                  if (cardStore.selectedCard?.id === cardId) {
                    cardStore.setSelectedCard({ ...currentCard, labels: updatedLabels });
                  }
                }
              }
            }
            break;
          }

          case 'card.label.removed': {
            const { cardId, labelId } = event.payload as any;
            if (cardId && labelId) {
              // Obtener la card actual del store
              const allCards = cardStore.cards;
              let currentCard: Card | null = null;

              // Buscar la card en todas las listas
              for (const cards of Object.values(allCards)) {
                const found = cards.find((c) => c.id === cardId);
                if (found) {
                  currentCard = found;
                  break;
                }
              }

              if (currentCard) {
                const updatedLabels = (currentCard.labels || []).filter((l) => l.id !== labelId);
                cardStore.updateCard(cardId, { labels: updatedLabels });

                if (cardStore.selectedCard?.id === cardId) {
                  cardStore.setSelectedCard({ ...currentCard, labels: updatedLabels });
                }
              }
            }
            break;
          }

          // ========== LIST EVENTS ==========
          case 'list.created': {
            const { list } = event.payload as any;
            if (list) {
              set((state) => ({
                lists: [...state.lists, list],
              }));
            }
            break;
          }

          case 'list.updated': {
            const { listId, changes } = event.payload as any;
            if (listId && changes) {
              set((state) => ({
                lists: state.lists.map((l) => (l.id === listId ? { ...l, ...changes } : l)),
              }));
            }
            break;
          }

          case 'list.deleted': {
            const { listId } = event.payload as any;
            if (listId) {
              set((state) => ({
                lists: state.lists.filter((l) => l.id !== listId),
              }));
              cardStore.clearAllCards();
            }
            break;
          }

          case 'list.reordered': {
            const { boardId } = event.payload as any;
            if (boardId === get().currentBoard?.id) {
              // Recargar board para obtener orden actualizado
              get().fetchBoardById(boardId);
            }
            break;
          }

          // ========== BOARD EVENTS ==========
          case 'board.updated': {
            const { boardId, changes } = event.payload as any;
            if (boardId && changes) {
              set((state) => ({
                currentBoard:
                  state.currentBoard?.id === boardId
                    ? { ...state.currentBoard, ...changes }
                    : state.currentBoard,
                boards: state.boards.map((b) => (b.id === boardId ? { ...b, ...changes } : b)),
              }));
            }
            break;
          }

          default:
        }
      },

      // ==================== WEBSOCKET - SET ACTIVE USERS ====================
      setActiveUsers: (users: ActiveUser[]) => {
        set({ activeUsers: users });
      },

      // ==================== FETCH BOARDS ====================
      fetchBoards: async (workspaceId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.get<{ boards: Board[] }>(
            `/api/workspaces/${workspaceId}/boards`,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to fetch boards',
              isLoading: false,
            });
            return;
          }

          set({
            boards: response.data.boards,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: 'Error al cargar boards',
            isLoading: false,
          });
        }
      },

      // ==================== FETCH BOARD BY ID ====================
      fetchBoardById: async (boardId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.get<{ board: Board }>(`/api/boards/${boardId}`, true);

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to fetch board',
              isLoading: false,
            });
            return;
          }

          const board = response.data.board;

          set({
            currentBoard: board,
            lists: board.lists || [],
            isLoading: false,
          });

          // Cargar cards de cada lista en el cardStore
          const cardStore = useCardStore.getState();
          if (board.lists) {
            board.lists.forEach((list) => {
              if (list.cards) {
                cardStore.setCards(list.id, list.cards);
              }
            });
          }

          // Conectar socket y unirse al board
          get().connectSocket();
          get().joinBoard(boardId);
        } catch (error) {
          set({
            error: 'Error al cargar board',
            isLoading: false,
          });
        }
      },

      // ==================== CREATE BOARD ====================
      createBoard: async (workspaceId: string, data: CreateBoardData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.post<{ board: Board }>(
            `/api/workspaces/${workspaceId}/boards`,
            data,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to create board',
              isLoading: false,
            });
            throw new Error(response.error?.message);
          }

          set((state) => ({
            boards: [...state.boards, response.data!.board],
            isLoading: false,
          }));

          return response.data.board;
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ==================== UPDATE BOARD ====================
      updateBoard: async (boardId: string, data: UpdateBoardData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.put<{ board: Board }>(
            `/api/boards/${boardId}`,
            data,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to update board',
              isLoading: false,
            });
            return;
          }

          set((state) => ({
            boards: state.boards.map((b) => (b.id === boardId ? response.data!.board : b)),
            currentBoard:
              state.currentBoard?.id === boardId
                ? { ...state.currentBoard, ...response.data!.board }
                : state.currentBoard,
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al actualizar board',
            isLoading: false,
          });
        }
      },

      // ==================== ARCHIVE BOARD ====================
      archiveBoard: async (boardId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.post(`/api/boards/${boardId}/archive`, {}, true);

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to archive board',
              isLoading: false,
            });
            return;
          }

          set((state) => ({
            boards: state.boards.filter((b) => b.id !== boardId),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al archivar board',
            isLoading: false,
          });
        }
      },

      // ==================== DELETE BOARD ====================
      deleteBoard: async (boardId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.delete(`/api/boards/${boardId}`, true);

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to delete board',
              isLoading: false,
            });
            return;
          }

          set((state) => ({
            boards: state.boards.filter((b) => b.id !== boardId),
            currentBoard: state.currentBoard?.id === boardId ? null : state.currentBoard,
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al eliminar board',
            isLoading: false,
          });
        }
      },

      // ==================== CREATE LIST ====================
      createList: async (boardId: string, name: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.post<{ list: List }>(
            `/api/boards/${boardId}/lists`,
            { name },
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to create list',
              isLoading: false,
            });
            return;
          }

          set((state) => ({
            lists: [...state.lists, response.data!.list],
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al crear lista',
            isLoading: false,
          });
        }
      },

      // ==================== UPDATE LIST ====================
      updateList: async (listId: string, name: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.put<{ list: List }>(
            `/api/lists/${listId}`,
            { name },
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to update list',
              isLoading: false,
            });
            return;
          }

          set((state) => ({
            lists: state.lists.map((l) => (l.id === listId ? response.data!.list : l)),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al actualizar lista',
            isLoading: false,
          });
        }
      },

      // ==================== REORDER LIST ====================
      reorderList: async (listId: string, newPosition: number) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.put(
            `/api/lists/${listId}/reorder`,
            { position: newPosition },
            true
          );

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to reorder list',
              isLoading: false,
            });
            return;
          }

          const currentBoard = get().currentBoard;
          if (currentBoard) {
            await get().fetchBoardById(currentBoard.id);
          }

          set({ isLoading: false });
        } catch (error) {
          set({
            error: 'Error al reordenar lista',
            isLoading: false,
          });
        }
      },

      // ==================== DELETE LIST ====================
      deleteList: async (listId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.delete(`/api/lists/${listId}`, true);

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to delete list',
              isLoading: false,
            });
            return;
          }

          set((state) => ({
            lists: state.lists.filter((l) => l.id !== listId),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al eliminar lista',
            isLoading: false,
          });
        }
      },

      // ==================== SELECT BOARD ====================
      selectBoard: (board: Board | null) => {
        const currentBoard = get().currentBoard;

        // Salir del board anterior
        if (currentBoard && currentBoard.id !== board?.id) {
          get().leaveBoard(currentBoard.id);
        }

        set({ currentBoard: board, lists: board?.lists || [] });

        // Unirse al nuevo board
        if (board) {
          get().joinBoard(board.id);
        }
      },

      // ==================== CLEAR ERROR ====================
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'aether-board-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        boards: state.boards,
        currentBoard: state.currentBoard,
        lists: state.lists,
      }),
    }
  )
);
