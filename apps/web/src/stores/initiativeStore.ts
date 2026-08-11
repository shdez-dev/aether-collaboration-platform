import { create } from 'zustand';
import { apiService } from '@/services/apiService';

export type InitiativeStage = 'SUBMITTED' | 'TRIAGE' | 'DIAGNOSIS' | 'VALIDATION' | 'APPROVED' | 'DECLINED' | 'PAUSED' | 'ARCHIVED';
export type InitiativePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Initiative {
  id: string; workspaceId: string; title: string; description?: string | null;
  problemStatement?: string | null; proposedNextStep?: string | null;
  priority: InitiativePriority; stage: InitiativeStage; decision?: string | null; decisionReason?: string | null;
  evidence: Array<{ title: string; url?: string; note?: string }>;
  attachments: Array<{ name: string; url: string; type?: string }>;
  nextReviewAt?: string | null; receivedAt: string; formalizedProjectId?: string | null;
  requester?: { id: string; name: string; email: string; avatar?: string } | null;
  triageOwner?: { id: string; name: string; email: string } | null;
  mentor?: { id: string; name: string; email: string } | null;
}

type InitiativeState = {
  initiatives: Initiative[]; loading: boolean; error: string | null;
  fetchInitiatives: (workspaceId: string, stage?: InitiativeStage) => Promise<void>;
  createInitiative: (input: Partial<Initiative> & { workspaceId: string; title: string }) => Promise<Initiative | null>;
  transition: (id: string, input: { stage: InitiativeStage; decision?: string; reason?: string; nextReviewAt?: string | null }) => Promise<Initiative | null>;
  convert: (id: string) => Promise<{ projectId: string; boardId?: string } | null>;
};

export const useInitiativeStore = create<InitiativeState>((set) => ({
  initiatives: [], loading: false, error: null,
  fetchInitiatives: async (workspaceId, stage) => {
    set({ loading: true, error: null });
    const query = stage ? `?workspaceId=${workspaceId}&stage=${stage}` : `?workspaceId=${workspaceId}`;
    const response = await apiService.get<{ initiatives: Initiative[] }>(`/api/initiatives${query}`, true);
    set(response.success && response.data ? { initiatives: response.data.initiatives, loading: false } : { loading: false, error: response.error?.message ?? 'No se pudieron cargar las iniciativas' });
  },
  createInitiative: async (input) => {
    const response = await apiService.post<{ initiative: Initiative }>('/api/initiatives/request', input, true);
    if (!response.success || !response.data) { set({ error: response.error?.message ?? 'No se pudo crear la iniciativa' }); return null; }
    set((state) => ({ initiatives: [response.data!.initiative, ...state.initiatives] })); return response.data.initiative;
  },
  transition: async (id, input) => {
    const response = await apiService.post<{ initiative: Initiative }>(`/api/initiatives/${id}/transition`, input, true);
    if (!response.success || !response.data) { set({ error: response.error?.message ?? 'No se pudo actualizar la iniciativa' }); return null; }
    set((state) => ({ initiatives: state.initiatives.map((item) => item.id === id ? { ...item, ...response.data!.initiative } : item) })); return response.data.initiative;
  },
  convert: async (id) => {
    const response = await apiService.post<{ projectId: string; boardId?: string }>(`/api/initiatives/${id}/convert`, {}, true);
    if (!response.success || !response.data) { set({ error: response.error?.message ?? 'No se pudo formalizar la iniciativa' }); return null; }
    set((state) => ({ initiatives: state.initiatives.map((item) => item.id === id ? { ...item, formalizedProjectId: response.data!.projectId } : item) })); return response.data;
  },
}));
