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
  reset: () => void;
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

// Module-level flag: prevents registering duplicate socket event handlers
// when connectSocket() is called multiple times (e.g. React StrictMode double-invocation)
let _socketHandlersRegistered = false;

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
          return;
        }

        // Prevent duplicate event handler registration
        if (_socketHandlersRegistered) {
          // Still ensure the socket is connected/connecting
          if (!socketService.isConnected()) {
            socketService.connect(accessToken);
          }
          return;
        }

        _socketHandlersRegistered = true;
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
        _socketHandlersRegistered = false;
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
            const payload = event.payload as any;
            // Payload is flat: { cardId, listId, title, description, position, createdBy, boardId, workspaceId }
            const cardData = payload.card ?? {
              id: payload.cardId,
              listId: payload.listId,
              title: payload.title,
              description: payload.description,
              position: payload.position,
              priority: payload.priority ?? null,
              dueDate: payload.dueDate ?? null,
              startDate: payload.startDate ?? null,
              completed: payload.completed ?? false,
              members: payload.members ?? [],
              labels: payload.labels ?? [],
              createdAt: payload.createdAt ?? new Date().toISOString(),
              updatedAt: payload.updatedAt ?? new Date().toISOString(),
            };
            if (cardData.listId) {
              cardStore.addCard(cardData.listId, cardData);
            }
            break;
          }

          case 'card.updated': {
            const { cardId, changes } = event.payload as any;
            if (cardId && changes) {
              cardStore.updateCard(cardId, changes);

              // Si cambió el estado de completado y esta card bloquea a otras,
              // refrescar el board para actualizar los contadores
              if ('completed' in changes) {
                const currentBoard = get().currentBoard;
                if (currentBoard) {
                  // Refrescar el board para actualizar los contadores de dependencias
                  get().fetchBoardById(currentBoard.id);
                }
              }
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

          // ========== DEPENDENCY EVENTS ==========
          case 'card.dependency.added': {
            const { blockedCardId, blockingCardId } = event.payload as any;
            if (blockedCardId) {
              // Buscar la card bloqueada en todas las listas
              const allCards = cardStore.cards;
              for (const listId in allCards) {
                const card = allCards[listId].find((c) => c.id === blockedCardId);
                if (card) {
                  // Incrementar el contador de dependencias bloqueantes
                  const newCount = (card.blockedByPendingCount ?? 0) + 1;
                  cardStore.updateCard(blockedCardId, { blockedByPendingCount: newCount });
                  break;
                }
              }
            }
            if (blockingCardId) {
              // Buscar la card bloqueante en todas las listas
              const allCards = cardStore.cards;
              for (const listId in allCards) {
                const card = allCards[listId].find((c) => c.id === blockingCardId);
                if (card) {
                  // Incrementar el contador de cards que está bloqueando
                  const newCount = (card.blockingCount ?? 0) + 1;
                  cardStore.updateCard(blockingCardId, { blockingCount: newCount });
                  break;
                }
              }
            }
            break;
          }

          case 'card.dependency.removed': {
            const { blockedCardId, blockingCardId } = event.payload as any;

            // Cuando se elimina una dependencia, necesitamos recalcular si la card bloqueante
            // está completa o no para decrementar correctamente el contador
            if (blockedCardId && blockingCardId) {
              const allCards = cardStore.cards;

              // Buscar la card bloqueante para ver si está completada
              let blockingCard = null;
              for (const listId in allCards) {
                const found = allCards[listId].find((c) => c.id === blockingCardId);
                if (found) {
                  blockingCard = found;
                  break;
                }
              }

              // Buscar la card bloqueada para actualizar su contador
              for (const listId in allCards) {
                const card = allCards[listId].find((c) => c.id === blockedCardId);
                if (card) {
                  // Solo decrementar si la card bloqueante no estaba completada
                  // (porque solo las incompletas cuentan para blockedByPendingCount)
                  if (blockingCard && !blockingCard.completed) {
                    const newCount = Math.max(0, (card.blockedByPendingCount ?? 0) - 1);
                    cardStore.updateCard(blockedCardId, { blockedByPendingCount: newCount });
                  }
                  break;
                }
              }

              // Actualizar contador de blocking en la card bloqueante
              if (blockingCard) {
                const newCount = Math.max(0, (blockingCard.blockingCount ?? 0) - 1);
                cardStore.updateCard(blockingCardId, { blockingCount: newCount });
              }
            }
            break;
          }

          // ========== LIST EVENTS ==========
          case 'list.created': {
            const payload = event.payload as any;
            // Payload is flat: { listId, boardId, name, position, createdBy, workspaceId }
            const listData = payload.list ?? {
              id: payload.listId,
              boardId: payload.boardId,
              name: payload.name,
              position: payload.position,
              createdAt: payload.createdAt ?? new Date().toISOString(),
              updatedAt: payload.updatedAt ?? new Date().toISOString(),
              cards: [],
            };
            if (listData.id) {
              const already = get().lists.some((l) => l.id === listData.id);
              if (!already) {
                set((state) => ({
                  lists: [...state.lists, listData],
                }));
              }
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
          case 'board.created': {
            const { boardId, name, description, createdBy, position, workspaceId } = event.payload as any;
            if (boardId) {
              // Solo agregar si no existe ya (evitar duplicado del creador)
              const already = get().boards.some((b) => b.id === boardId);
              if (!already) {
                set((state) => ({
                  boards: [
                    ...state.boards,
                    {
                      id: boardId,
                      workspaceId,
                      name,
                      description: description || null,
                      archived: false,
                      position: position ?? 0,
                      createdBy,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    } as any,
                  ],
                }));
              }
            }
            break;
          }

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

          case 'board.archived': {
            const { boardId } = event.payload as any;
            if (boardId) {
              set((state) => ({
                boards: state.boards.map((b) =>
                  b.id === boardId ? { ...b, archived: true } : b
                ),
                currentBoard:
                  state.currentBoard?.id === boardId
                    ? ({ ...state.currentBoard, archived: true } as Board)
                    : state.currentBoard,
              }));
            }
            break;
          }

          case 'board.deleted': {
            const { boardId } = event.payload as any;
            if (boardId) {
              set((state) => ({
                boards: state.boards.filter((b) => b.id !== boardId),
                currentBoard:
                  state.currentBoard?.id === boardId ? null : state.currentBoard,
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

          set((state) => {
            const alreadyAdded = state.boards.some((b) => b.id === response.data!.board.id);
            return {
              boards: alreadyAdded ? state.boards : [...state.boards, response.data!.board],
              isLoading: false,
            };
          });

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

      reset: () => {
        set({
          boards: [],
          currentBoard: null,
          lists: [],
          isLoading: false,
          error: null,
          isSocketConnected: false,
          activeUsers: [],
        });
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
