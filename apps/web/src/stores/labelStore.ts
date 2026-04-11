// apps/web/src/stores/labelStore.ts
import { create } from 'zustand';
import { apiService } from '@/services/apiService';

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
      const response = await apiService.get<{ labels: Label[] }>(
        `/api/workspaces/${workspaceId}/labels`,
        true
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch labels');
      }

      const labels = response.data?.labels || [];

      set((state) => ({
        labels: {
          ...state.labels,
          [workspaceId]: labels,
        },
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Crear label
  createLabel: async (workspaceId: string, data: CreateLabelDto) => {
    const response = await apiService.post<{ label: Label }>(
      `/api/workspaces/${workspaceId}/labels`,
      data,
      true
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create label');
    }

    const newLabel = response.data.label;

    set((state) => ({
      labels: {
        ...state.labels,
        [workspaceId]: [...(state.labels[workspaceId] || []), newLabel],
      },
    }));

    return newLabel;
  },

  // Actualizar label
  updateLabel: async (labelId: string, data: UpdateLabelDto) => {
    const response = await apiService.put<{ label: Label }>(
      `/api/labels/${labelId}`,
      data,
      true
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to update label');
    }

    const updatedLabel = response.data.label;

    set((state) => {
      const newLabels = { ...state.labels };

      Object.keys(newLabels).forEach((workspaceId) => {
        newLabels[workspaceId] = newLabels[workspaceId].map((label) =>
          label.id === labelId ? updatedLabel : label
        );
      });

      return { labels: newLabels };
    });
  },

  // Eliminar label
  deleteLabel: async (labelId: string) => {
    const response = await apiService.delete(`/api/labels/${labelId}`, true);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete label');
    }

    set((state) => {
      const newLabels = { ...state.labels };

      Object.keys(newLabels).forEach((workspaceId) => {
        newLabels[workspaceId] = newLabels[workspaceId].filter((label) => label.id !== labelId);
      });

      return { labels: newLabels };
    });
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
