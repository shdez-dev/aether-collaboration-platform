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
  nextReviewAt?: string | null; receivedAt: string; createdAt?: string; formalizedProjectId?: string | null;
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
  canInviteCollaborators?: boolean;
  canWithdraw?: boolean;
  canAttach?: boolean;
  requesterLabel?: string;
  organizationRules?: {
    canEditAfterSubmission: boolean;
    canAttach: boolean;
    canInviteCollaborators: boolean;
    canWithdraw: boolean;
    decisionVisibility: 'STATUS' | 'REASON';
    mentorRequiredForValidation: boolean;
    separateApproverFromRequester: boolean;
    coordinatorCanApprove: boolean;
    leadRequiredForConversion: boolean;
  } | null;
  locale?: string;
  timezone?: string;
  isExternal: boolean;
}

export interface InitiativeIntakeInfo {
  enabled: boolean;
  reason: string | null;
  isReviewer: boolean;
  requesterLabel: string;
  openInitiativesCount: number;
  maxOpenInitiatives: number;
  limitReached: boolean;
  requesterRules: {
    canSubmit: boolean;
    canEditAfterSubmission: boolean;
    canAttach: boolean;
    canInviteCollaborators: boolean;
    canWithdraw: boolean;
    decisionVisibility: 'STATUS' | 'REASON';
    isDefaultWorkspace: boolean;
    hasDefaultWorkspace: boolean;
  };
  governanceRules: {
    mentorRequiredForValidation: boolean;
    separateApproverFromRequester: boolean;
    coordinatorCanApprove: boolean;
    leadRequiredForConversion: boolean;
  };
  privacyRules: { allowExternalInitiativeAccess: boolean };
  communicationRules: { notifyOnSubmission: boolean; notifyOnDecision: boolean };
  businessDays: number[];
  timezone: string;
  triageCriteria: string[];
  reviewCadenceDays: number;
}

/** Normalizes intake responses from older API instances before the UI reads nested rules. */
export function normalizeInitiativeIntake(value: unknown): InitiativeIntakeInfo {
  const source = value && typeof value === 'object' ? value as Partial<InitiativeIntakeInfo> : {};
  const requesterRules = (source.requesterRules && typeof source.requesterRules === 'object' ? source.requesterRules : {}) as Partial<InitiativeIntakeInfo['requesterRules']>;
  const governanceRules = (source.governanceRules && typeof source.governanceRules === 'object' ? source.governanceRules : {}) as Partial<InitiativeIntakeInfo['governanceRules']>;
  const privacyRules = (source.privacyRules && typeof source.privacyRules === 'object' ? source.privacyRules : {}) as Partial<InitiativeIntakeInfo['privacyRules']>;
  const communicationRules = (source.communicationRules && typeof source.communicationRules === 'object' ? source.communicationRules : {}) as Partial<InitiativeIntakeInfo['communicationRules']>;
  const finiteNumber = (candidate: unknown, fallback: number) => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;

  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : false,
    reason: typeof source.reason === 'string' ? source.reason : null,
    isReviewer: typeof source.isReviewer === 'boolean' ? source.isReviewer : false,
    requesterLabel: typeof source.requesterLabel === 'string' && source.requesterLabel.trim() ? source.requesterLabel : 'Solicitante',
    openInitiativesCount: finiteNumber(source.openInitiativesCount, 0),
    maxOpenInitiatives: finiteNumber(source.maxOpenInitiatives, 0),
    limitReached: typeof source.limitReached === 'boolean' ? source.limitReached : false,
    requesterRules: {
      canSubmit: typeof requesterRules.canSubmit === 'boolean' ? requesterRules.canSubmit : false,
      canEditAfterSubmission: typeof requesterRules.canEditAfterSubmission === 'boolean' ? requesterRules.canEditAfterSubmission : false,
      canAttach: typeof requesterRules.canAttach === 'boolean' ? requesterRules.canAttach : false,
      canInviteCollaborators: typeof requesterRules.canInviteCollaborators === 'boolean' ? requesterRules.canInviteCollaborators : false,
      canWithdraw: typeof requesterRules.canWithdraw === 'boolean' ? requesterRules.canWithdraw : false,
      decisionVisibility: requesterRules.decisionVisibility === 'REASON' ? 'REASON' : 'STATUS',
      isDefaultWorkspace: typeof requesterRules.isDefaultWorkspace === 'boolean' ? requesterRules.isDefaultWorkspace : false,
      hasDefaultWorkspace: typeof requesterRules.hasDefaultWorkspace === 'boolean' ? requesterRules.hasDefaultWorkspace : false,
    },
    governanceRules: {
      mentorRequiredForValidation: typeof governanceRules.mentorRequiredForValidation === 'boolean' ? governanceRules.mentorRequiredForValidation : false,
      separateApproverFromRequester: typeof governanceRules.separateApproverFromRequester === 'boolean' ? governanceRules.separateApproverFromRequester : false,
      coordinatorCanApprove: typeof governanceRules.coordinatorCanApprove === 'boolean' ? governanceRules.coordinatorCanApprove : false,
      leadRequiredForConversion: typeof governanceRules.leadRequiredForConversion === 'boolean' ? governanceRules.leadRequiredForConversion : false,
    },
    privacyRules: {
      allowExternalInitiativeAccess: typeof privacyRules.allowExternalInitiativeAccess === 'boolean' ? privacyRules.allowExternalInitiativeAccess : false,
    },
    communicationRules: {
      notifyOnSubmission: typeof communicationRules.notifyOnSubmission === 'boolean' ? communicationRules.notifyOnSubmission : false,
      notifyOnDecision: typeof communicationRules.notifyOnDecision === 'boolean' ? communicationRules.notifyOnDecision : false,
    },
    businessDays: Array.isArray(source.businessDays) ? source.businessDays.filter((day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6) : [1, 2, 3, 4, 5],
    timezone: typeof source.timezone === 'string' && source.timezone ? source.timezone : 'America/Santiago',
    triageCriteria: Array.isArray(source.triageCriteria) ? source.triageCriteria.filter((criterion): criterion is string => typeof criterion === 'string') : [],
    reviewCadenceDays: Math.max(1, finiteNumber(source.reviewCadenceDays, 7)),
  };
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
  initiatives: Initiative[]; listWorkspaceId: string | null; initiativeDetail: InitiativeDetail | null; loading: boolean; loadingMore: boolean; nextCursor: string | null; detailLoading: boolean; error: string | null; actionError: string | null;
  fetchInitiatives: (workspaceId: string, stage?: InitiativeStage) => Promise<void>;
  fetchMoreInitiatives: (workspaceId: string) => Promise<void>;
  fetchInitiativeDetail: (id: string) => Promise<InitiativeDetail | null>;
  transitionDetail: (id: string, input: { stage: InitiativeStage; decision?: string; reason?: string; nextReviewAt?: string | null; triageAssessment?: TriageAssessment[] }) => Promise<boolean>;
  updateDetail: (id: string, input: Partial<Pick<Initiative, 'description' | 'problemStatement' | 'impactedPeople' | 'problemImpact' | 'impactedCount' | 'expectedOutcome' | 'proposedSolution' | 'differentiation' | 'proposedNextStep' | 'priority' | 'nextReviewAt' | 'evidence' | 'attachments'>>) => Promise<boolean>;
  assignParticipant: (id: string, input: { userId: string; role: InitiativeParticipant['role'] }) => Promise<boolean>;
  removeParticipant: (id: string, userId: string) => Promise<boolean>;
  withdrawDetail: (id: string) => Promise<boolean>;
  convertDetail: (id: string, input?: { methodology: 'FLEXIBLE' | 'SCRUM'; advancedTraceability?: boolean; productOwnerId?: string | null; scrumMasterId?: string | null }) => Promise<boolean>;
  clearActionError: () => void;
  createInitiative: (input: InitiativeSubmission) => Promise<Initiative | null>;
  transition: (id: string, input: { stage: InitiativeStage; decision?: string; reason?: string; nextReviewAt?: string | null; triageAssessment?: TriageAssessment[] }) => Promise<Initiative | null>;
  convert: (id: string) => Promise<{ projectId: string; boardId?: string } | null>;
};

