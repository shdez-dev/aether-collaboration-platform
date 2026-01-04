// apps/web/src/stores/workspaceStore.ts

import { create } from 'zustand';

// ==================== TYPES ====================

interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  userRole?: string;
  boardCount?: number;
  memberCount?: number;
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
  isLoading: boolean;
  error: string | null;

  // Acciones
  fetchWorkspaces: () => Promise<void>;
  fetchWorkspaceById: (id: string) => Promise<void>;
  createWorkspace: (data: CreateWorkspaceData) => Promise<Workspace>;
  updateWorkspace: (id: string, data: UpdateWorkspaceData) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
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

// ==================== API CONFIG ====================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ==================== HELPERS ====================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: any }> {
  try {
    // Obtener token del localStorage (desde authStore)
    const authData = localStorage.getItem('aether-auth-storage');
    let token = null;

    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        // El token puede estar en state.accessToken o directamente en accessToken
        token = parsed.state?.accessToken || parsed.accessToken;
      } catch (e) {
        console.error('Error parsing auth data:', e);
      }
    }

    console.log('🔑 Token being used:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');

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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // Estado inicial
  workspaces: [],
  currentWorkspace: null,
  currentMembers: [],
  isLoading: false,
  error: null,

  // ==================== FETCH WORKSPACES ====================
  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiRequest<{ workspaces: Workspace[] }>('/api/workspaces');

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
      const response = await apiRequest<{ workspace: Workspace }>(`/api/workspaces/${id}`);

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
      const response = await apiRequest<{ workspace: Workspace }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify(data),
      });

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
      const response = await apiRequest<{ workspace: Workspace }>(`/api/workspaces/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

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
      const response = await apiRequest(`/api/workspaces/${id}`, {
        method: 'DELETE',
      });

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
      const response = await apiRequest<{ members: WorkspaceMember[] }>(
        `/api/workspaces/${workspaceId}/members`
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
      const response = await apiRequest(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });

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
      const response = await apiRequest(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });

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
      const response = await apiRequest(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
      });

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

  // ==================== CLEAR ERROR ====================
  clearError: () => {
    set({ error: null });
  },
}));
