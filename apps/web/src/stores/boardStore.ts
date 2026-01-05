// apps/web/src/stores/boardStore.ts

import { create } from 'zustand';

// ==================== TYPES ====================

interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  position: number;
  archived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  listCount?: number;
  cardCount?: number;
  lists?: List[];
}

interface List {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cardCount?: number;
  cards?: Card[];
}

interface Card {
  id: string;
  listId: string;
  title: string;
  description?: string;
  position: number;
  dueDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
}

interface BoardState {
  // Estado
  boards: Board[];
  currentBoard: Board | null;
  lists: List[];
  isLoading: boolean;
  error: string | null;

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

// ==================== API CONFIG ====================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ==================== HELPERS ====================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: any }> {
  try {
    const authData = localStorage.getItem('aether-auth-storage');
    let token = null;

    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        token = parsed.state?.accessToken || parsed.accessToken;
      } catch (e) {
        console.error('Error parsing auth data:', e);
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API Error:', data);
      return { success: false, error: data.error };
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Error de conexión con el servidor' },
    };
  }
}

// ==================== STORE ====================

export const useBoardStore = create<BoardState>((set, get) => ({
  // Estado inicial
  boards: [],
  currentBoard: null,
  lists: [],
  isLoading: false,
  error: null,

  // ==================== FETCH BOARDS ====================
  fetchBoards: async (workspaceId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiRequest<{ boards: Board[] }>(
        `/api/workspaces/${workspaceId}/boards`
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
      const response = await apiRequest<{ board: Board }>(`/api/boards/${boardId}`);

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
      const response = await apiRequest<{ board: Board }>(`/api/workspaces/${workspaceId}/boards`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.success || !response.data) {
        set({
          error: response.error?.message || 'Failed to create board',
          isLoading: false,
        });
        throw new Error(response.error?.message);
      }

      // Agregar a la lista local
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
      const response = await apiRequest<{ board: Board }>(`/api/boards/${boardId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      if (!response.success || !response.data) {
        set({
          error: response.error?.message || 'Failed to update board',
          isLoading: false,
        });
        return;
      }

      // Actualizar en la lista local
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
      const response = await apiRequest(`/api/boards/${boardId}/archive`, {
        method: 'POST',
      });

      if (!response.success) {
        set({
          error: response.error?.message || 'Failed to archive board',
          isLoading: false,
        });
        return;
      }

      // Remover de la lista (boards archivados no se muestran)
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
      const response = await apiRequest(`/api/boards/${boardId}`, {
        method: 'DELETE',
      });

      if (!response.success) {
        set({
          error: response.error?.message || 'Failed to delete board',
          isLoading: false,
        });
        return;
      }

      // Remover de la lista local
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
      const response = await apiRequest<{ list: List }>(`/api/boards/${boardId}/lists`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });

      if (!response.success || !response.data) {
        set({
          error: response.error?.message || 'Failed to create list',
          isLoading: false,
        });
        return;
      }

      // Agregar a las listas locales
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
      const response = await apiRequest<{ list: List }>(`/api/lists/${listId}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });

      if (!response.success || !response.data) {
        set({
          error: response.error?.message || 'Failed to update list',
          isLoading: false,
        });
        return;
      }

      // Actualizar en la lista local
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
      const response = await apiRequest(`/api/lists/${listId}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ position: newPosition }),
      });

      if (!response.success) {
        set({
          error: response.error?.message || 'Failed to reorder list',
          isLoading: false,
        });
        return;
      }

      // Recargar el board completo para obtener el orden actualizado
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
      const response = await apiRequest(`/api/lists/${listId}`, {
        method: 'DELETE',
      });

      if (!response.success) {
        set({
          error: response.error?.message || 'Failed to delete list',
          isLoading: false,
        });
        return;
      }

      // Remover de la lista local
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
    set({ currentBoard: board, lists: board?.lists || [] });
  },

  // ==================== CLEAR ERROR ====================
  clearError: () => {
    set({ error: null });
  },
}));
