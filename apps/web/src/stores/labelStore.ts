// apps/web/src/stores/labelStore.ts
import { create } from 'zustand';

export interface Label {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateLabelDto {
  name: string;
  color: string;
}

interface UpdateLabelDto {
  name?: string;
  color?: string;
}

interface LabelStore {
  // Estado
  labels: Record<string, Label[]>; // workspaceId -> labels[]
  isLoading: boolean;
  error: string | null;

  // Acciones
  fetchLabels: (workspaceId: string) => Promise<void>;
  createLabel: (workspaceId: string, data: CreateLabelDto) => Promise<Label>;
  updateLabel: (labelId: string, data: UpdateLabelDto) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<void>;

  // Helpers
  getWorkspaceLabels: (workspaceId: string) => Label[];
  clearLabels: () => void;
}

export const useLabelStore = create<LabelStore>((set, get) => ({
  // Estado inicial
  labels: {},
  isLoading: false,
  error: null,

  // Fetch labels de un workspace
  fetchLabels: async (workspaceId: string) => {
    set({ isLoading: true, error: null });

    try {
      const authData = localStorage.getItem('aether-auth-storage');
      let token = null;

      if (authData) {
        const parsed = JSON.parse(authData);
        token = parsed.state?.accessToken || parsed.accessToken;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/workspaces/${workspaceId}/labels`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch labels');
      }

      const { data } = await response.json();
      const labels = data.labels || [];

      set((state) => ({
        labels: {
          ...state.labels,
          [workspaceId]: labels,
        },
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Error fetching labels:', error);
      set({ error: error.message, isLoading: false });
    }
  },

  // Crear label
  createLabel: async (workspaceId: string, data: CreateLabelDto) => {
    try {
      const authData = localStorage.getItem('aether-auth-storage');
      let token = null;

      if (authData) {
        const parsed = JSON.parse(authData);
        token = parsed.state?.accessToken || parsed.accessToken;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/workspaces/${workspaceId}/labels`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create label');
      }

      const { data: responseData } = await response.json();
      const newLabel = responseData.label;

      // Agregar al store
      set((state) => ({
        labels: {
          ...state.labels,
          [workspaceId]: [...(state.labels[workspaceId] || []), newLabel],
        },
      }));

      return newLabel;
    } catch (error: any) {
      console.error('Error creating label:', error);
      throw error;
    }
  },

  // Actualizar label
  updateLabel: async (labelId: string, data: UpdateLabelDto) => {
    try {
      const authData = localStorage.getItem('aether-auth-storage');
      let token = null;

      if (authData) {
        const parsed = JSON.parse(authData);
        token = parsed.state?.accessToken || parsed.accessToken;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/labels/${labelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update label');
      }

      const { data: responseData } = await response.json();
      const updatedLabel = responseData.label;

      // Actualizar en store
      set((state) => {
        const newLabels = { ...state.labels };

        Object.keys(newLabels).forEach((workspaceId) => {
          newLabels[workspaceId] = newLabels[workspaceId].map((label) =>
            label.id === labelId ? updatedLabel : label
          );
        });

        return { labels: newLabels };
      });
    } catch (error: any) {
      console.error('Error updating label:', error);
      throw error;
    }
  },

  // Eliminar label
  deleteLabel: async (labelId: string) => {
    try {
      const authData = localStorage.getItem('aether-auth-storage');
      let token = null;

      if (authData) {
        const parsed = JSON.parse(authData);
        token = parsed.state?.accessToken || parsed.accessToken;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/labels/${labelId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete label');
      }

      // Eliminar del store
      set((state) => {
        const newLabels = { ...state.labels };

        Object.keys(newLabels).forEach((workspaceId) => {
          newLabels[workspaceId] = newLabels[workspaceId].filter((label) => label.id !== labelId);
        });

        return { labels: newLabels };
      });
    } catch (error: any) {
      console.error('Error deleting label:', error);
      throw error;
    }
  },

  // Helper: obtener labels de un workspace
  getWorkspaceLabels: (workspaceId: string) => {
    return get().labels[workspaceId] || [];
  },

  // Limpiar labels
  clearLabels: () => {
    set({ labels: {}, error: null });
  },
}));
