import { apiService } from '@/services/apiService';

export type ProjectTeam = {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
  leadName: string | null;
};

export type ProjectDirectMember = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  roleName?: string;
  addedAt: string;
};

export type ProjectTeamMember = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  roleName?: string;
  teamId: string;
  teamName: string;
  teamColor: string | null;
};

export type ProjectScrumRole = 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPER';

export type ProjectScrumAssignment = {
  userId: string;
  name: string;
  email: string;
  role: ProjectScrumRole;
};

export type ProjectActivityEntry = {
  id: string;
  eventType: string;
  payload: any;
  delta?: any;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: number;
  createdAt: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  cardId?: string;
};

export type ProjectBacklogCard = {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  storyPoints: number | null;
  epicId: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  completed: boolean;
  blockedByPendingCount: number;
  dueDate: string | null;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  sprintId?: string | null;
  sprintName?: string | null;
  sprintStatus?: 'PLANNED' | 'ACTIVE' | null;
};

export type ProjectEpic = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRiskStatus = 'OPEN' | 'MITIGATING' | 'ACCEPTED' | 'CLOSED';

export type ProjectRiskOwner = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

export type ProjectRisk = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  probability: number;
  impact: number;
  inherentScore: number;
  residualProbability: number | null;
  residualImpact: number | null;
  residualScore: number;
  mitigationPlan: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerAvatar: string | null;
  status: ProjectRiskStatus;
  nextReviewAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRiskInput = Pick<ProjectRisk, 'title' | 'probability' | 'impact' | 'mitigationPlan'> & {
  description?: string | null;
  residualProbability?: number | null;
  residualImpact?: number | null;
  ownerId: string;
  status?: ProjectRiskStatus;
  nextReviewAt?: string | null;
};

export type ProjectDecision = {
  id: string;
  projectId: string;
  title: string;
  context: string | null;
  outcome: string;
  rationale: string;
  decisionDate: string;
  recorderId: string | null;
  recorderName: string;
  supersedesId: string | null;
  supersededById: string | null;
  subjectType: 'PROJECT' | 'OBJECTIVE' | 'DELIVERABLE' | 'OUTCOME';
  subjectId: string | null;
  isCurrent: boolean;
  createdAt: string;
};

export type ProjectDecisionInput = Pick<ProjectDecision, 'title' | 'outcome' | 'rationale' | 'decisionDate'> & {
  context?: string | null;
  supersedesId?: string | null;
  subjectType?: ProjectDecision['subjectType'];
  subjectId?: string | null;
};

export type ProjectDocumentCategory = 'GENERAL' | 'DIRECTION' | 'REQUIREMENTS' | 'ARCHITECTURE' | 'VERIFICATION' | 'DELIVERY' | 'OPERATIONS' | 'METRICS';
export type ProjectEvidenceTargetType = 'PROJECT' | 'OBJECTIVE' | 'DELIVERABLE' | 'REQUIREMENT' | 'OUTCOME' | 'DECISION';
export type ProjectEvidenceLink = {
  id: string;
  projectId: string;
  documentId: string | null;
  documentVersionId: string | null;
  documentTitle: string;
  snapshotText: string;
  documentUpdatedAt: string;
  currentDocumentUpdatedAt: string | null;
  targetType: ProjectEvidenceTargetType;
  targetId: string | null;
  claim: string;
  excerpt: string | null;
  status: 'PENDING' | 'VERIFIED';
  createdBy: string | null;
  createdAt: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
};
export type ProjectDocumentation = {
  profiles: Array<{ documentId: string; category: ProjectDocumentCategory }>;
  evidenceLinks: ProjectEvidenceLink[];
};
export type ProjectEvidenceInput = {
  documentId: string;
  targetType: ProjectEvidenceTargetType;
  targetId: string | null;
  claim: string;
  excerpt?: string | null;
};

export type ProjectBaselineEffortUnit = 'HOURS' | 'DAYS' | 'STORY_POINTS';

