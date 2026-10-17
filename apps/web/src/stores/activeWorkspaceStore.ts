// apps/web/src/stores/activeWorkspaceStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiService } from '@/services/apiService';

export interface SidebarBoard {
  id: string;
  name: string;
  color?: string | null;
  archived: boolean;
  workspaceId: string;
  updatedAt: string;
}

export interface SidebarProject {
  id: string;
  name: string;
  color?: string | null;
  status: string;
  workspaceId: string;
}

let sidebarBoardsRequestId = 0;
let sidebarProjectsRequestId = 0;

interface ActiveWorkspaceState {
  activeWorkspaceId: string | null;
  sidebarBoards: SidebarBoard[];
  sidebarProjects: SidebarProject[];
  boardsLoading: boolean;
  projectsLoading: boolean;
  projectsError: boolean;

  setActiveWorkspaceId: (id: string | null) => void;
  fetchSidebarBoards: (workspaceId: string) => Promise<void>;
  fetchSidebarProjects: (workspaceId: string) => Promise<void>;
  addSidebarBoard: (board: SidebarBoard) => void;
  removeSidebarBoard: (boardId: string) => void;
  addSidebarProject: (project: SidebarProject) => void;
  removeSidebarProject: (projectId: string) => void;
}

export const useActiveWorkspaceStore = create<ActiveWorkspaceState>()(
  persist(
    (set, get) => ({
      activeWorkspaceId: null,
      sidebarBoards: [],
      sidebarProjects: [],
      boardsLoading: false,
      projectsLoading: false,
      projectsError: false,

      setActiveWorkspaceId: (id) => {
        if (get().activeWorkspaceId === id) return;
        sidebarBoardsRequestId += 1;
        sidebarProjectsRequestId += 1;
        set({
          activeWorkspaceId: id,
          sidebarBoards: [],
          sidebarProjects: [],
          boardsLoading: false,
          projectsLoading: false,
          projectsError: false,
        });
      },

      fetchSidebarBoards: async (workspaceId) => {
        if (get().activeWorkspaceId !== workspaceId) return;
        const requestId = ++sidebarBoardsRequestId;
        set({ boardsLoading: true });
        try {
          const r = await apiService.get<{ boards: SidebarBoard[] }>(
            `/api/workspaces/${workspaceId}/boards`,
            true
          );
          if (requestId === sidebarBoardsRequestId && get().activeWorkspaceId === workspaceId && r.success && r.data) {
            set({ sidebarBoards: r.data.boards.filter((b) => !b.archived) });
          }
        } catch { /* silent */ }
        finally {
          if (requestId === sidebarBoardsRequestId && get().activeWorkspaceId === workspaceId) {
            set({ boardsLoading: false });
          }
        }
      },

      fetchSidebarProjects: async (workspaceId) => {
        if (get().activeWorkspaceId !== workspaceId) return;
        const requestId = ++sidebarProjectsRequestId;
        set({ projectsLoading: true, projectsError: false });
        try {
          const r = await apiService.get<{ projects: SidebarProject[] }>(
            `/api/workspaces/${workspaceId}/projects`,
            true
          );
          if (requestId === sidebarProjectsRequestId && get().activeWorkspaceId === workspaceId) {
            if (r.success && r.data) {
              set({
                sidebarProjects: r.data.projects.filter((project) => project.workspaceId === workspaceId),
                projectsError: false,
              });
            }
            else set({ projectsError: true });
          }
        } catch {
          if (requestId === sidebarProjectsRequestId && get().activeWorkspaceId === workspaceId) set({ projectsError: true });
        }
        finally {
          if (requestId === sidebarProjectsRequestId && get().activeWorkspaceId === workspaceId) {
            set({ projectsLoading: false });
          }
        }
      },

      addSidebarBoard: (board) => {
        set((state) => ({
          sidebarBoards: state.sidebarBoards.some((b) => b.id === board.id)
            ? state.sidebarBoards
            : [...state.sidebarBoards, board],
        }));
      },

      removeSidebarBoard: (boardId) => {
        set((state) => ({
          sidebarBoards: state.sidebarBoards.filter((b) => b.id !== boardId),
        }));
      },

      addSidebarProject: (project) => {
        set((state) => {
          if (project.workspaceId !== state.activeWorkspaceId) return state;
          return {
            sidebarProjects: [project, ...state.sidebarProjects.filter((item) => item.id !== project.id)],
          };
        });
      },

      removeSidebarProject: (projectId) => {
        set((state) => ({
          sidebarProjects: state.sidebarProjects.filter((p) => p.id !== projectId),
        }));
      },
    }),
    {
      name: 'aether-active-ws',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId }),
    }
  )
);