export const useInitiativeStore = create<InitiativeState>((set, get) => ({
  initiatives: [], listWorkspaceId: null, initiativeDetail: null, loading: false, loadingMore: false, nextCursor: null, detailLoading: false, error: null, actionError: null,
  fetchInitiatives: async (workspaceId, stage) => {
    set({ initiatives: [], listWorkspaceId: workspaceId, loading: true, loadingMore: false, nextCursor: null, error: null });
    const query = new URLSearchParams({ workspaceId, limit: '100' });
    if (stage) query.set('stage', stage);
    const response = await apiService.get<{ initiatives: Initiative[]; nextCursor: string | null }>(`/api/initiatives?${query.toString()}`, true);
    if (get().listWorkspaceId !== workspaceId) return;
    set(response.success && response.data ? { initiatives: response.data.initiatives, nextCursor: response.data.nextCursor, loading: false } : { loading: false, error: response.error?.message ?? 'No se pudieron cargar las iniciativas' });
  },
  fetchMoreInitiatives: async (workspaceId) => {
    const cursor = get().nextCursor;
    if (!cursor || get().loadingMore || get().listWorkspaceId !== workspaceId) return;
    set({ loadingMore: true, error: null });
    const query = new URLSearchParams({ workspaceId, limit: '100', cursor });
    const response = await apiService.get<{ initiatives: Initiative[]; nextCursor: string | null }>(`/api/initiatives?${query.toString()}`, true);
    if (get().listWorkspaceId !== workspaceId) return;
    set((state) => response.success && response.data
      ? { initiatives: [...state.initiatives, ...response.data.initiatives], nextCursor: response.data.nextCursor, loadingMore: false }
      : { loadingMore: false, error: response.error?.message ?? 'No se pudieron cargar más iniciativas' });
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
  withdrawDetail: async (id) => {
    set({ actionError: null });
    const response = await apiService.post(`/api/initiatives/${id}/withdraw`, {}, true);
    if (!response.success) { set({ actionError: response.error?.message ?? 'No se pudo retirar la iniciativa' }); return false; }
    return true;
  },
  convertDetail: async (id, input = { methodology: 'FLEXIBLE' as const }) => {
    set({ actionError: null });
    const response = await apiService.post<{ projectId: string }>(`/api/initiatives/${id}/convert`, input, true);
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