export type ProjectBaseline = {
  id: string;
  projectId: string;
  version: number;
  scope: string;
  startDate: string;
  targetDate: string;
  effortValue: number;
  effortUnit: ProjectBaselineEffortUnit;
  changeReason: string | null;
  isCurrent: boolean;
  creatorId: string | null;
  creatorName: string;
  createdAt: string;
};

export type ProjectBaselineInput = Pick<
  ProjectBaseline,
  'scope' | 'startDate' | 'targetDate' | 'effortValue' | 'effortUnit'
> & { changeReason?: string | null };

export type ProjectTraceabilityOrigin = {
  id: string;
  type: 'DIRECT' | 'INITIATIVE' | 'LEGACY';
  sourceInitiativeId: string | null;
  title: string;
  description: string | null;
  problemStatement: string | null;
  impactedPeople: string | null;
  problemImpact: string | null;
  impactedCount: number | null;
  expectedOutcome: string | null;
  proposedSolution: string | null;
  differentiation: string | null;
  capturedAt: string;
  isReconstructed: boolean;
};

export type ProjectTraceabilityObjective = {
  id: string;
  projectId?: string;
  version: number;
  isCurrent: boolean;
  statement: string;
  successMetric: string | null;
  targetValue: number | null;
  unit: string | null;
  changeReason: string | null;
  updatedAt: string;
};

export type ProjectTraceabilityCard = { id: string; title: string; completed: boolean; dueDate: string | null; cardCode: string | null };
export type ProjectTraceabilityRequirement = {
  id: string;
  projectId: string;
  deliverableId: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string;
  requirementType: 'FUNCTIONAL' | 'NON_FUNCTIONAL' | 'CONSTRAINT';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'DEFINED' | 'IN_PROGRESS' | 'VERIFIED' | 'BLOCKED';
  verificationMethod: string | null;
  evidence: string | null;
  position: number;
  cards: ProjectTraceabilityCard[];
  createdAt: string;
  updatedAt: string;
};
export type ProjectTraceabilityDeliverable = {
  id: string;
  projectId: string;
  objectiveId: string;
  name: string;
  description: string | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'AT_RISK';
  position: number;
  cards: ProjectTraceabilityCard[];
  requirements: ProjectTraceabilityRequirement[];
  createdAt: string;
  updatedAt: string;
};
export type ProjectTraceabilityMilestone = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  date: string | null;
  status: 'PENDING' | 'REACHED' | 'MISSED';
  color: string | null;
  deliverableId: string | null;
  deliverableName: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ProjectTraceabilityOutcome = {
  id: string;
  projectId: string;
  objectiveId: string;
  deliverableId: string | null;
  deliverableName: string | null;
  milestoneId: string | null;
  milestoneName: string | null;
  metricName: string;
  targetValue: number | null;
  actualValue: number;
  unit: string;
  evidence: string | null;
  measuredAt: string;
  recorderId: string | null;
  recorderName: string;
  objectiveVersion: number;
  objectiveStatement: string;
  createdAt: string;
};
export type ProjectTraceabilityData = {
  origin: ProjectTraceabilityOrigin | null;
  objective: ProjectTraceabilityObjective | null;
  objectiveHistory: ProjectTraceabilityObjective[];
  deliverables: ProjectTraceabilityDeliverable[];
  milestones: ProjectTraceabilityMilestone[];
  outcomes: ProjectTraceabilityOutcome[];
};
export type ProjectObjectiveInput = Pick<ProjectTraceabilityObjective, 'statement'> & {
  successMetric?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  changeReason?: string | null;
};
export type ProjectDeliverableInput = Pick<ProjectTraceabilityDeliverable, 'name'> & {
  description?: string | null;
  status?: ProjectTraceabilityDeliverable['status'];
  cardIds?: string[];
};
export type ProjectRequirementInput = Pick<ProjectTraceabilityRequirement, 'title' | 'acceptanceCriteria'> & {
  description?: string | null;
  requirementType?: ProjectTraceabilityRequirement['requirementType'];
  priority?: ProjectTraceabilityRequirement['priority'];
  status?: ProjectTraceabilityRequirement['status'];
  verificationMethod?: string | null;
  evidence?: string | null;
  cardIds?: string[];
};
export type ProjectOutcomeInput = Pick<ProjectTraceabilityOutcome, 'metricName' | 'actualValue' | 'unit' | 'measuredAt'> & {
  targetValue?: number | null;
  evidence?: string | null;
  deliverableId?: string | null;
  milestoneId?: string | null;
};
export type ProjectDeliverableDeletionImpact = {
  requirementsDeleted: number;
  cardLinksRemoved: number;
  milestonesUnlinked: number;
  outcomesUnlinked: number;
  milestoneLinks: Array<{ id: string; name: string }>;
  outcomeLinks: Array<{
    id: string;
    metricName: string;
    measuredAt: string;
    actualValue: number;
    unit: string;
    milestoneId: string | null;
  }>;
};

