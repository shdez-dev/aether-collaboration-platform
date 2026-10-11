import { create } from 'zustand';
import { apiService } from '@/services/apiService';

export type InitiativeStage = 'SUBMITTED' | 'TRIAGE' | 'DIAGNOSIS' | 'VALIDATION' | 'APPROVED' | 'DECLINED' | 'PAUSED' | 'ARCHIVED';
export type InitiativePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TriageAssessmentStatus = 'PASS' | 'FAIL' | 'NOT_APPLICABLE';

export interface TriageAssessment {
  criterion: string;
  status: TriageAssessmentStatus;
  note?: string | null;
}

export interface Initiative {
  id: string; workspaceId: string; title: string; description?: string | null;
  problemStatement?: string | null; proposedNextStep?: string | null;
  impactedPeople?: string | null; problemImpact?: string | null; impactedCount?: number | null;
  expectedOutcome?: string | null; proposedSolution?: string | null; differentiation?: string | null;
  priority: InitiativePriority; stage: InitiativeStage; decision?: string | null; decisionReason?: string | null;
  evidence: Array<{ title: string; url?: string; note?: string }>;
  attachments: Array<{ name: string; url: string; type?: string }>;
  triageCriteria?: string[]; triageAssessment?: TriageAssessment[];
  nextReviewAt?: string | null; receivedAt: string; formalizedProjectId?: string | null;
  requester?: { id: string; name: string; email: string; avatar?: string } | null;
  triageOwner?: { id: string; name: string; email: string } | null;
  mentor?: { id: string; name: string; email: string } | null;
}

export interface InitiativeParticipant {
  id: string;
  role: 'REQUESTER' | 'TRIAGE_COORDINATOR' | 'MENTOR' | 'EVALUATOR' | 'PROJECT_LEAD' | 'COLLABORATOR' | 'SPONSOR';
  assignedAt: string;
  user: { id: string; name: string; email: string; avatar?: string | null };
}

export interface InitiativeWorkflowEntry {
  id: string;
  fromStage?: InitiativeStage | null;
  toStage?: InitiativeStage | null;
  decision?: string | null;
  reason?: string | null;
  triageAssessment?: TriageAssessment[] | null;
  nextReviewAt?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface InitiativeAssignmentEntry {
  id: string;
  subjectUserId?: string | null;
  subjectName?: string | null;
  role: InitiativeParticipant['role'];
  action: 'ASSIGNED' | 'REMOVED' | 'REVOKED';
  actorId?: string | null;
  actorName?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface InitiativeContentEntry {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

export interface InitiativeAccess {
  canRead: boolean;
  canEdit: boolean;
  canManage: boolean;
  isExternal: boolean;
}

export interface InitiativeDetail {
  initiative: Initiative;
  access: InitiativeAccess;
  participants: InitiativeParticipant[];
  history: InitiativeWorkflowEntry[];
  assignmentHistory: InitiativeAssignmentEntry[];
  contentHistory: InitiativeContentEntry[];
}

export interface InitiativeSubmission {
  workspaceId: string;
  title: string;
  description: string;
  problemStatement: string;
  impactedPeople: string;
  problemImpact: string;
  impactedCount: number;
  expectedOutcome: string;
  proposedSolution: string;
  differentiation: string;
}

type InitiativeState = {
  initiatives: Initiative[]; initiativeDetail: InitiativeDetail | null; loading: boolean; detailLoading: boolean; error: string | null; actionError: string | null;
  fetchInitiatives: (workspaceId: string, stage?: InitiativeStage) => Promise<void>;
  fetchInitiativeDetail: (id: string) => Promise<InitiativeDetail | null>;
  transitionDetail: (id: string, input: { stage: InitiativeStage; decision?: string; reason?: string; nextReviewAt?: string | null; triageAssessment?: TriageAssessment[] }) => Promise<boolean>;
  updateDetail: (id: string, input: Partial<Pick<Initiative, 'description' | 'problemStatement' | 'impactedPeople' | 'problemImpact' | 'impactedCount' | 'expectedOutcome' | 'proposedSolution' | 'differentiation' | 'proposedNextStep' | 'priority' | 'nextReviewAt' | 'evidence' | 'attachments'>>) => Promise<boolean>;
  assignParticipant: (id: string, input: { userId: string; role: InitiativeParticipant['role'] }) => Promise<boolean>;
  removeParticipant: (id: string, userId: string) => Promise<boolean>;
  convertDetail: (id: string) => Promise<boolean>;
  clearActionError: () => void;
  createInitiative: (input: InitiativeSubmission) => Promise<Initiative | null>;
  transition: (id: string, input: { stage: InitiativeStage; decision?: string; reason?: string; nextReviewAt?: string | null; triageAssessment?: TriageAssessment[] }) => Promise<Initiative | null>;
  convert: (id: string) => Promise<{ projectId: string; boardId?: string } | null>;
};

export const useInitiativeStore = create<InitiativeState>((set) => ({
  initiatives: [], initiativeDetail: null, loading: false, detailLoading: false, error: null, actionError: null,
  fetchInitiatives: async (workspaceId, stage) => {
    set({ loading: true, error: null });
    const query = stage ? `?workspaceId=${workspaceId}&stage=${stage}` : `?workspaceId=${workspaceId}`;
    const response = await apiService.get<{ initiatives: Initiative[] }>(`/api/initiatives${query}`, true);
    set(response.success && response.data ? { initiatives: response.data.initiatives, loading: false } : { loading: false, error: response.error?.message ?? 'No se pudieron cargar las iniciativas' });
  },
  fetchInitiativeDetail: async (id) => {
    set({ detailLoading: true, error: null, actionError: null, initiativeDetail: null });
    const response = await apiService.get<InitiativeDetail>(`/api/initiatives/${id}`, true);
    if (!response.success || !response.data) {
      set({ detailLoading: false, error: response.error?.message ?? 'No se pudo cargar la iniciativa' });
      return null;
    }
    set({ initiativeDetail: response.data, detailLoading: false });
    return response.data;
  },
  transitionDetail: async (id, input) => {
    set({ actionError: null });
    const response = await apiService.post<{ initiative: Initiative }>(`/api/initiatives/${id}/transition`, input, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo registrar la decisión' }); return false; }
    return true;
  },
  updateDetail: async (id, input) => {
    set({ actionError: null });
    const response = await apiService.patch<{ initiative: Initiative }>(`/api/initiatives/${id}`, input, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo actualizar la iniciativa' }); return false; }
    return true;
  },
  assignParticipant: async (id, input) => {
    set({ actionError: null });
    const response = await apiService.post(`/api/initiatives/${id}/participants`, input, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo asignar a la persona' }); return false; }
    return true;
  },
  removeParticipant: async (id, userId) => {
    set({ actionError: null });
    const response = await apiService.delete(`/api/initiatives/${id}/participants/${userId}`, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo remover a la persona' }); return false; }
    return true;
  },
  convertDetail: async (id) => {
    set({ actionError: null });
    const response = await apiService.post<{ projectId: string }>(`/api/initiatives/${id}/convert`, {}, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo formalizar la iniciativa' }); return false; }
    return true;
  },
  clearActionError: () => set({ actionError: null }),
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
