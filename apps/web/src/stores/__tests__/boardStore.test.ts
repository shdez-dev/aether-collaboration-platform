// apps/web/src/stores/__tests__/boardStore.test.ts

import { act, renderHook, waitFor } from '@testing-library/react';
import { useBoardStore } from '../boardStore';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import type { Board } from '@aether/types';

jest.mock('@/services/apiService');
jest.mock('@/services/socketService');
jest.mock('../cardStore');
jest.mock('../authStore');

describe('BoardStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store
    useBoardStore.setState({
      boards: [],
      currentBoard: null,
      lists: [],
      isLoading: false,
      error: null,
      isSocketConnected: false,
      activeUsers: [],
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useBoardStore());

      expect(result.current.boards).toEqual([]);
      expect(result.current.currentBoard).toBeNull();
      expect(result.current.lists).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isSocketConnected).toBe(false);
      expect(result.current.activeUsers).toEqual([]);
    });
  });

  describe('fetchBoards', () => {
    it('should fetch boards successfully', async () => {
      const mockBoards = [
        {
          id: 'board-1',
          workspaceId: 'ws-1',
          name: 'Board 1',
          position: 1,
          archived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'board-2',
          workspaceId: 'ws-1',
          name: 'Board 2',
          position: 2,
          archived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { boards: mockBoards },
      });

      const { result } = renderHook(() => useBoardStore());

      await act(async () => {
        await result.current.fetchBoards('ws-1');
      });

      await waitFor(() => {
        expect(result.current.boards).toEqual(mockBoards);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle error when fetching boards', async () => {
      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { message: 'Failed to fetch boards' },
      });

      const { result } = renderHook(() => useBoardStore());

      await act(async () => {
        await result.current.fetchBoards('ws-1');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch boards');
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('createBoard', () => {
    it('should create a board successfully', async () => {
      const mockBoard = {
        id: 'board-new',
        workspaceId: 'ws-1',
        name: 'New Board',
        description: 'Test description',
        position: 1,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { board: mockBoard },
      });

      const { result } = renderHook(() => useBoardStore());

      let createdBoard: Board | undefined;
      await act(async () => {
        createdBoard = await result.current.createBoard('ws-1', {
          name: 'New Board',
          description: 'Test description',
        });
      });

      await waitFor(() => {
        expect(createdBoard).toEqual(mockBoard);
        expect(result.current.boards).toContainEqual(mockBoard);
      });
    });
  });

  describe('fetchBoardById', () => {
    it('should fetch board with lists and cards', async () => {
      const mockBoard = {
        id: 'board-1',
        workspaceId: 'ws-1',
        name: 'Test Board',
        position: 1,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lists: [
          {
            id: 'list-1',
            boardId: 'board-1',
            name: 'To Do',
            position: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            cards: [],
          },
        ],
      };

      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { board: mockBoard },
      });

      const { result } = renderHook(() => useBoardStore());

      await act(async () => {
        await result.current.fetchBoardById('board-1');
      });

      await waitFor(() => {
        expect(result.current.currentBoard).toEqual(mockBoard);
        expect(result.current.lists).toEqual(mockBoard.lists);
      });
    });
  });

  describe('updateBoard', () => {
    it('should update board name and description', async () => {
      const initialBoard = {
        id: 'board-1',
        workspaceId: 'ws-1',
        name: 'Old Name',
        description: 'Old Description',
        position: 1,
        archived: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const updatedBoard = {
        ...initialBoard,
        name: 'New Name',
        description: 'New Description',
      };

      useBoardStore.setState({
        currentBoard: initialBoard,
        boards: [initialBoard],
      });

      (apiService.put as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: { board: updatedBoard },
      });

      const { result } = renderHook(() => useBoardStore());

      await act(async () => {
        await result.current.updateBoard('board-1', {
          name: 'New Name',
          description: 'New Description',
        });
      });

      await waitFor(() => {
        expect(result.current.currentBoard?.name).toBe('New Name');
        expect(result.current.currentBoard?.description).toBe('New Description');
      });
    });
  });

  describe('selectBoard', () => {
    it('should select a board', () => {
      const mockBoard = {
        id: 'board-1',
        workspaceId: 'ws-1',
        name: 'Test Board',
        position: 1,
        archived: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { result } = renderHook(() => useBoardStore());

      act(() => {
        result.current.selectBoard(mockBoard);
      });

      expect(result.current.currentBoard).toEqual(mockBoard);
    });

    it('should clear selected board', () => {
      const mockBoard = {
        id: 'board-1',
        workspaceId: 'ws-1',
        name: 'Test Board',
        position: 1,
        archived: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { result } = renderHook(() => useBoardStore());

      act(() => {
        result.current.selectBoard(mockBoard);
      });

      expect(result.current.currentBoard).toEqual(mockBoard);

      act(() => {
        result.current.selectBoard(null);
      });

      expect(result.current.currentBoard).toBeNull();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => useBoardStore());

      act(() => {
        useBoardStore.setState({ error: 'Some error' });
      });

      expect(result.current.error).toBe('Some error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