async function requireData<T>(request: Promise<{ success: boolean; data?: T; error?: { message?: string } }>): Promise<T> {
  const response = await request;
  if (!response.success || !response.data) throw new Error(response.error?.message || 'No se pudo cargar el proyecto');
  return response.data;
}

export const projectApi = {
  async getTraceability(projectId: string): Promise<ProjectTraceabilityData> {
    return requireData(apiService.get<ProjectTraceabilityData>(`/api/projects/${projectId}/traceability`, true));
  },
  async saveTraceabilityObjective(projectId: string, input: ProjectObjectiveInput): Promise<ProjectTraceabilityObjective> {
    return (await requireData(apiService.put<{ objective: ProjectTraceabilityObjective }>(`/api/projects/${projectId}/traceability/objective`, input, true))).objective;
  },
  async createTraceabilityDeliverable(projectId: string, input: ProjectDeliverableInput): Promise<ProjectTraceabilityDeliverable> {
    return (await requireData(apiService.post<{ deliverable: ProjectTraceabilityDeliverable }>(`/api/projects/${projectId}/traceability/deliverables`, input, true))).deliverable;
  },
  async updateTraceabilityDeliverable(projectId: string, deliverableId: string, input: Partial<ProjectDeliverableInput>): Promise<void> {
    await requireData(apiService.patch<{ id: string }>(`/api/projects/${projectId}/traceability/deliverables/${deliverableId}`, input, true));
  },
  async deleteTraceabilityDeliverable(projectId: string, deliverableId: string): Promise<ProjectDeliverableDeletionImpact> {
    return (await requireData(apiService.delete<{ deleted: boolean; impact: ProjectDeliverableDeletionImpact }>(`/api/projects/${projectId}/traceability/deliverables/${deliverableId}`, true))).impact;
  },
  async createTraceabilityRequirement(projectId: string, deliverableId: string, input: ProjectRequirementInput): Promise<void> {
    await requireData(apiService.post<{ id: string }>(`/api/projects/${projectId}/traceability/deliverables/${deliverableId}/requirements`, input, true));
  },
  async updateTraceabilityRequirement(projectId: string, deliverableId: string, requirementId: string, input: Partial<ProjectRequirementInput>): Promise<void> {
    await requireData(apiService.patch<{ id: string }>(`/api/projects/${projectId}/traceability/deliverables/${deliverableId}/requirements/${requirementId}`, input, true));
  },
  async deleteTraceabilityRequirement(projectId: string, deliverableId: string, requirementId: string): Promise<void> {
    await requireData(apiService.delete<{ deleted: boolean }>(`/api/projects/${projectId}/traceability/deliverables/${deliverableId}/requirements/${requirementId}`, true));
  },
  async linkMilestoneToDeliverable(projectId: string, milestoneId: string, deliverableId: string | null): Promise<void> {
    await requireData(apiService.patch<{ milestoneId: string }>(`/api/projects/${projectId}/traceability/milestones/${milestoneId}/deliverable`, { deliverableId }, true));
  },
  async createMeasuredOutcome(projectId: string, input: ProjectOutcomeInput): Promise<ProjectTraceabilityOutcome> {
    return (await requireData(apiService.post<{ outcome: ProjectTraceabilityOutcome }>(`/api/projects/${projectId}/traceability/outcomes`, input, true))).outcome;
  },
  async deleteMeasuredOutcome(projectId: string, outcomeId: string): Promise<void> {
    await requireData(apiService.delete<{ deleted: boolean }>(`/api/projects/${projectId}/traceability/outcomes/${outcomeId}`, true));
  },
  async getDecisions(projectId: string): Promise<ProjectDecision[]> {
    return (await requireData(apiService.get<{ decisions: ProjectDecision[] }>(`/api/projects/${projectId}/decisions`, true))).decisions;
  },
  async createDecision(projectId: string, input: ProjectDecisionInput): Promise<ProjectDecision> {
    return (await requireData(apiService.post<{ decision: ProjectDecision }>(`/api/projects/${projectId}/decisions`, input, true))).decision;
  },
  async getBaselines(projectId: string): Promise<ProjectBaseline[]> {
    return (await requireData(apiService.get<{ baselines: ProjectBaseline[] }>(`/api/projects/${projectId}/baselines`, true))).baselines;
  },
  async getDocumentation(projectId: string): Promise<ProjectDocumentation> {
    return requireData(apiService.get<ProjectDocumentation>(`/api/projects/${projectId}/documentation`, true));
  },
  async classifyDocument(projectId: string, documentId: string, category: ProjectDocumentCategory): Promise<void> {
    await requireData(apiService.put(`/api/projects/${projectId}/documents/${documentId}/classification`, { category }, true));
  },
  async linkEvidence(projectId: string, input: ProjectEvidenceInput): Promise<ProjectEvidenceLink> {
    return (await requireData(apiService.post<{ evidenceLink: ProjectEvidenceLink }>(`/api/projects/${projectId}/evidence`, input, true))).evidenceLink;
  },
  async setEvidenceStatus(projectId: string, evidenceId: string, status: ProjectEvidenceLink['status']): Promise<ProjectEvidenceLink> {
    return (await requireData(apiService.patch<{ evidenceLink: ProjectEvidenceLink }>(`/api/projects/${projectId}/evidence/${evidenceId}`, { status }, true))).evidenceLink;
  },
  async removeEvidence(projectId: string, evidenceId: string): Promise<void> {
    await requireData(apiService.delete(`/api/projects/${projectId}/evidence/${evidenceId}`, true));
  },
  async createBaseline(projectId: string, input: ProjectBaselineInput): Promise<ProjectBaseline> {
    return (await requireData(apiService.post<{ baseline: ProjectBaseline }>(`/api/projects/${projectId}/baselines`, input, true))).baseline;
  },
  async getRisks(projectId: string): Promise<{ risks: ProjectRisk[]; owners: ProjectRiskOwner[] }> {
    return requireData(apiService.get<{ risks: ProjectRisk[]; owners: ProjectRiskOwner[] }>(`/api/projects/${projectId}/risks`, true));
  },
  async createRisk(projectId: string, input: ProjectRiskInput): Promise<ProjectRisk> {
    return (await requireData(apiService.post<{ risk: ProjectRisk }>(`/api/projects/${projectId}/risks`, input, true))).risk;
  },
  async updateRisk(projectId: string, riskId: string, input: Partial<ProjectRiskInput>): Promise<ProjectRisk> {
    return (await requireData(apiService.patch<{ risk: ProjectRisk }>(`/api/projects/${projectId}/risks/${riskId}`, input, true))).risk;
  },
  async getTeams(projectId: string): Promise<ProjectTeam[]> {
    return (await requireData(apiService.get<{ teams: ProjectTeam[] }>(`/api/projects/${projectId}/teams`, true))).teams;
  },
  async getDirectMembers(projectId: string): Promise<ProjectDirectMember[]> {
    return (await requireData(apiService.get<{ members: ProjectDirectMember[] }>(`/api/projects/${projectId}/members`, true))).members;
  },
  async getActivity(projectId: string, limit = 100): Promise<ProjectActivityEntry[]> {
    return (await requireData(apiService.get<{ events: ProjectActivityEntry[] }>(`/api/projects/${projectId}/activity?limit=${limit}`, true))).events;
  },
  async getBacklog(projectId: string): Promise<ProjectBacklogCard[]> {
    return (await requireData(apiService.get<{ cards: ProjectBacklogCard[] }>(`/api/projects/${projectId}/backlog`, true))).cards;
  },
  async getEpics(projectId: string): Promise<ProjectEpic[]> {
    return (await requireData(apiService.get<{ epics: ProjectEpic[] }>(`/api/projects/${projectId}/epics`, true))).epics;
  },
  async createEpic(projectId: string, data: { name: string; description?: string }): Promise<ProjectEpic> {
    return (await requireData(apiService.post<{ epic: ProjectEpic }>(`/api/projects/${projectId}/epics`, data, true))).epic;
  },
  async updateEpic(projectId: string, epicId: string, data: Partial<Pick<ProjectEpic, 'name' | 'description'>>): Promise<ProjectEpic> {
    return (await requireData(apiService.patch<{ epic: ProjectEpic }>(`/api/projects/${projectId}/epics/${epicId}`, data, true))).epic;
  },
  async deleteEpic(projectId: string, epicId: string): Promise<void> {
    await requireData(apiService.delete(`/api/projects/${projectId}/epics/${epicId}`, true));
  },
  async setCardEpic(projectId: string, cardId: string, epicId: string | null): Promise<void> {
    await requireData(apiService.put(`/api/projects/${projectId}/cards/${cardId}/epic`, { epicId }, true));
  },
  async getTeamMembers(projectId: string): Promise<ProjectTeamMember[]> {
    return (await requireData(apiService.get<{ members: ProjectTeamMember[] }>(`/api/projects/${projectId}/team-members`, true))).members;
  },
  async assignTeam(projectId: string, teamId: string): Promise<void> {
    await requireData(apiService.post(`/api/projects/${projectId}/teams`, { teamId }, true));
  },
  async removeTeam(projectId: string, teamId: string): Promise<void> {
    await requireData(apiService.delete(`/api/projects/${projectId}/teams/${teamId}`, true));
  },
  async addDirectMember(projectId: string, userId: string): Promise<ProjectDirectMember> {
    return (await requireData(apiService.post<{ member: ProjectDirectMember }>(`/api/projects/${projectId}/members`, { userId }, true))).member;
  },
  async removeDirectMember(projectId: string, userId: string): Promise<void> {
    await requireData(apiService.delete(`/api/projects/${projectId}/members/${userId}`, true));
  },
  async updateDirectMemberRole(projectId: string, userId: string, role: string): Promise<void> {
    await requireData(apiService.patch(`/api/projects/${projectId}/members/${userId}`, { role }, true));
  },
  async resetDirectMemberRole(projectId: string, userId: string): Promise<void> {
    await requireData(apiService.delete(`/api/projects/${projectId}/members/${userId}/role`, true));
  },
  async updateScrumAssignment(projectId: string, userId: string, role: ProjectScrumRole): Promise<ProjectScrumAssignment[]> {
    return (await requireData(apiService.patch<{ assignments: ProjectScrumAssignment[] }>(
      `/api/projects/${projectId}/scrum-assignments/${userId}`,
      { role },
      true,
    ))).assignments;
  },
  async updateProductGoal(projectId: string, productGoal: string | null): Promise<void> {
    await requireData(apiService.patch(
      `/api/projects/${projectId}/product-goal`,
      { productGoal },
      true,
    ));
  },
};
