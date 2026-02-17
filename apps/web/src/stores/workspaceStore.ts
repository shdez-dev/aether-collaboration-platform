// apps/web/src/stores/workspaceStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiService } from '@/services/apiService';

// ==================== TYPES ====================

interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  icon?: string;
  color?: string;
  archived?: boolean;
  archivedAt?: string | null;
  visibility?: 'private' | 'public';
  inviteToken?: string | null;
  createdAt: string;
  updatedAt: string;
  userRole?: string;
  boardCount?: number;
  memberCount?: number;
}

interface WorkspaceStats {
  // Progreso global
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  unassignedCards: number;
  // Velocidad
  completedThisWeek: number;
  completedLastWeek: number;
  // Progreso por board
  boardProgress: { boardId: string; name: string; total: number; completed: number }[];
  // Distribución por prioridad
  priorityBreakdown: { priority: string; count: number }[];
}

interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface WorkspaceState {
  // Estado
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentMembers: WorkspaceMember[];
  currentStats: WorkspaceStats | null;
  isLoading: boolean;
  error: string | null;

  // Acciones
  fetchWorkspaces: (includeArchived?: boolean) => Promise<void>;
  fetchWorkspaceById: (id: string) => Promise<void>;
  createWorkspace: (data: CreateWorkspaceData) => Promise<Workspace>;
  updateWorkspace: (id: string, data: UpdateWorkspaceData) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  archiveWorkspace: (id: string) => Promise<void>;
  restoreWorkspace: (id: string) => Promise<void>;
  duplicateWorkspace: (id: string, includeBoards?: boolean) => Promise<Workspace>;
  updateVisibility: (id: string, visibility: 'private' | 'public') => Promise<void>;
  regenerateInviteToken: (id: string) => Promise<string>;
  revokeInviteToken: (id: string) => Promise<void>;
  fetchStats: (id: string) => Promise<void>;
  createFromTemplate: (templateId: string, name: string) => Promise<Workspace>;
  selectWorkspace: (workspace: Workspace | null) => void;

  // Miembros
  fetchMembers: (workspaceId: string) => Promise<void>;
  inviteMember: (workspaceId: string, email: string, role: string) => Promise<void>;
  changeMemberRole: (workspaceId: string, userId: string, role: string) => Promise<void>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;

  // Helpers
  clearError: () => void;
}

interface CreateWorkspaceData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

interface UpdateWorkspaceData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

