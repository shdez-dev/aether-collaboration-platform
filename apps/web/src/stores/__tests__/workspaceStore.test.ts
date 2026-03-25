// apps/web/src/stores/__tests__/workspaceStore.test.ts

import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkspaceStore } from '../workspaceStore';
import { apiService } from '@/services/apiService';

// Mock apiService
jest.mock('@/services/apiService');

describe('WorkspaceStore', () => {
  const mockApiService = apiService as jest.Mocked<typeof apiService>;

  const mockWorkspace = {
    id: 'ws-1',
    name: 'Test Workspace',
    description: 'Test description',
    ownerId: 'user-1',
    icon: '🚀',
    color: '#3b82f6',
    archived: false,
    archivedAt: null,
    visibility: 'private' as const,
    inviteToken: 'token-123',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userRole: 'OWNER',
    boardCount: 5,
    memberCount: 3,
  };

  const mockMember = {
    id: 'member-1',
    workspaceId: 'ws-1',
    userId: 'user-2',
    role: 'MEMBER' as const,
    joinedAt: '2024-01-01T00:00:00Z',
    user: {
      id: 'user-2',
      name: 'Test User',
      email: 'test@example.com',
      avatar: 'avatar.jpg',
    },
  };

  const mockStats = {
    totalCards: 100,
    completedCards: 50,
    overdueCards: 10,
    unassignedCards: 5,
    completedThisWeek: 15,
    completedLastWeek: 12,
    boardProgress: [{ boardId: 'board-1', name: 'Board 1', total: 50, completed: 25 }],
    priorityBreakdown: [
      { priority: 'high', count: 20 },
      { priority: 'medium', count: 50 },
      { priority: 'low', count: 30 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    const { result } = renderHook(() => useWorkspaceStore());
    act(() => {
      result.current.workspaces = [];
      result.current.currentWorkspace = null;
      result.current.currentMembers = [];
      result.current.currentStats = null;
      result.current.isLoading = false;
      result.current.error = null;
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useWorkspaceStore());

      expect(result.current.workspaces).toEqual([]);
      expect(result.current.currentWorkspace).toBeNull();
      expect(result.current.currentMembers).toEqual([]);
      expect(result.current.currentStats).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('fetchWorkspaces', () => {
    it('should fetch workspaces successfully', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: { workspaces: [mockWorkspace] },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      await waitFor(() => {
        expect(result.current.workspaces).toEqual([mockWorkspace]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('should fetch archived workspaces when includeArchived is true', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: { workspaces: [{ ...mockWorkspace, archived: true }] },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await act(async () => {
        await result.current.fetchWorkspaces(true);
      });

      await waitFor(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('/api/workspaces?archived=true', true);
      });
    });

    it('should handle fetch workspaces error', async () => {
      mockApiService.get.mockResolvedValue({
        success: false,
        error: { code: 'FETCH_ERROR', message: 'Failed to fetch' },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await act(async () => {
        await result.current.fetchWorkspaces();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch');
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('fetchWorkspaceById', () => {
    it('should fetch workspace by id successfully', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: { workspace: mockWorkspace },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await act(async () => {
        await result.current.fetchWorkspaceById('ws-1');
      });

      await waitFor(() => {
        expect(result.current.currentWorkspace).toEqual(mockWorkspace);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle fetch workspace by id error', async () => {
      mockApiService.get.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workspace not found' },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await act(async () => {
        await result.current.fetchWorkspaceById('ws-999');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Workspace not found');
      });
    });
  });

  describe('createWorkspace', () => {
    it('should create workspace successfully', async () => {
      mockApiService.post.mockResolvedValue({
        success: true,
        data: { workspace: mockWorkspace },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      let createdWorkspace: unknown;
      await act(async () => {
        createdWorkspace = await result.current.createWorkspace({
          name: 'Test Workspace',
          description: 'Test description',
          icon: '🚀',
          color: '#3b82f6',
        });
      });

      await waitFor(() => {
        expect(createdWorkspace).toEqual(mockWorkspace);
        expect(result.current.workspaces).toContainEqual(mockWorkspace);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should throw error when create workspace fails', async () => {
      mockApiService.post.mockResolvedValue({
        success: false,
        error: { code: 'CREATE_ERROR', message: 'Failed to create workspace' },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await expect(
        act(async () => {
          await result.current.createWorkspace({ name: 'Test' });
        })
      ).rejects.toThrow('Failed to create workspace');
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace successfully', async () => {
      const updatedWorkspace = { ...mockWorkspace, name: 'Updated Name' };
      mockApiService.put.mockResolvedValue({
        success: true,
        data: { workspace: updatedWorkspace },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      // Set initial workspace
      act(() => {
        result.current.workspaces = [mockWorkspace];
        result.current.currentWorkspace = mockWorkspace;
      });

      await act(async () => {
        await result.current.updateWorkspace('ws-1', { name: 'Updated Name' });
      });

      await waitFor(() => {
        expect(result.current.workspaces[0].name).toBe('Updated Name');
        expect(result.current.currentWorkspace?.name).toBe('Updated Name');
      });
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace successfully', async () => {
      mockApiService.delete.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useWorkspaceStore());

      // Set initial workspace
      act(() => {
        result.current.workspaces = [mockWorkspace];
        result.current.currentWorkspace = mockWorkspace;
      });

      await act(async () => {
        await result.current.deleteWorkspace('ws-1');
      });

      await waitFor(() => {
        expect(result.current.workspaces).toEqual([]);
        expect(result.current.currentWorkspace).toBeNull();
      });
    });
  });

  describe('selectWorkspace', () => {
    it('should select a workspace', () => {
      const { result } = renderHook(() => useWorkspaceStore());

      act(() => {
        result.current.selectWorkspace(mockWorkspace);
      });

      expect(result.current.currentWorkspace).toEqual(mockWorkspace);
    });

    it('should clear selected workspace', () => {
      const { result } = renderHook(() => useWorkspaceStore());

      act(() => {
        result.current.selectWorkspace(mockWorkspace);
        result.current.selectWorkspace(null);
      });

      expect(result.current.currentWorkspace).toBeNull();
    });
  });

  describe('Members', () => {
    describe('fetchMembers', () => {
      it('should fetch members successfully', async () => {
        mockApiService.get.mockResolvedValue({
          success: true,
          data: { members: [mockMember] },
        });

        const { result } = renderHook(() => useWorkspaceStore());

        await act(async () => {
          await result.current.fetchMembers('ws-1');
        });

        await waitFor(() => {
          expect(result.current.currentMembers).toEqual([mockMember]);
        });
      });
    });

    describe('inviteMember', () => {
      it('should invite member successfully', async () => {
        mockApiService.post.mockResolvedValue({
          success: true,
        });
        mockApiService.get.mockResolvedValue({
          success: true,
          data: { members: [mockMember] },
        });

        const { result } = renderHook(() => useWorkspaceStore());

        await act(async () => {
          await result.current.inviteMember('ws-1', 'test@example.com', 'MEMBER');
        });

        await waitFor(() => {
          expect(mockApiService.post).toHaveBeenCalledWith(
            '/api/workspaces/ws-1/invite',
            { email: 'test@example.com', role: 'MEMBER' },
            true
          );
          expect(result.current.currentMembers).toEqual([mockMember]);
        });
      });

      it('should throw error when invite fails', async () => {
        mockApiService.post.mockResolvedValue({
          success: false,
          error: { code: 'INVITE_ERROR', message: 'Failed to invite' },
        });

        const { result } = renderHook(() => useWorkspaceStore());

        await expect(
          act(async () => {
            await result.current.inviteMember('ws-1', 'test@example.com', 'MEMBER');
          })
        ).rejects.toThrow('Failed to invite');
      });
    });

    describe('changeMemberRole', () => {
      it('should change member role successfully', async () => {
        mockApiService.put.mockResolvedValue({
          success: true,
        });

        const { result } = renderHook(() => useWorkspaceStore());

        act(() => {
          result.current.currentMembers = [mockMember];
        });

        await act(async () => {
          await result.current.changeMemberRole('ws-1', 'user-2', 'ADMIN');
        });

        await waitFor(() => {
          expect(result.current.currentMembers[0].role).toBe('ADMIN');
        });
      });
    });

    describe('removeMember', () => {
      it('should remove member successfully', async () => {
        mockApiService.delete.mockResolvedValue({
          success: true,
        });

        const { result } = renderHook(() => useWorkspaceStore());

        act(() => {
          result.current.currentMembers = [mockMember];
        });

        await act(async () => {
          await result.current.removeMember('ws-1', 'user-2');
        });

        await waitFor(() => {
          expect(result.current.currentMembers).toEqual([]);
        });
      });
    });
  });

  describe('Archive and Restore', () => {
    describe('archiveWorkspace', () => {
      it('should archive workspace successfully', async () => {
        const archivedWorkspace = { ...mockWorkspace, archived: true };
        mockApiService.post.mockResolvedValue({
          success: true,
          data: { workspace: archivedWorkspace },
        });

        const { result } = renderHook(() => useWorkspaceStore());

        act(() => {
          result.current.workspaces = [mockWorkspace];
          result.current.currentWorkspace = mockWorkspace;
        });

        await act(async () => {
          await result.current.archiveWorkspace('ws-1');
        });

        await waitFor(() => {
          expect(result.current.workspaces[0].archived).toBe(true);
          expect(result.current.currentWorkspace?.archived).toBe(true);
        });
      });
    });

    describe('restoreWorkspace', () => {
      it('should restore workspace successfully', async () => {
        const restoredWorkspace = { ...mockWorkspace, archived: false };
        mockApiService.post.mockResolvedValue({
          success: true,
          data: { workspace: restoredWorkspace },
        });

        const { result } = renderHook(() => useWorkspaceStore());

        act(() => {
          result.current.workspaces = [{ ...mockWorkspace, archived: true }];
        });

        await act(async () => {
          await result.current.restoreWorkspace('ws-1');
        });

        await waitFor(() => {
          expect(result.current.workspaces[0].archived).toBe(false);
        });
      });
    });
  });

  describe('duplicateWorkspace', () => {
    it('should duplicate workspace successfully', async () => {
      const duplicatedWorkspace = { ...mockWorkspace, id: 'ws-2', name: 'Test Workspace (Copy)' };
      mockApiService.post.mockResolvedValue({
        success: true,
        data: { workspace: duplicatedWorkspace },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      act(() => {
        result.current.workspaces = [mockWorkspace];
      });

      let newWorkspace: unknown;
      await act(async () => {
        newWorkspace = await result.current.duplicateWorkspace('ws-1', true);
      });

      await waitFor(() => {
        expect(newWorkspace).toEqual(duplicatedWorkspace);
        expect(result.current.workspaces).toHaveLength(2);
        expect(result.current.workspaces[0]).toEqual(duplicatedWorkspace);
      });
    });

    it('should throw error when duplicate fails', async () => {
      mockApiService.post.mockResolvedValue({
        success: false,
        error: { code: 'DUPLICATE_ERROR', message: 'Failed to duplicate' },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await expect(
        act(async () => {
          await result.current.duplicateWorkspace('ws-1');
        })
      ).rejects.toThrow('Failed to duplicate');
    });
  });

  describe('updateVisibility', () => {
    it('should update visibility successfully', async () => {
      const updatedWorkspace = { ...mockWorkspace, visibility: 'public' as const };
      mockApiService.put.mockResolvedValue({
        success: true,
        data: { workspace: updatedWorkspace },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      act(() => {
        result.current.workspaces = [mockWorkspace];
        result.current.currentWorkspace = mockWorkspace;
      });

      await act(async () => {
        await result.current.updateVisibility('ws-1', 'public');
      });

      await waitFor(() => {
        expect(result.current.workspaces[0].visibility).toBe('public');
        expect(result.current.currentWorkspace?.visibility).toBe('public');
      });
    });
  });

  describe('Invite Token', () => {
    describe('regenerateInviteToken', () => {
      it('should regenerate invite token successfully', async () => {
        mockApiService.post.mockResolvedValue({
          success: true,
          data: { token: 'new-token-456' },
        });

        const { result } = renderHook(() => useWorkspaceStore());

        act(() => {
          result.current.workspaces = [mockWorkspace];
          result.current.currentWorkspace = mockWorkspace;
        });

        let newToken: unknown;
        await act(async () => {
          newToken = await result.current.regenerateInviteToken('ws-1');
        });

        await waitFor(() => {
          expect(newToken).toBe('new-token-456');
          expect(result.current.workspaces[0].inviteToken).toBe('new-token-456');
          expect(result.current.currentWorkspace?.inviteToken).toBe('new-token-456');
        });
      });

      it('should throw error when regenerate fails', async () => {
        mockApiService.post.mockResolvedValue({
          success: false,
          error: { code: 'REGEN_ERROR', message: 'Failed to generate token' },
        });

        const { result } = renderHook(() => useWorkspaceStore());

        await expect(
          act(async () => {
            await result.current.regenerateInviteToken('ws-1');
          })
        ).rejects.toThrow('Failed to generate token');
      });
    });

    describe('revokeInviteToken', () => {
      it('should revoke invite token successfully', async () => {
        mockApiService.delete.mockResolvedValue({
          success: true,
        });

        const { result } = renderHook(() => useWorkspaceStore());

        act(() => {
          result.current.workspaces = [mockWorkspace];
          result.current.currentWorkspace = mockWorkspace;
        });

        await act(async () => {
          await result.current.revokeInviteToken('ws-1');
        });

        await waitFor(() => {
          expect(result.current.workspaces[0].inviteToken).toBeNull();
          expect(result.current.currentWorkspace?.inviteToken).toBeNull();
        });
      });
    });
  });

  describe('fetchStats', () => {
    it('should fetch stats successfully', async () => {
      mockApiService.get.mockResolvedValue({
        success: true,
        data: { stats: mockStats },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await act(async () => {
        await result.current.fetchStats('ws-1');
      });

      await waitFor(() => {
        expect(result.current.currentStats).toEqual(mockStats);
      });
    });

    it('should handle fetch stats error gracefully', async () => {
      mockApiService.get.mockResolvedValue({
        success: false,
        error: { code: 'STATS_ERROR', message: 'Failed to fetch stats' },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await act(async () => {
        await result.current.fetchStats('ws-1');
      });

      // Store silently ignores stats fetch errors; currentStats remains unchanged
      expect(result.current.currentStats).toBeNull();
    });
  });

  describe('createFromTemplate', () => {
    it('should create workspace from template successfully', async () => {
      mockApiService.post.mockResolvedValue({
        success: true,
        data: { workspace: mockWorkspace },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      let createdWorkspace: unknown;
      await act(async () => {
        createdWorkspace = await result.current.createFromTemplate('template-1', 'New Workspace');
      });

      await waitFor(() => {
        expect(createdWorkspace).toEqual(mockWorkspace);
        expect(result.current.workspaces).toContainEqual(mockWorkspace);
        expect(mockApiService.post).toHaveBeenCalledWith(
          '/api/workspaces/from-template',
          { templateId: 'template-1', name: 'New Workspace' },
          true
        );
      });
    });

    it('should throw error when create from template fails', async () => {
      mockApiService.post.mockResolvedValue({
        success: false,
        error: { code: 'TEMPLATE_ERROR', message: 'Template not found' },
      });

      const { result } = renderHook(() => useWorkspaceStore());

      await expect(
        act(async () => {
          await result.current.createFromTemplate('template-999', 'New Workspace');
        })
      ).rejects.toThrow('Template not found');
    });
  });

  describe('clearError', () => {
    it('should clear error message', () => {
      const { result } = renderHook(() => useWorkspaceStore());

      act(() => {
        result.current.error = 'Some error';
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});
