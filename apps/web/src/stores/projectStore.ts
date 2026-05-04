// apps/web/src/stores/projectStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiService } from '@/services/apiService';

// ==================== TYPES ====================

export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  date: string;
  status: 'PENDING' | 'REACHED' | 'MISSED';
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBoard {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  position: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats {
  totalBoards: number;
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  totalDocuments: number;
  progressPercent: number;
  healthScore: number;
  bottleneckBoardId?: string | null;
  bottleneckBoardName?: string | null;
}

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  progressPercent?: number;
  boards?: ProjectBoard[];
  milestones?: ProjectMilestone[];
  stats?: ProjectStats;
}

interface CreateProjectData {
  workspaceId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  boardIds?: string[];
}

interface UpdateProjectData {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
}

interface CreateMilestoneData {
  name: string;
  description?: string;
  date: string;
  color?: string;
}

interface UpdateMilestoneData {
  name?: string;
  description?: string | null;
  date?: string;
  status?: 'PENDING' | 'REACHED' | 'MISSED';
  color?: string | null;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  currentStats: ProjectStats | null;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  fetchProjectsByWorkspace: (workspaceId: string) => Promise<Project[]>;
  fetchProjectById: (id: string) => Promise<void>;
  fetchStats: (id: string) => Promise<void>;
  createProject: (data: CreateProjectData) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectData) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  addBoard: (projectId: string, boardId: string) => Promise<void>;
  removeBoard: (projectId: string, boardId: string) => Promise<void>;

  createMilestone: (projectId: string, data: CreateMilestoneData) => Promise<ProjectMilestone>;
  updateMilestone: (projectId: string, milestoneId: string, data: UpdateMilestoneData) => Promise<void>;
  deleteMilestone: (projectId: string, milestoneId: string) => Promise<void>;

  clearError: () => void;
  reset: () => void;
}

