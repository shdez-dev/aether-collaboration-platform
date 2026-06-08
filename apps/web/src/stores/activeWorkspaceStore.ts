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

interface ActiveWorkspaceState {
  activeWorkspaceId: string | null;
  sidebarBoards: SidebarBoard[];
  sidebarProjects: SidebarProject[];
  boardsLoading: boolean;
  projectsLoading: boolean;

  setActiveWorkspaceId: (id: string) => void;
  fetchSidebarBoards: (workspaceId: string) => Promise<void>;
  fetchSidebarProjects: (workspaceId: string) => Promise<void>;
  addSidebarBoard: (board: SidebarBoard) => void;
  removeSidebarBoard: (boardId: string) => void;
}

export const useActiveWorkspaceStore = create<ActiveWorkspaceState>()(
  persist(
    (set, get) => ({
      activeWorkspaceId: null,
      sidebarBoards: [],
      sidebarProjects: [],
      boardsLoading: false,
      projectsLoading: false,

      setActiveWorkspaceId: (id) => {
        if (get().activeWorkspaceId === id) return;
        set({ activeWorkspaceId: id, sidebarBoards: [], sidebarProjects: [] });
      },

      fetchSidebarBoards: async (workspaceId) => {
        set({ boardsLoading: true });
        try {
          const r = await apiService.get<{ boards: SidebarBoard[] }>(
            `/api/workspaces/${workspaceId}/boards`,
            true
          );
          if (r.success && r.data) {
            set({ sidebarBoards: r.data.boards.filter((b) => !b.archived) });
          }
        } catch { /* silent */ }
        finally { set({ boardsLoading: false }); }
      },

      fetchSidebarProjects: async (workspaceId) => {
        set({ projectsLoading: true });
        try {
          const r = await apiService.get<{ projects: SidebarProject[] }>(
            `/api/workspaces/${workspaceId}/projects`,
            true
          );
          if (r.success && r.data) {
            set({ sidebarProjects: r.data.projects });
          }
        } catch { /* silent */ }
        finally { set({ projectsLoading: false }); }
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
    }),
    {
      name: 'aether-active-ws',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ activeWorkspaceId: state.activeWorkspaceId }),
    }
  )
);
