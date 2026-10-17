import type { ProjectProposalAnswers } from '@/components/ProjectProposalFields';

export const PROJECT_CREATION_DRAFT_KEY = 'aether:create-project-draft';
export const PROJECT_CREATION_DRAFT_MAX_AGE = 24 * 60 * 60 * 1000;

export interface ProjectCreationDraft {
  savedAt: number;
  userId: string;
  workspaceId: string;
  proposal: ProjectProposalAnswers;
  cardPrefix?: string;
  cardPrefixCustomized?: boolean;
  methodology: 'FLEXIBLE' | 'SCRUM';
  teamIds: string[];
  memberIds: string[];
  productOwnerId: string;
  scrumMasterId: string;
}

function isProjectCreationDraft(value: unknown): value is ProjectCreationDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<ProjectCreationDraft>;
  const proposal = draft.proposal as Record<string, unknown> | undefined;
  const proposalFields: Array<keyof ProjectProposalAnswers> = [
    'title', 'summary', 'problemStatement', 'impactedPeople', 'problemImpact',
    'impactedCount', 'expectedOutcome', 'proposedSolution', 'differentiation',
  ];

  return typeof draft.savedAt === 'number'
    && typeof draft.userId === 'string'
    && typeof draft.workspaceId === 'string'
    && Boolean(proposal && proposalFields.every((field) => typeof proposal[field] === 'string'))
    && (draft.cardPrefix === undefined || typeof draft.cardPrefix === 'string')
    && (draft.cardPrefixCustomized === undefined || typeof draft.cardPrefixCustomized === 'boolean')
    && (draft.methodology === 'FLEXIBLE' || draft.methodology === 'SCRUM')
    && Array.isArray(draft.teamIds) && draft.teamIds.every((id) => typeof id === 'string')
    && Array.isArray(draft.memberIds) && draft.memberIds.every((id) => typeof id === 'string')
    && typeof draft.productOwnerId === 'string'
    && typeof draft.scrumMasterId === 'string';
}

export function readProjectCreationDraft(): ProjectCreationDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PROJECT_CREATION_DRAFT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (isProjectCreationDraft(value)) return value;
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
