import type { ProjectCreationAnswers } from '@/components/ProjectCreationFields';

export const PROJECT_CREATION_DRAFT_KEY = 'aether:create-project-draft';
export const PROJECT_CREATION_DRAFT_MAX_AGE = 24 * 60 * 60 * 1000;

export interface ProjectCreationDraft {
  savedAt: number;
  userId: string;
  workspaceId: string;
  answers: ProjectCreationAnswers;
  cardPrefix?: string;
  cardPrefixCustomized?: boolean;
  methodology: 'FLEXIBLE' | 'SCRUM';
  advancedTraceability?: boolean;
  teamIds: string[];
  memberIds: string[];
  productOwnerId: string;
  scrumMasterId: string;
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function isProjectCreationAnswers(value: unknown): value is ProjectCreationAnswers {
  const answers = asRecord(value);
  return Boolean(answers
    && typeof answers.title === 'string'
    && typeof answers.context === 'string'
    && typeof answers.objective === 'string'
    && typeof answers.successMetric === 'string'
    && typeof answers.targetValue === 'string'
    && typeof answers.unit === 'string');
}

function restoreAnswers(draft: RecordValue): ProjectCreationAnswers | null {
  if (isProjectCreationAnswers(draft.answers)) return draft.answers;

  // Migrate drafts saved by the previous wizard without discarding the work.
  const proposal = asRecord(draft.proposal);
  if (!proposal || typeof proposal.title !== 'string' || typeof proposal.expectedOutcome !== 'string') return null;
  return {
    title: proposal.title,
    context: typeof proposal.problemStatement === 'string' && proposal.problemStatement.trim()
      ? proposal.problemStatement
      : typeof proposal.summary === 'string' ? proposal.summary : '',
    objective: proposal.expectedOutcome,
    successMetric: typeof draft.successMetric === 'string' ? draft.successMetric : '',
    targetValue: typeof draft.targetValue === 'string' ? draft.targetValue : '',
    unit: typeof draft.unit === 'string' ? draft.unit : '',
  };
}

function normalizeDraft(value: unknown): ProjectCreationDraft | null {
  const draft = asRecord(value);
  if (!draft) return null;
  const answers = restoreAnswers(draft);
  if (!answers) return null;

  if (typeof draft.savedAt !== 'number'
    || typeof draft.userId !== 'string'
    || typeof draft.workspaceId !== 'string'
    || (draft.cardPrefix !== undefined && typeof draft.cardPrefix !== 'string')
    || (draft.cardPrefixCustomized !== undefined && typeof draft.cardPrefixCustomized !== 'boolean')
    || (draft.methodology !== 'FLEXIBLE' && draft.methodology !== 'SCRUM')
    || (draft.advancedTraceability !== undefined && typeof draft.advancedTraceability !== 'boolean')
    || !Array.isArray(draft.teamIds) || !draft.teamIds.every((id) => typeof id === 'string')
    || !Array.isArray(draft.memberIds) || !draft.memberIds.every((id) => typeof id === 'string')
    || typeof draft.productOwnerId !== 'string'
    || typeof draft.scrumMasterId !== 'string') return null;

  return {
    savedAt: draft.savedAt,
    userId: draft.userId,
    workspaceId: draft.workspaceId,
    answers,
    cardPrefix: draft.cardPrefix as string | undefined,
    cardPrefixCustomized: draft.cardPrefixCustomized as boolean | undefined,
    methodology: draft.methodology,
    advancedTraceability: draft.advancedTraceability as boolean | undefined,
    teamIds: draft.teamIds as string[],
    memberIds: draft.memberIds as string[],
    productOwnerId: draft.productOwnerId,
    scrumMasterId: draft.scrumMasterId,
  };
}

export function readProjectCreationDraft(): ProjectCreationDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PROJECT_CREATION_DRAFT_KEY);
    if (!raw) return null;
    const draft = normalizeDraft(JSON.parse(raw) as unknown);
    if (draft) return draft;
  } catch {
    // Un borrador malformado no debe impedir que se use el modal.
  }
  window.sessionStorage.removeItem(PROJECT_CREATION_DRAFT_KEY);
  return null;
}

export function saveProjectCreationDraft(draft: ProjectCreationDraft) {
  window.sessionStorage.setItem(PROJECT_CREATION_DRAFT_KEY, JSON.stringify(draft));
}

export function clearProjectCreationDraft(workspaceId?: string) {
  if (typeof window === 'undefined') return;
  if (workspaceId) {
    const existingDraft = readProjectCreationDraft();
    if (existingDraft && existingDraft.workspaceId !== workspaceId) return;
  }
  window.sessionStorage.removeItem(PROJECT_CREATION_DRAFT_KEY);
}