// ==================== STORE ====================

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      workspaces: [],
      currentWorkspace: null,
      currentMembers: [],
      currentStats: null,
      isLoading: false,
      error: null,

      // ==================== FETCH WORKSPACES ====================
      fetchWorkspaces: async (includeArchived = false) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.get<{ workspaces: Workspace[] }>(
            `/api/workspaces${includeArchived ? '?archived=true' : ''}`,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to fetch workspaces',
              isLoading: false,
            });
            return;
          }

          set({
            workspaces: response.data.workspaces,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: 'Error al cargar workspaces',
            isLoading: false,
          });
        }
      },

      // ==================== FETCH WORKSPACE BY ID ====================
      fetchWorkspaceById: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.get<{ workspace: Workspace }>(
            `/api/workspaces/${id}`,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to fetch workspace',
              isLoading: false,
            });
            return;
          }

          set({
            currentWorkspace: response.data.workspace,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: 'Error al cargar workspace',
            isLoading: false,
          });
        }
      },

      // ==================== CREATE WORKSPACE ====================
      createWorkspace: async (data: CreateWorkspaceData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.post<{ workspace: Workspace }>(
            '/api/workspaces',
            data,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to create workspace',
              isLoading: false,
            });
            throw new Error(response.error?.message);
          }

          // Agregar a la lista local
          set((state) => ({
            workspaces: [response.data!.workspace, ...state.workspaces],
            isLoading: false,
          }));

          return response.data.workspace;
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ==================== UPDATE WORKSPACE ====================
      updateWorkspace: async (id: string, data: UpdateWorkspaceData) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.put<{ workspace: Workspace }>(
            `/api/workspaces/${id}`,
            data,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to update workspace',
              isLoading: false,
            });
            return;
          }

          // Actualizar en la lista local
          set((state) => ({
            workspaces: state.workspaces.map((w) => (w.id === id ? response.data!.workspace : w)),
            currentWorkspace:
              state.currentWorkspace?.id === id ? response.data!.workspace : state.currentWorkspace,
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al actualizar workspace',
            isLoading: false,
          });
        }
      },

      // ==================== DELETE WORKSPACE ====================
      deleteWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.delete(`/api/workspaces/${id}`, true);

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to delete workspace',
              isLoading: false,
            });
            return;
          }

          // Remover de la lista local
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== id),
            currentWorkspace: state.currentWorkspace?.id === id ? null : state.currentWorkspace,
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al eliminar workspace',
            isLoading: false,
          });
        }
      },

      // ==================== SELECT WORKSPACE ====================
      selectWorkspace: (workspace: Workspace | null) => {
        set({ currentWorkspace: workspace });
      },

      // ==================== FETCH MEMBERS ====================
      fetchMembers: async (workspaceId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.get<{ members: WorkspaceMember[] }>(
            `/api/workspaces/${workspaceId}/members`,
            true
          );

          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to fetch members',
              isLoading: false,
            });
            return;
          }

          set({
            currentMembers: response.data.members,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: 'Error al cargar miembros',
            isLoading: false,
          });
        }
      },

      // ==================== INVITE MEMBER ====================
      inviteMember: async (workspaceId: string, email: string, role: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.post(
            `/api/workspaces/${workspaceId}/invite`,
            { email, role },
            true
          );

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to invite member',
              isLoading: false,
            });
            throw new Error(response.error?.message);
          }

          // Recargar miembros
          await get().fetchMembers(workspaceId);

          set({ isLoading: false });
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ==================== CHANGE MEMBER ROLE ====================
      changeMemberRole: async (workspaceId: string, userId: string, role: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.put(
            `/api/workspaces/${workspaceId}/members/${userId}`,
            { role },
            true
          );

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to change role',
              isLoading: false,
            });
            return;
          }

          // Actualizar en la lista local
          set((state) => ({
            currentMembers: state.currentMembers.map((m) =>
              m.userId === userId ? { ...m, role: role as any } : m
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al cambiar rol',
            isLoading: false,
          });
        }
      },

      // ==================== REMOVE MEMBER ====================
      removeMember: async (workspaceId: string, userId: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiService.delete(
            `/api/workspaces/${workspaceId}/members/${userId}`,
            true
          );

          if (!response.success) {
            set({
              error: response.error?.message || 'Failed to remove member',
              isLoading: false,
            });
            return;
          }

          // Remover de la lista local
          set((state) => ({
            currentMembers: state.currentMembers.filter((m) => m.userId !== userId),
            isLoading: false,
          }));
        } catch (error) {
          set({
            error: 'Error al remover miembro',
            isLoading: false,
          });
        }
      },

      // ==================== ARCHIVE WORKSPACE ====================
      archiveWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.post<{ workspace: Workspace }>(
            `/api/workspaces/${id}/archive`,
            {},
            true
          );
          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to archive workspace',
              isLoading: false,
            });
            return;
          }
          set((state) => ({
            workspaces: state.workspaces.map((w) => (w.id === id ? response.data!.workspace : w)),
            currentWorkspace:
              state.currentWorkspace?.id === id ? response.data!.workspace : state.currentWorkspace,
            isLoading: false,
          }));
        } catch {
          set({ error: 'Error al archivar workspace', isLoading: false });
        }
      },

      // ==================== RESTORE WORKSPACE ====================
      restoreWorkspace: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.post<{ workspace: Workspace }>(
            `/api/workspaces/${id}/restore`,
            {},
            true
          );
          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to restore workspace',
              isLoading: false,
            });
            return;
          }
          set((state) => ({
            workspaces: state.workspaces.map((w) => (w.id === id ? response.data!.workspace : w)),
            currentWorkspace:
              state.currentWorkspace?.id === id ? response.data!.workspace : state.currentWorkspace,
            isLoading: false,
          }));
        } catch {
          set({ error: 'Error al restaurar workspace', isLoading: false });
        }
      },

      // ==================== DUPLICATE WORKSPACE ====================
      duplicateWorkspace: async (id: string, includeBoards = true) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.post<{ workspace: Workspace }>(
            `/api/workspaces/${id}/duplicate`,
            { includeBoards },
            true
          );
          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to duplicate workspace',
              isLoading: false,
            });
            throw new Error(response.error?.message);
          }
          set((state) => ({
            workspaces: [response.data!.workspace, ...state.workspaces],
            isLoading: false,
          }));
          return response.data.workspace;
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ==================== UPDATE VISIBILITY ====================
      updateVisibility: async (id: string, visibility: 'private' | 'public') => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.put<{ workspace: Workspace }>(
            `/api/workspaces/${id}/visibility`,
            { visibility },
            true
          );
          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to update visibility',
              isLoading: false,
            });
            return;
          }
          set((state) => ({
            workspaces: state.workspaces.map((w) => (w.id === id ? response.data!.workspace : w)),
            currentWorkspace:
              state.currentWorkspace?.id === id ? response.data!.workspace : state.currentWorkspace,
            isLoading: false,
          }));
        } catch {
          set({ error: 'Error al actualizar visibilidad', isLoading: false });
        }
      },

      // ==================== REGENERATE INVITE TOKEN ====================
      regenerateInviteToken: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.post<{ token: string }>(
            `/api/workspaces/${id}/invite-token`,
            {},
            true
          );
          if (!response.success || !response.data) {
            set({ error: response.error?.message || 'Failed to generate token', isLoading: false });
            throw new Error(response.error?.message);
          }
          // Update token in local state
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w.id === id ? { ...w, inviteToken: response.data!.token } : w
            ),
            currentWorkspace:
              state.currentWorkspace?.id === id
                ? { ...state.currentWorkspace, inviteToken: response.data!.token }
                : state.currentWorkspace,
            isLoading: false,
          }));
          return response.data.token;
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ==================== REVOKE INVITE TOKEN ====================
      revokeInviteToken: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.delete(`/api/workspaces/${id}/invite-token`, true);
          if (!response.success) {
            set({ error: response.error?.message || 'Failed to revoke token', isLoading: false });
            return;
          }
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w.id === id ? { ...w, inviteToken: null } : w
            ),
            currentWorkspace:
              state.currentWorkspace?.id === id
                ? { ...state.currentWorkspace, inviteToken: null }
                : state.currentWorkspace,
            isLoading: false,
          }));
        } catch {
          set({ error: 'Error al revocar token', isLoading: false });
        }
      },

      // ==================== FETCH STATS ====================
      fetchStats: async (id: string) => {
        try {
          const response = await apiService.get<{ stats: WorkspaceStats }>(
            `/api/workspaces/${id}/stats`,
            true
          );
          if (response.success && response.data) {
            set({ currentStats: response.data.stats });
          } else {
            console.warn('[fetchStats] Failed:', response.error?.message);
          }
        } catch (err) {
          console.warn('[fetchStats] Exception:', err);
        }
      },

      // ==================== CREATE FROM TEMPLATE ====================
      createFromTemplate: async (templateId: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiService.post<{ workspace: Workspace }>(
            '/api/workspaces/from-template',
            { templateId, name },
            true
          );
          if (!response.success || !response.data) {
            set({
              error: response.error?.message || 'Failed to create from template',
              isLoading: false,
            });
            throw new Error(response.error?.message);
          }
          set((state) => ({
            workspaces: [response.data!.workspace, ...state.workspaces],
            isLoading: false,
          }));
          return response.data.workspace;
        } catch (error: any) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ==================== CLEAR ERROR ====================
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'aether-workspace-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workspaces: state.workspaces,
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
);