// ==================== STORE ====================

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,
      currentStats: null,
      isLoading: false,
      error: null,

      // ── Fetch all (sidebar: activos/planificados del usuario) ───────────────

      fetchProjects: async () => {
        set({ isLoading: true, error: null, projects: [] });
        try {
          const response = await apiService.get<{ projects: Project[] }>('/api/projects', true);
          if (!response.success || !response.data) {
            set({ error: response.error?.message || 'Error al obtener proyectos', isLoading: false });
            return;
          }
          set({ projects: response.data.projects, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Error desconocido', isLoading: false });
        }
      },

      // ── Fetch projects of a specific workspace ──────────────────────────────

      fetchProjectsByWorkspace: async (workspaceId: string) => {
        try {
          const response = await apiService.get<{ projects: Project[] }>(
            `/api/workspaces/${workspaceId}/projects`,
            true
          );
          if (!response.success || !response.data) return [];
          return response.data.projects;
        } catch {
          return [];
        }
      },

      // ── Fetch project by id ─────────────────────────────────────────────────

      fetchProjectById: async (id: string) => {
        set({ isLoading: true, error: null, currentProject: null, currentStats: null });
        try {
          const response = await apiService.get<{ project: Project }>(`/api/projects/${id}`, true);
          if (!response.success || !response.data) {
            set({ error: response.error?.message || 'Proyecto no encontrado', isLoading: false });
            return;
          }
          set({ currentProject: response.data.project, isLoading: false });
        } catch (error: any) {
          set({ error: error.message || 'Error desconocido', isLoading: false });
        }
      },

      // ── Fetch stats ─────────────────────────────────────────────────────────

      fetchStats: async (id: string) => {
        set({ currentStats: null });
        try {
          const response = await apiService.get<{ stats: ProjectStats }>(`/api/projects/${id}/stats`, true);
          if (response.success && response.data) {
            set({ currentStats: response.data.stats });
          }
        } catch {
          // no bloquear la UI si las stats fallan
        }
      },

      // ── Create project ──────────────────────────────────────────────────────

      createProject: async (data: CreateProjectData) => {
        const { workspaceId, ...body } = data;
        const response = await apiService.post<{ project: Project }>(
          `/api/workspaces/${workspaceId}/projects`,
          body,
          true
        );
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al crear proyecto');
        }
        const project = response.data.project;
        set((state) => ({ projects: [project, ...state.projects] }));
        return project;
      },

      // ── Update project ──────────────────────────────────────────────────────

      updateProject: async (id: string, data: UpdateProjectData) => {
        const response = await apiService.put<{ project: Project }>(`/api/projects/${id}`, data, true);
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al actualizar proyecto');
        }
        const updated = response.data.project;
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? updated : p)),
          currentProject: state.currentProject?.id === id ? updated : state.currentProject,
        }));
      },

      // ── Delete project ──────────────────────────────────────────────────────

      deleteProject: async (id: string) => {
        const response = await apiService.delete(`/api/projects/${id}`, true);
        if (!response.success) {
          throw new Error(response.error?.message || 'Error al eliminar proyecto');
        }
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject,
        }));
      },

      // ── Boards ──────────────────────────────────────────────────────────────

      addBoard: async (projectId: string, boardId: string) => {
        const response = await apiService.post<{ board: ProjectBoard }>(
          `/api/projects/${projectId}/boards`,
          { boardId },
          true
        );
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al añadir board');
        }
        const board = response.data.board;
        if (board) {
          set((state) => ({
            currentProject: state.currentProject?.id === projectId
              ? { ...state.currentProject, boards: [...(state.currentProject.boards ?? []), board] }
              : state.currentProject,
          }));
        }
      },

      removeBoard: async (projectId: string, boardId: string) => {
        const response = await apiService.delete(`/api/projects/${projectId}/boards/${boardId}`, true);
        if (!response.success) {
          throw new Error(response.error?.message || 'Error al quitar board');
        }
        set((state) => ({
          currentProject: state.currentProject?.id === projectId
            ? { ...state.currentProject, boards: (state.currentProject.boards ?? []).filter((b) => b.id !== boardId) }
            : state.currentProject,
        }));
      },

      // ── Milestones ──────────────────────────────────────────────────────────

      createMilestone: async (projectId: string, data: CreateMilestoneData) => {
        const response = await apiService.post<{ milestone: ProjectMilestone }>(
          `/api/projects/${projectId}/milestones`,
          data,
          true
        );
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al crear milestone');
        }
        const milestone = response.data.milestone;
        set((state) => ({
          currentProject: state.currentProject?.id === projectId
            ? {
                ...state.currentProject,
                milestones: [...(state.currentProject.milestones ?? []), milestone]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
              }
            : state.currentProject,
        }));
        return milestone;
      },

      updateMilestone: async (projectId: string, milestoneId: string, data: UpdateMilestoneData) => {
        const response = await apiService.put<{ milestone: ProjectMilestone }>(
          `/api/projects/${projectId}/milestones/${milestoneId}`,
          data,
          true
        );
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Error al actualizar milestone');
        }
        const updated = response.data.milestone;
        set((state) => ({
          currentProject: state.currentProject?.id === projectId
            ? {
                ...state.currentProject,
                milestones: (state.currentProject.milestones ?? [])
                  .map((m) => (m.id === milestoneId ? updated : m))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
              }
            : state.currentProject,
        }));
      },

      deleteMilestone: async (projectId: string, milestoneId: string) => {
        const response = await apiService.delete(`/api/projects/${projectId}/milestones/${milestoneId}`, true);
        if (!response.success) {
          throw new Error(response.error?.message || 'Error al eliminar milestone');
        }
        set((state) => ({
          currentProject: state.currentProject?.id === projectId
            ? { ...state.currentProject, milestones: (state.currentProject.milestones ?? []).filter((m) => m.id !== milestoneId) }
            : state.currentProject,
        }));
      },

      // ── Helpers ─────────────────────────────────────────────────────────────

      clearError: () => set({ error: null }),

      reset: () => set({ projects: [], currentProject: null, currentStats: null, isLoading: false, error: null }),
    }),
    {
      name: 'aether-project-store',
      storage: createJSONStorage(() => localStorage),
      partialize: () => ({}), // sin persistencia — mismo patrón que otros stores
    }
  )
);
