import { Request, Response } from 'express';
import { z } from 'zod';
import { getClient, pool } from '../lib/db';

const stages = ['SUBMITTED', 'TRIAGE', 'DIAGNOSIS', 'VALIDATION', 'APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED'] as const;
type InitiativeStage = (typeof stages)[number];
const participantRoles = ['REQUESTER', 'TRIAGE_COORDINATOR', 'MENTOR', 'EVALUATOR', 'PROJECT_LEAD', 'COLLABORATOR', 'SPONSOR'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const decisionStages = new Set<InitiativeStage>(['APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED']);
const triageAssessmentStatuses = ['PASS', 'FAIL', 'NOT_APPLICABLE'] as const;
const coreProposalFields = ['title', 'description', 'problemStatement', 'impactedPeople', 'problemImpact', 'impactedCount', 'expectedOutcome', 'proposedSolution', 'differentiation'] as const;
const configurableInitiativeFields = [...coreProposalFields, 'proposedNextStep', 'evidence', 'attachments'] as const;
const allowedTransitions: Record<string, InitiativeStage[]> = {
  SUBMITTED: ['TRIAGE', 'PAUSED', 'ARCHIVED'],
  TRIAGE: ['DIAGNOSIS', 'DECLINED', 'PAUSED', 'ARCHIVED'],
  DIAGNOSIS: ['TRIAGE', 'VALIDATION', 'DECLINED', 'PAUSED', 'ARCHIVED'],
  VALIDATION: ['DIAGNOSIS', 'APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED'],
  APPROVED: ['PAUSED', 'ARCHIVED'],
  PAUSED: ['TRIAGE', 'DIAGNOSIS', 'VALIDATION', 'ARCHIVED'],
  DECLINED: ['ARCHIVED'],
  ARCHIVED: [],
};

const initiativeInput = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(1).max(8000),
  problemStatement: z.string().trim().min(1).max(8000),
  impactedPeople: z.string().trim().min(1).max(8000),
  problemImpact: z.string().trim().min(1).max(8000),
  impactedCount: z.number().int().min(1).max(1_000_000_000),
  expectedOutcome: z.string().trim().min(1).max(8000),
  proposedSolution: z.string().trim().min(1).max(8000),
  differentiation: z.string().trim().min(1).max(8000),
  proposedNextStep: z.string().max(2000).optional().nullable(),
  priority: z.enum(priorities).optional(),
  evidence: z.array(z.object({ title: z.string().max(255), url: z.string().url().optional(), note: z.string().max(2000).optional() })).max(30).optional(),
  attachments: z.array(z.object({ name: z.string().max(255), url: z.string().url(), type: z.string().max(100).optional() })).max(30).optional(),
  nextReviewAt: z.string().datetime().optional().nullable(),
});
const updateInput = initiativeInput.omit({ workspaceId: true }).partial();
const triageAssessmentInput = z.array(z.object({ criterion: z.string().trim().min(1).max(300), status: z.enum(triageAssessmentStatuses), note: z.string().trim().max(2000).optional().nullable() })).max(30);
const transitionInput = z.object({ stage: z.enum(stages), decision: z.string().trim().max(30).optional().nullable(), reason: z.string().trim().max(4000).optional().nullable(), nextReviewAt: z.string().datetime().optional().nullable(), triageAssessment: triageAssessmentInput.optional() });
const participantInput = z.object({ userId: z.string().uuid(), role: z.enum(participantRoles) });
const settingsInput = z.object({ initiativeTeamId: z.string().uuid().nullable().optional(), activeStandardId: z.string().uuid().nullable().optional(), intakeEnabled: z.boolean().optional(), triageCriteria: z.array(z.string().trim().min(1).max(300)).max(30).optional(), reviewCadenceDays: z.number().int().min(1).max(365).optional(), requiredInitiativeFields: z.array(z.enum(configurableInitiativeFields)).min(1).optional() });

type InitiativeInput = z.infer<typeof initiativeInput>;

function missingRequiredFields(data: Record<string, any>, requiredFields: unknown): string[] {
  const configured = Array.isArray(requiredFields) ? requiredFields.filter((field): field is (typeof configurableInitiativeFields)[number] => configurableInitiativeFields.includes(field as any)) : [];
  const required = [...new Set<string>([...coreProposalFields, ...configured])];
  return required.filter((field) => {
    const value = data[field];
    return Array.isArray(value) ? value.length === 0 : typeof value === 'string' ? value.trim().length === 0 : !value;
  });
}

function isCoordinator(row: any) {
  return Boolean(row?.internal_member) && Boolean(row?.explicit_coordinator || row?.team_coordinator);
}

function canonicalAuditValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalAuditValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalAuditValue(item)]));
  return value;
}

function validateTriageAssessment(criteriaSnapshot: unknown, assessment: unknown): string | null {
  const criteria = Array.isArray(criteriaSnapshot) ? criteriaSnapshot.filter((criterion): criterion is string => typeof criterion === 'string' && criterion.trim().length > 0) : [];
  if (!criteria.length) return null;
  const values = Array.isArray(assessment) ? assessment : [];
  const byCriterion = new Map<string, any>();
  for (const value of values) {
    if (!value || typeof value.criterion !== 'string' || !triageAssessmentStatuses.includes(value.status)) return 'Each triage assessment must include a valid criterion and status';
    if (byCriterion.has(value.criterion)) return `The criterion "${value.criterion}" was assessed more than once`;
    byCriterion.set(value.criterion, value);
  }
  const unexpected = [...byCriterion.keys()].filter((criterion) => !criteria.includes(criterion));
  if (unexpected.length) return `The triage assessment contains unknown criteria: ${unexpected.join(', ')}`;
  const missing = criteria.filter((criterion) => !byCriterion.has(criterion));
  if (missing.length) return `Complete the configured triage criteria: ${missing.join(', ')}`;
  const failing = criteria.filter((criterion) => byCriterion.get(criterion)?.status === 'FAIL');
  return failing.length ? `Resolve or decline the failed triage criteria before approval: ${failing.join(', ')}` : null;
}

type TriageCursor = { urgent: boolean; nextReviewAt: string | null; createdAt: string; id: string };

function decodeTriageCursor(value: unknown): TriageCursor | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof cursor?.urgent !== 'boolean' || typeof cursor?.createdAt !== 'string' || typeof cursor?.id !== 'string' || (cursor.nextReviewAt !== null && typeof cursor.nextReviewAt !== 'string')) return null;
    return cursor;
  } catch { return null; }
}

function encodeTriageCursor(row: any): string {
  return Buffer.from(JSON.stringify({ urgent: row.priority === 'URGENT', nextReviewAt: row.next_review_at ? new Date(row.next_review_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString(), id: row.id })).toString('base64url');
}

function format(row: any) {
  return {
    id: row.id, workspaceId: row.workspace_id, networkProgramId: row.network_program_id,
    submittedById: row.submitted_by, title: row.title, description: row.description,
    problemStatement: row.problem_statement, impactedPeople: row.impacted_people,
    problemImpact: row.problem_impact, impactedCount: row.impacted_count,
    expectedOutcome: row.expected_outcome, proposedSolution: row.proposed_solution,
    differentiation: row.differentiation, proposedNextStep: row.proposed_next_step,
    priority: row.priority, evidence: row.evidence ?? [], attachments: row.attachments ?? [],
    triageCriteria: row.triage_criteria_snapshot ?? [], triageAssessment: row.triage_assessment ?? [],
    stage: row.stage, decision: row.decision, decisionReason: row.decision_reason,
    receivedAt: row.received_at, nextReviewAt: row.next_review_at, createdAt: row.created_at, updatedAt: row.updated_at,
    requester: row.submitter_id ? { id: row.submitter_id, name: row.submitter_name, email: row.submitter_email, avatar: row.submitter_avatar } : null,
    triageOwner: row.triage_owner_id ? { id: row.triage_owner_id, name: row.triage_owner_name, email: row.triage_owner_email } : null,
    mentor: row.mentor_id ? { id: row.mentor_id, name: row.mentor_name, email: row.mentor_email } : null,
    formalizedProjectId: row.formalized_project_id ?? null,
  };
}

const initiativeSelect = `SELECT i.*, p.id AS formalized_project_id,
  su.id AS submitter_id, su.name AS submitter_name, su.email AS submitter_email, su.avatar AS submitter_avatar,
  tu.id AS triage_owner_id, tu.name AS triage_owner_name, tu.email AS triage_owner_email,
  mu.id AS mentor_id, mu.name AS mentor_name, mu.email AS mentor_email
  FROM initiatives i
  LEFT JOIN projects p ON p.source_initiative_id = i.id
  LEFT JOIN users su ON su.id = i.submitted_by
  LEFT JOIN users tu ON tu.id = i.triage_owner_id
  LEFT JOIN users mu ON mu.id = i.mentor_id`;

async function membership(workspaceId: string, userId: string) {
  const { rows } = await pool.query(`SELECT wm.role, w.owner_id, o.type AS organization_type FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id JOIN organizations o ON o.id = w.organization_id WHERE wm.workspace_id = $1 AND wm.user_id = $2`, [workspaceId, userId]);
  return rows[0] ?? null;
}

async function institutionalAccess(workspaceId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT wm.role, o.type AS organization_type,
      EXISTS(SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = wm.workspace_id AND tm.user_id = wm.user_id AND tm.role = 'ADMIN') AS coordinator
     FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id JOIN organizations o ON o.id = w.organization_id WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
    [workspaceId, userId]
  );
  if (!rows[0]) return null;
  return { isInstitutional: rows[0].organization_type === 'INSTITUTION', isAdmin: ['OWNER', 'ADMIN'].includes(rows[0].role), isCoordinator: Boolean(rows[0].coordinator) };
}

async function access(initiativeId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT i.workspace_id, i.submitted_by, i.stage, o.type AS organization_type, wm.role AS workspace_role, wm.user_id IS NOT NULL AS internal_member,
      EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2) AS participant,
      EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2 AND ip.role = 'TRIAGE_COORDINATOR') AS explicit_coordinator,
      EXISTS(SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = i.workspace_id AND tm.user_id = $2 AND tm.role = 'ADMIN') AS team_coordinator,
      EXISTS(SELECT 1 FROM network_access_grants nag WHERE nag.user_id = $2 AND nag.resource_type = 'INITIATIVE' AND nag.resource_id = i.id AND nag.revoked_at IS NULL AND (nag.expires_at IS NULL OR nag.expires_at > CURRENT_TIMESTAMP)) AS external_access
     FROM initiatives i JOIN workspaces w ON w.id = i.workspace_id JOIN organizations o ON o.id = w.organization_id LEFT JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = $2 WHERE i.id = $1`,
    [initiativeId, userId]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  if (row.organization_type !== 'INSTITUTION') return null;
  return {
    ...row,
    isRequester: Boolean(row.internal_member) && row.submitted_by === userId,
    isParticipant: Boolean(row.internal_member) && Boolean(row.participant),
    isCoordinator: isCoordinator(row),
    isAdmin: Boolean(row.internal_member) && ['OWNER', 'ADMIN'].includes(row.workspace_role),
    isExternal: row.external_access,
  };
}

async function assertWorkspaceUser(workspaceId: string, userId: string) {
  const result = await pool.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
  return Boolean(result.rows[0]);
}

function error(res: Response, status: number, code: string, message: string) { return res.status(status).json({ success: false, error: { code, message } }); }
function userId(req: Request) { return req.user?.id; }

export class InitiativeController {
  async list(req: Request, res: Response) {
    const actorId = userId(req); const workspaceId = req.query.workspaceId as string; const stage = req.query.stage as string | undefined;
    if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!workspaceId || !z.string().uuid().safeParse(workspaceId).success) return error(res, 400, 'VALIDATION_ERROR', 'workspaceId is required');
    const member = await membership(workspaceId, actorId); if (!member) return error(res, 403, 'FORBIDDEN', 'Workspace access required');
    if (member.organization_type !== 'INSTITUTION') return error(res, 409, 'INSTITUTIONAL_CONTEXT_REQUIRED', 'Initiatives are available only in institutional organizations');
    const params: unknown[] = [workspaceId, actorId]; let where = `i.workspace_id = $1 AND EXISTS (SELECT 1 FROM workspace_members current_member WHERE current_member.workspace_id = i.workspace_id AND current_member.user_id = $2) AND (i.submitted_by = $2 OR EXISTS (SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2) OR EXISTS (SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = i.workspace_id AND tm.user_id = $2 AND tm.role = 'ADMIN') OR $3::boolean)`;
    params.push(['OWNER', 'ADMIN'].includes(member.role));
    if (stage && stages.includes(stage as any)) { params.push(stage); where += ` AND i.stage = $${params.length}`; }
    const limitResult = z.coerce.number().int().min(1).max(100).safeParse(req.query.limit ?? 50);
    if (!limitResult.success) return error(res, 400, 'VALIDATION_ERROR', 'limit must be between 1 and 100');
    const cursor = decodeTriageCursor(req.query.cursor);
    if (req.query.cursor && !cursor) return error(res, 400, 'VALIDATION_ERROR', 'Invalid triage cursor');
    if (cursor) {
      const urgentPosition = params.push(cursor.urgent ? 1 : 0);
      const reviewPosition = params.push(cursor.nextReviewAt);
      const createdPosition = params.push(cursor.createdAt);
      const idPosition = params.push(cursor.id);
      const priorityRank = `CASE WHEN i.priority = 'URGENT' THEN 1 ELSE 0 END`;
      const reviewValue = `COALESCE(i.next_review_at, 'infinity'::timestamp)`;
      const cursorReview = `COALESCE($${reviewPosition}::timestamp, 'infinity'::timestamp)`;
      where += ` AND (${priorityRank} < $${urgentPosition} OR (${priorityRank} = $${urgentPosition} AND ${reviewValue} > ${cursorReview}) OR (${priorityRank} = $${urgentPosition} AND ${reviewValue} = ${cursorReview} AND i.created_at < $${createdPosition}::timestamp) OR (${priorityRank} = $${urgentPosition} AND ${reviewValue} = ${cursorReview} AND i.created_at = $${createdPosition}::timestamp AND i.id < $${idPosition}::uuid))`;
    }
    params.push(limitResult.data + 1);
    const result = await pool.query(`${initiativeSelect} WHERE ${where} ORDER BY i.priority = 'URGENT' DESC, i.next_review_at ASC NULLS LAST, i.created_at DESC, i.id DESC LIMIT $${params.length}`, params);
    const hasMore = result.rows.length > limitResult.data;
    const rows = hasMore ? result.rows.slice(0, limitResult.data) : result.rows;
    return res.json({ success: true, data: { initiatives: rows.map(format), nextCursor: hasMore && rows.length ? encodeTriageCursor(rows[rows.length - 1]) : null } });
  }

  async getById(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const gate = await access(req.params.id, actorId); if (!gate || !(gate.isRequester || gate.isParticipant || gate.isCoordinator || gate.isAdmin || gate.isExternal)) return error(res, 403, 'FORBIDDEN', 'Initiative access required');
    const externalOnly = gate.isExternal && !gate.internal_member;
    if (gate.isExternal) await pool.query(`INSERT INTO network_access_audits (id, network_id, user_id, resource_type, resource_id, action) SELECT gen_random_uuid(), network_id, $2, 'INITIATIVE'::"NetworkResourceType", $1, 'VIEWED_RESOURCE' FROM network_access_grants WHERE user_id = $2 AND resource_type = 'INITIATIVE' AND resource_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1`, [req.params.id, actorId]);
    const [initiative, participants, history, assignmentHistory, contentHistory] = await Promise.all([
      pool.query(`${initiativeSelect} WHERE i.id = $1`, [req.params.id]),
      pool.query(`SELECT ip.id, ip.role, ip.assigned_at, u.id AS user_id, u.name, u.email, u.avatar FROM initiative_participants ip JOIN users u ON u.id = ip.user_id WHERE ip.initiative_id = $1 ORDER BY ip.assigned_at`, [req.params.id]),
      pool.query(`SELECT h.*, u.name AS actor_name FROM initiative_workflow_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.initiative_id = $1 ORDER BY h.created_at DESC`, [req.params.id]),
      pool.query(`SELECT h.*, subject.name AS subject_name, actor.name AS actor_name FROM initiative_assignment_history h LEFT JOIN users subject ON subject.id = h.subject_user_id LEFT JOIN users actor ON actor.id = h.actor_id WHERE h.initiative_id = $1 ORDER BY h.created_at DESC, h.id DESC`, [req.params.id]),
      externalOnly ? Promise.resolve({ rows: [] }) : pool.query(`SELECT h.*, u.name AS actor_name FROM initiative_content_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.initiative_id = $1 ORDER BY h.created_at DESC, h.id DESC`, [req.params.id]),
    ]);
    const formatted = format(initiative.rows[0]);
    const safeInitiative = externalOnly ? {
      id: formatted.id, title: formatted.title, description: formatted.description,
      problemStatement: formatted.problemStatement, impactedPeople: formatted.impactedPeople,
      problemImpact: formatted.problemImpact, impactedCount: formatted.impactedCount,
      expectedOutcome: formatted.expectedOutcome, proposedSolution: formatted.proposedSolution,
      differentiation: formatted.differentiation, proposedNextStep: formatted.proposedNextStep,
      priority: formatted.priority, evidence: formatted.evidence, attachments: formatted.attachments,
      stage: formatted.stage, receivedAt: formatted.receivedAt, nextReviewAt: formatted.nextReviewAt,
      createdAt: formatted.createdAt, updatedAt: formatted.updatedAt,
    } : formatted;
    return res.json({ success: true, data: {
      initiative: safeInitiative,
      access: {
        canRead: true,
        canEdit: !externalOnly && (gate.isCoordinator || (gate.isRequester && ['SUBMITTED', 'TRIAGE'].includes(gate.stage))),
        canManage: !externalOnly && gate.isCoordinator,
        isExternal: externalOnly,
      },
      participants: externalOnly ? [] : participants.rows.map((r: any) => ({ id: r.id, role: r.role, assignedAt: r.assigned_at, user: { id: r.user_id, name: r.name, email: r.email, avatar: r.avatar } })),
      history: externalOnly ? [] : history.rows.map((r: any) => ({ id: r.id, fromStage: r.from_stage, toStage: r.to_stage, decision: r.decision, reason: r.reason, triageAssessment: r.triage_assessment, nextReviewAt: r.next_review_at, actorId: r.actor_id, actorName: r.actor_name, createdAt: r.created_at })),
      assignmentHistory: externalOnly ? [] : assignmentHistory.rows.map((r: any) => ({ id: r.id, subjectUserId: r.subject_user_id, subjectName: r.subject_name, role: r.role, action: r.action, actorId: r.actor_id, actorName: r.actor_name, reason: r.reason, createdAt: r.created_at })),
      contentHistory: contentHistory.rows.map((r: any) => ({ id: r.id, actorId: r.actor_id, actorName: r.actor_name, changes: r.changes, createdAt: r.created_at })),
    } });
  }

  async create(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = initiativeInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid initiative data');
    const data = parsed.data;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const activeMembership = await client.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 FOR KEY SHARE`, [data.workspaceId, actorId]);
      if (!activeMembership.rows[0]) { await client.query('ROLLBACK'); return error(res, 403, 'FORBIDDEN', 'Workspace access required'); }
      const settings = await client.query(
        `SELECT o.type AS organization_type, wm.user_id IS NOT NULL AS member, COALESCE(s.intake_enabled, true) AS intake_enabled,
          COALESCE(s.review_cadence_days, 7) AS review_cadence_days,
          COALESCE(s.required_initiative_fields, '["title", "description", "problemStatement", "impactedPeople", "problemImpact", "impactedCount", "expectedOutcome", "proposedSolution", "differentiation"]'::jsonb) AS required_initiative_fields,
          COALESCE(s.triage_criteria, '[]'::jsonb) AS triage_criteria
         FROM workspaces w
         JOIN organizations o ON o.id = w.organization_id
         LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
         LEFT JOIN workspace_institutional_settings s ON s.workspace_id = w.id
         WHERE w.id = $1 FOR SHARE OF w`,
        [data.workspaceId, actorId]
      );
      const setting = settings.rows[0];
      if (!setting?.member) { await client.query('ROLLBACK'); return error(res, 403, 'FORBIDDEN', 'Workspace access required'); }
      if (setting.organization_type !== 'INSTITUTION') { await client.query('ROLLBACK'); return error(res, 409, 'INSTITUTIONAL_CONTEXT_REQUIRED', 'Initiatives are available only in institutional organizations'); }
      if (!setting.intake_enabled) { await client.query('ROLLBACK'); return error(res, 409, 'INTAKE_DISABLED', 'Initiative intake is currently disabled for this workspace'); }
      // The nine proposal fields are required at submission. Workspace-specific
      // operational requirements (evidence, attachments, next step) are checked
      // later, before formalization, so requesters can submit an initial proposal.
      const missing = missingRequiredFields(data, []);
      if (missing.length) { await client.query('ROLLBACK'); return error(res, 400, 'REQUIRED_INITIATIVE_FIELDS', `Complete the required fields: ${missing.join(', ')}`); }
      const result = await client.query(`INSERT INTO initiatives (id, workspace_id, submitted_by, title, description, problem_statement, impacted_people, problem_impact, impacted_count, expected_outcome, proposed_solution, differentiation, proposed_next_step, priority, evidence, attachments, next_review_at, triage_criteria_snapshot) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, COALESCE($16, CURRENT_TIMESTAMP + ($17 * INTERVAL '1 day')), $18::jsonb) RETURNING *`, [data.workspaceId, actorId, data.title, data.description, data.problemStatement, data.impactedPeople, data.problemImpact, data.impactedCount, data.expectedOutcome, data.proposedSolution, data.differentiation, data.proposedNextStep ?? null, data.priority ?? 'MEDIUM', JSON.stringify(data.evidence ?? []), JSON.stringify(data.attachments ?? []), data.nextReviewAt ?? null, setting.review_cadence_days, JSON.stringify(setting.triage_criteria)]);
      const initiative = result.rows[0];
      await client.query(`INSERT INTO initiative_participants (id, initiative_id, user_id, role, assigned_by) VALUES (gen_random_uuid(), $1, $2, 'REQUESTER', $2) ON CONFLICT DO NOTHING`, [initiative.id, actorId]);
      await client.query(`INSERT INTO initiative_assignment_history (id, initiative_id, subject_user_id, role, action, actor_id, reason) VALUES (gen_random_uuid(), $1, $2, 'REQUESTER', 'ASSIGNED', $2, 'Initiative submitted')`, [initiative.id, actorId]);
      await client.query(`INSERT INTO initiative_workflow_history (id, initiative_id, to_stage, reason, actor_id) VALUES (gen_random_uuid(), $1, 'SUBMITTED', 'Iniciativa recibida', $2)`, [initiative.id, actorId]);
      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { initiative: format(initiative) } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async update(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = updateInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid initiative data');
    const gate = await access(req.params.id, actorId); if (!gate) return error(res, 404, 'NOT_FOUND', 'Initiative not found');
    if (!gate.isCoordinator && !(gate.isRequester && ['SUBMITTED', 'TRIAGE'].includes(gate.stage))) return error(res, 403, 'FORBIDDEN', 'Only the requester before evaluation or a triage coordinator can edit this initiative');
    const data = parsed.data; const fields: string[] = []; const values: any[] = [];
    const dbFields: Record<string, string> = { title: 'title', description: 'description', problemStatement: 'problem_statement', impactedPeople: 'impacted_people', problemImpact: 'problem_impact', impactedCount: 'impacted_count', expectedOutcome: 'expected_outcome', proposedSolution: 'proposed_solution', differentiation: 'differentiation', proposedNextStep: 'proposed_next_step', priority: 'priority', evidence: 'evidence', attachments: 'attachments', nextReviewAt: 'next_review_at' };
    for (const [key, column] of Object.entries(dbFields)) if (key in data) { values.push(['evidence', 'attachments'].includes(key) ? JSON.stringify((data as any)[key] ?? []) : (data as any)[key]); fields.push(`${column} = $${values.length}${['evidence', 'attachments'].includes(key) ? '::jsonb' : ''}`); }
    if (!fields.length) return this.getById(req, res);
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const currentAccess = await client.query(
        `SELECT i.*
         FROM initiatives i
         JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = $2
         WHERE i.id = $1 AND (
           (i.submitted_by = $2 AND i.stage IN ('SUBMITTED', 'TRIAGE'))
           OR EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2 AND ip.role = 'TRIAGE_COORDINATOR')
           OR EXISTS(SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = i.workspace_id AND tm.user_id = $2 AND tm.role = 'ADMIN')
         ) FOR UPDATE OF i FOR KEY SHARE OF wm`,
        [req.params.id, actorId]
      );
      if (!currentAccess.rows[0]) { await client.query('ROLLBACK'); return error(res, 403, 'FORBIDDEN', 'Current initiative access is required'); }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [key, column] of Object.entries(dbFields)) {
        if (!(key in data)) continue;
        const from = canonicalAuditValue(currentAccess.rows[0][column]);
        const to = canonicalAuditValue((data as any)[key]);
        if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
      }
      if (Object.keys(changes).length === 0) { await client.query('ROLLBACK'); return res.json({ success: true, data: { initiative: format(currentAccess.rows[0]) } }); }
      values.push(req.params.id);
      const result = await client.query(`UPDATE initiatives SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`, values);
      await client.query(`INSERT INTO initiative_content_history (initiative_id, actor_id, changes) VALUES ($1, $2, $3::jsonb)`, [req.params.id, actorId, JSON.stringify(changes)]);
      await client.query('COMMIT');
      return res.json({ success: true, data: { initiative: format(result.rows[0]) } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async addParticipant(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = participantInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid participant');
    const gate = await access(req.params.id, actorId); if (!gate || !gate.isCoordinator) return error(res, 403, 'FORBIDDEN', 'A triage coordinator is required');
    if (!(await assertWorkspaceUser(gate.workspace_id, parsed.data.userId))) return error(res, 400, 'VALIDATION_ERROR', 'Participant must belong to the workspace');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const coordinator = await client.query(
        `SELECT i.workspace_id
         FROM initiatives i
         JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = $2
         WHERE i.id = $1 AND (
           EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2 AND ip.role = 'TRIAGE_COORDINATOR')
           OR EXISTS(SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = i.workspace_id AND tm.user_id = $2 AND tm.role = 'ADMIN')
         ) FOR UPDATE OF i FOR KEY SHARE OF wm`,
        [req.params.id, actorId]
      );
      if (!coordinator.rows[0]) { await client.query('ROLLBACK'); return error(res, 403, 'FORBIDDEN', 'A triage coordinator with current workspace access is required'); }
      const targetMembership = await client.query(`SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 FOR KEY SHARE`, [coordinator.rows[0].workspace_id, parsed.data.userId]);
      if (!targetMembership.rows[0]) { await client.query('ROLLBACK'); return error(res, 400, 'VALIDATION_ERROR', 'Participant must belong to the workspace'); }
      const result = await client.query(`INSERT INTO initiative_participants (id, initiative_id, user_id, role, assigned_by) VALUES (gen_random_uuid(), $1, $2, $3, $4) ON CONFLICT (initiative_id, user_id, role) DO NOTHING RETURNING *`, [req.params.id, parsed.data.userId, parsed.data.role, actorId]);
      const participant = result.rows[0] ?? (await client.query(`SELECT * FROM initiative_participants WHERE initiative_id = $1 AND user_id = $2 AND role = $3`, [req.params.id, parsed.data.userId, parsed.data.role])).rows[0];
      if (parsed.data.role === 'TRIAGE_COORDINATOR') await client.query(`UPDATE initiatives SET triage_owner_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id, parsed.data.userId]);
      if (parsed.data.role === 'MENTOR') await client.query(`UPDATE initiatives SET mentor_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id, parsed.data.userId]);
      if (result.rows[0]) await client.query(`INSERT INTO initiative_assignment_history (id, initiative_id, subject_user_id, role, action, actor_id) VALUES (gen_random_uuid(), $1, $2, $3, 'ASSIGNED', $4)`, [req.params.id, parsed.data.userId, parsed.data.role, actorId]);
      await client.query('COMMIT');
      return res.status(result.rows[0] ? 201 : 200).json({ success: true, data: { participant } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async removeParticipant(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const gate = await access(req.params.id, actorId); if (!gate || !gate.isCoordinator) return error(res, 403, 'FORBIDDEN', 'A triage coordinator is required');
    if (!z.string().uuid().safeParse(req.params.userId).success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid participant');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const coordinator = await client.query(
        `SELECT 1
         FROM initiatives i
         JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = $2
         WHERE i.id = $1 AND (
           EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2 AND ip.role = 'TRIAGE_COORDINATOR')
           OR EXISTS(SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = i.workspace_id AND tm.user_id = $2 AND tm.role = 'ADMIN')
         ) FOR UPDATE OF i FOR KEY SHARE OF wm`,
        [req.params.id, actorId]
      );
      if (!coordinator.rows[0]) { await client.query('ROLLBACK'); return error(res, 403, 'FORBIDDEN', 'A triage coordinator with current workspace access is required'); }
      const removed = await client.query(`DELETE FROM initiative_participants WHERE initiative_id = $1 AND user_id = $2 AND role <> 'REQUESTER' RETURNING role`, [req.params.id, req.params.userId]);
      for (const row of removed.rows) await client.query(`INSERT INTO initiative_assignment_history (id, initiative_id, subject_user_id, role, action, actor_id) VALUES (gen_random_uuid(), $1, $2, $3, 'REMOVED', $4)`, [req.params.id, req.params.userId, row.role, actorId]);
      await client.query(
        `UPDATE initiatives i
         SET triage_owner_id = CASE WHEN i.triage_owner_id = $2 THEN (
               SELECT ip.user_id FROM initiative_participants ip
               WHERE ip.initiative_id = i.id AND ip.role = 'TRIAGE_COORDINATOR'
               ORDER BY ip.assigned_at DESC LIMIT 1
             ) ELSE i.triage_owner_id END,
             mentor_id = CASE WHEN i.mentor_id = $2 THEN (
               SELECT ip.user_id FROM initiative_participants ip
               WHERE ip.initiative_id = i.id AND ip.role = 'MENTOR'
               ORDER BY ip.assigned_at DESC LIMIT 1
             ) ELSE i.mentor_id END,
             updated_at = CURRENT_TIMESTAMP
         WHERE i.id = $1 AND (i.triage_owner_id = $2 OR i.mentor_id = $2)`,
        [req.params.id, req.params.userId]
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: { message: 'Participant removed' } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async transition(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = transitionInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid transition');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT i.*, wm.user_id IS NOT NULL AS internal_member,
          EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2 AND ip.role = 'TRIAGE_COORDINATOR') AS explicit_coordinator,
          EXISTS(SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = i.workspace_id AND tm.user_id = $2 AND tm.role = 'ADMIN') AS team_coordinator,
          COALESCE(s.review_cadence_days, 7) AS review_cadence_days
         FROM initiatives i
         JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = $2
         LEFT JOIN workspace_institutional_settings s ON s.workspace_id = i.workspace_id
         WHERE i.id = $1 FOR UPDATE OF i FOR KEY SHARE OF wm`,
        [req.params.id, actorId]
      );
      const initiative = locked.rows[0];
      if (!initiative) { await client.query('ROLLBACK'); return error(res, 404, 'NOT_FOUND', 'Initiative not found'); }
      if (!isCoordinator(initiative)) { await client.query('ROLLBACK'); return error(res, 403, 'FORBIDDEN', 'Only a triage coordinator can change the institutional flow'); }
      if (parsed.data.stage === initiative.stage) { await client.query('ROLLBACK'); return error(res, 409, 'NO_STAGE_CHANGE', 'Select a different stage to register a transition'); }
      if (!allowedTransitions[initiative.stage]?.includes(parsed.data.stage)) { await client.query('ROLLBACK'); return error(res, 409, 'INVALID_TRANSITION', `The transition from ${initiative.stage} to ${parsed.data.stage} is not allowed`); }
      if (decisionStages.has(parsed.data.stage) && (!parsed.data.decision || !parsed.data.reason)) { await client.query('ROLLBACK'); return error(res, 400, 'DECISION_REASON_REQUIRED', 'This decision requires both a decision and a reason'); }
      const assessment = parsed.data.triageAssessment ?? initiative.triage_assessment ?? [];
      if (parsed.data.stage === 'APPROVED') {
        const assessmentError = validateTriageAssessment(initiative.triage_criteria_snapshot, assessment);
        if (assessmentError) { await client.query('ROLLBACK'); return error(res, 409, 'TRIAGE_CRITERIA_INCOMPLETE', assessmentError); }
      }
      const result = await client.query(
        `UPDATE initiatives
         SET stage = $2,
             decision = CASE WHEN $2 IN ('APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED') THEN $3 ELSE NULL END,
             decision_reason = CASE WHEN $2 IN ('APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED') THEN $4 ELSE NULL END,
             next_review_at = COALESCE($5, CASE WHEN $2 IN ('APPROVED', 'DECLINED', 'ARCHIVED') THEN NULL ELSE CURRENT_TIMESTAMP + ($7 * INTERVAL '1 day') END),
             triage_owner_id = COALESCE(triage_owner_id, $6), triage_assessment = $9::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND stage = $8 RETURNING *`,
        [req.params.id, parsed.data.stage, parsed.data.decision ?? null, parsed.data.reason ?? null, parsed.data.nextReviewAt ?? null, actorId, initiative.review_cadence_days, initiative.stage, JSON.stringify(assessment)]
      );
      if (!result.rows[0]) { await client.query('ROLLBACK'); return error(res, 409, 'STALE_INITIATIVE', 'The initiative changed before this decision could be saved'); }
      await client.query(`INSERT INTO initiative_workflow_history (id, initiative_id, from_stage, to_stage, decision, reason, actor_id, triage_assessment, next_review_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb, $8)`, [req.params.id, initiative.stage, parsed.data.stage, parsed.data.decision ?? null, parsed.data.reason ?? null, actorId, JSON.stringify(assessment), result.rows[0].next_review_at]);
      await client.query('COMMIT'); return res.json({ success: true, data: { initiative: format(result.rows[0]) } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async convert(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT i.*, wm.user_id IS NOT NULL AS internal_member,
          EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2 AND ip.role = 'TRIAGE_COORDINATOR') AS explicit_coordinator,
          EXISTS(SELECT 1 FROM workspace_institutional_settings s JOIN team_members tm ON tm.team_id = s.initiative_team_id WHERE s.workspace_id = i.workspace_id AND tm.user_id = $2 AND tm.role = 'ADMIN') AS team_coordinator,
          COALESCE(s.required_initiative_fields, '["title", "description", "problemStatement", "impactedPeople", "problemImpact", "impactedCount", "expectedOutcome", "proposedSolution", "differentiation"]'::jsonb) AS required_initiative_fields,
          s.active_standard_id
         FROM initiatives i
         JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = $2
         LEFT JOIN workspace_institutional_settings s ON s.workspace_id = i.workspace_id
         WHERE i.id = $1 FOR UPDATE OF i FOR KEY SHARE OF wm`,
        [req.params.id, actorId]
      );
      const i = locked.rows[0];
      if (!i) { await client.query('ROLLBACK'); return error(res, 404, 'NOT_FOUND', 'Initiative not found'); }
      if (!isCoordinator(i)) { await client.query('ROLLBACK'); return error(res, 403, 'FORBIDDEN', 'A triage coordinator is required'); }
      if (i.stage !== 'APPROVED') { await client.query('ROLLBACK'); return error(res, 409, 'INVALID_TRANSITION', 'Only approved initiatives can become projects'); }
      const missing = missingRequiredFields({ title: i.title, description: i.description, problemStatement: i.problem_statement, impactedPeople: i.impacted_people, problemImpact: i.problem_impact, impactedCount: i.impacted_count, expectedOutcome: i.expected_outcome, proposedSolution: i.proposed_solution, differentiation: i.differentiation, proposedNextStep: i.proposed_next_step, evidence: i.evidence, attachments: i.attachments }, i.required_initiative_fields);
      if (missing.length) { await client.query('ROLLBACK'); return error(res, 409, 'FORMALIZATION_FIELDS_REQUIRED', `Complete the required fields before formalizing: ${missing.join(', ')}`); }
      const assessmentError = validateTriageAssessment(i.triage_criteria_snapshot, i.triage_assessment);
      if (assessmentError) { await client.query('ROLLBACK'); return error(res, 409, 'TRIAGE_CRITERIA_INCOMPLETE', assessmentError); }
      const existing = await client.query(`SELECT id FROM projects WHERE source_initiative_id = $1`, [i.id]); if (existing.rows[0]) { await client.query('ROLLBACK'); return res.json({ success: true, data: { projectId: existing.rows[0].id, alreadyConverted: true } }); }
      const lead = await client.query(`SELECT ip.user_id FROM initiative_participants ip JOIN workspace_members wm ON wm.workspace_id = $2 AND wm.user_id = ip.user_id WHERE ip.initiative_id = $1 AND ip.role = 'PROJECT_LEAD' ORDER BY ip.assigned_at LIMIT 1`, [i.id, i.workspace_id]);
      const validTriageOwner = i.triage_owner_id ? await client.query(`SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [i.workspace_id, i.triage_owner_id]) : { rows: [] };
      const ownerId = lead.rows[0]?.user_id ?? validTriageOwner.rows[0]?.user_id ?? actorId;
      const standard = await client.query(`SELECT id, version FROM workspace_project_standards WHERE workspace_id = $2 AND is_active = true AND ($1::uuid IS NULL OR id = $1) ORDER BY version DESC, updated_at DESC LIMIT 1`, [i.active_standard_id, i.workspace_id]);
      if (!standard.rows[0]) { await client.query('ROLLBACK'); return error(res, 409, 'FORMALIZATION_STANDARD_REQUIRED', 'Select an active institutional standard before formalizing an initiative'); }
      const project = await client.query(`INSERT INTO projects (id, workspace_id, source_initiative_id, name, description, status, maturity_stage, problem_statement, impacted_people, problem_impact, impacted_count, expected_outcome, proposed_solution, differentiation, next_step, owner_id, formalized_at, applied_standard_id, applied_standard_version, standard_applied_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, 'PLANNING', 'FORMALIZED', $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`, [i.workspace_id, i.id, i.title, i.description, i.problem_statement, i.impacted_people, i.problem_impact, i.impacted_count, i.expected_outcome, i.proposed_solution, i.differentiation, i.proposed_next_step, ownerId, standard.rows[0].id, standard.rows[0].version]);
      const projectId = project.rows[0].id;
    const board = await client.query(`INSERT INTO boards (id, workspace_id, name, description, position, created_by, color) VALUES (gen_random_uuid(), $1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM boards WHERE workspace_id = $1), 0), $4, '#F2571E') RETURNING id`, [i.workspace_id, `Ejecución - ${i.title}`, 'Tablero inicial creado desde una iniciativa aprobada.', actorId]);
      await client.query(`INSERT INTO project_boards (id, project_id, board_id) VALUES (gen_random_uuid(), $1, $2)`, [projectId, board.rows[0].id]);
      await client.query(`INSERT INTO project_milestones (id, project_id, name, description, date, color) VALUES (gen_random_uuid(), $1, 'Definir plan inicial', 'Primer hito generado al formalizar la iniciativa.', CURRENT_DATE + INTERVAL '7 days', '#F59E0B')`, [projectId]);
      await client.query(`INSERT INTO project_teams (id, project_id, team_id, assigned_by) SELECT gen_random_uuid(), $1, s.initiative_team_id, $2 FROM workspace_institutional_settings s JOIN teams t ON t.id = s.initiative_team_id AND t.workspace_id = s.workspace_id WHERE s.workspace_id = $3 AND s.initiative_team_id IS NOT NULL ON CONFLICT DO NOTHING`, [projectId, actorId, i.workspace_id]);
      await client.query(`INSERT INTO project_role_assignments (id, project_id, user_id, role, is_primary, assigned_by) SELECT gen_random_uuid(), $1, ip.user_id, CASE ip.role WHEN 'REQUESTER' THEN 'REQUESTER'::"ProjectOperationalRole" WHEN 'TRIAGE_COORDINATOR' THEN 'TRIAGE_COORDINATOR'::"ProjectOperationalRole" WHEN 'MENTOR' THEN 'MENTOR'::"ProjectOperationalRole" WHEN 'EVALUATOR' THEN 'EVALUATOR'::"ProjectOperationalRole" WHEN 'PROJECT_LEAD' THEN 'PROJECT_LEAD'::"ProjectOperationalRole" WHEN 'COLLABORATOR' THEN 'COLLABORATOR'::"ProjectOperationalRole" ELSE 'COLLABORATOR'::"ProjectOperationalRole" END, ip.role = 'PROJECT_LEAD', $2 FROM initiative_participants ip JOIN workspace_members wm ON wm.workspace_id = $4 AND wm.user_id = ip.user_id WHERE ip.initiative_id = $3 ON CONFLICT DO NOTHING`, [projectId, actorId, i.id, i.workspace_id]);
      await client.query(`INSERT INTO project_role_assignments (id, project_id, user_id, role, is_primary, assigned_by) SELECT gen_random_uuid(), $1, $2, 'PROJECT_LEAD', true, $3 WHERE NOT EXISTS (SELECT 1 FROM project_role_assignments WHERE project_id = $1 AND role = 'PROJECT_LEAD') ON CONFLICT DO NOTHING`, [projectId, ownerId, actorId]);
      await client.query(`INSERT INTO initiative_workflow_history (id, initiative_id, from_stage, to_stage, decision, reason, actor_id) VALUES (gen_random_uuid(), $1, 'APPROVED', 'APPROVED', 'FORMALIZED', 'Iniciativa convertida en proyecto: ' || $2, $3)`, [i.id, projectId, actorId]);
      await client.query('COMMIT'); return res.status(201).json({ success: true, data: { projectId, boardId: board.rows[0].id } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async getSettings(req: Request, res: Response) {
    const actorId = userId(req); const workspaceId = req.params.workspaceId; if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required'); const gate = await institutionalAccess(workspaceId, actorId); if (!gate || (!gate.isAdmin && !gate.isCoordinator)) return error(res, 403, 'FORBIDDEN', 'Institutional administration or triage access is required'); if (!gate.isInstitutional) return error(res, 409, 'INSTITUTIONAL_CONTEXT_REQUIRED', 'Institutional settings are available only in institutional organizations');
    const requiredDefaults = ['title', 'description', 'problemStatement', 'impactedPeople', 'problemImpact', 'impactedCount', 'expectedOutcome', 'proposedSolution', 'differentiation'];
    const result = await pool.query(`SELECT w.id AS workspace_id, s.initiative_team_id, s.active_standard_id, COALESCE(s.intake_enabled, true) AS intake_enabled, COALESCE(s.triage_criteria, '[]'::jsonb) AS triage_criteria, COALESCE(s.review_cadence_days, 7) AS review_cadence_days, COALESCE(s.required_initiative_fields, '["title", "description", "problemStatement", "impactedPeople", "problemImpact", "impactedCount", "expectedOutcome", "proposedSolution", "differentiation"]'::jsonb) AS required_initiative_fields FROM workspaces w LEFT JOIN workspace_institutional_settings s ON s.workspace_id = w.id WHERE w.id = $1`, [workspaceId]);
    return res.json({ success: true, data: { settings: result.rows[0] ?? { workspace_id: workspaceId, intake_enabled: true, triage_criteria: [], review_cadence_days: 7, required_initiative_fields: requiredDefaults } } });
  }

  async updateSettings(req: Request, res: Response) {
    const actorId = userId(req); const workspaceId = req.params.workspaceId; if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required'); const gate = await institutionalAccess(workspaceId, actorId); if (!gate || !gate.isAdmin) return error(res, 403, 'FORBIDDEN', 'Workspace administration is required'); if (!gate.isInstitutional) return error(res, 409, 'INSTITUTIONAL_CONTEXT_REQUIRED', 'Institutional settings are available only in institutional organizations');
    const parsed = settingsInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid institutional settings'); const d = parsed.data;
    if (d.initiativeTeamId) { const valid = await pool.query(`SELECT 1 FROM teams WHERE id = $1 AND workspace_id = $2`, [d.initiativeTeamId, workspaceId]); if (!valid.rows[0]) return error(res, 400, 'VALIDATION_ERROR', 'Initiative team must belong to the workspace'); }
    if (d.activeStandardId) { const valid = await pool.query(`SELECT 1 FROM workspace_project_standards WHERE id = $1 AND workspace_id = $2 AND is_active = true`, [d.activeStandardId, workspaceId]); if (!valid.rows[0]) return error(res, 400, 'VALIDATION_ERROR', 'Standard must be active and belong to the workspace'); }
    const requiredDefaults = ['title', 'description', 'problemStatement', 'impactedPeople', 'problemImpact', 'impactedCount', 'expectedOutcome', 'proposedSolution', 'differentiation'];
    const configuredFields = d.requiredInitiativeFields ? [...new Set([...requiredDefaults, ...d.requiredInitiativeFields])] : null;
    const result = await pool.query(`INSERT INTO workspace_institutional_settings (workspace_id, initiative_team_id, active_standard_id, intake_enabled, triage_criteria, review_cadence_days, required_initiative_fields) VALUES ($1, $2, $3, COALESCE($4, true), COALESCE($5::jsonb, '[]'::jsonb), COALESCE($6, 7), COALESCE($7::jsonb, '["title", "description", "problemStatement", "impactedPeople", "problemImpact", "impactedCount", "expectedOutcome", "proposedSolution", "differentiation"]'::jsonb)) ON CONFLICT (workspace_id) DO UPDATE SET initiative_team_id = CASE WHEN $8 THEN $2 ELSE workspace_institutional_settings.initiative_team_id END, active_standard_id = CASE WHEN $9 THEN $3 ELSE workspace_institutional_settings.active_standard_id END, intake_enabled = COALESCE($4, workspace_institutional_settings.intake_enabled), triage_criteria = COALESCE($5::jsonb, workspace_institutional_settings.triage_criteria), review_cadence_days = COALESCE($6, workspace_institutional_settings.review_cadence_days), required_initiative_fields = COALESCE($7::jsonb, workspace_institutional_settings.required_initiative_fields), updated_at = CURRENT_TIMESTAMP RETURNING *`, [workspaceId, d.initiativeTeamId ?? null, d.activeStandardId ?? null, d.intakeEnabled, d.triageCriteria ? JSON.stringify(d.triageCriteria) : null, d.reviewCadenceDays, configuredFields ? JSON.stringify(configuredFields) : null, d.initiativeTeamId !== undefined, d.activeStandardId !== undefined]);
    return res.json({ success: true, data: { settings: result.rows[0] } });
  }

  async reports(req: Request, res: Response) {
    const actorId = userId(req); const workspaceId = req.query.workspaceId as string; if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required'); if (!workspaceId) return error(res, 400, 'VALIDATION_ERROR', 'workspaceId is required'); const gate = await institutionalAccess(workspaceId, actorId); if (!gate || (!gate.isAdmin && !gate.isCoordinator)) return error(res, 403, 'FORBIDDEN', 'Institutional administration or triage access is required'); if (!gate.isInstitutional) return error(res, 409, 'INSTITUTIONAL_CONTEXT_REQUIRED', 'Institutional reports are available only in institutional organizations');
    const totals = await pool.query(`SELECT COUNT(*) FILTER (WHERE true)::int AS received, COUNT(*) FILTER (WHERE stage = 'APPROVED')::int AS approved, COUNT(*) FILTER (WHERE stage = 'PAUSED')::int AS paused, COUNT(*) FILTER (WHERE next_review_at IS NULL AND stage NOT IN ('APPROVED', 'DECLINED', 'ARCHIVED'))::int AS without_followup, COUNT(p.id)::int AS formalized FROM initiatives i LEFT JOIN projects p ON p.source_initiative_id = i.id WHERE i.workspace_id = $1`, [workspaceId]);
    const byStage = await pool.query(`SELECT stage, COUNT(*)::int AS count FROM initiatives WHERE workspace_id = $1 GROUP BY stage ORDER BY stage`, [workspaceId]);
    const timeByStage = await pool.query(`SELECT stage, ROUND(AVG(days_in_stage)::numeric, 1) AS average_days FROM (SELECT h.to_stage AS stage, EXTRACT(EPOCH FROM (LEAD(h.created_at) OVER (PARTITION BY h.initiative_id ORDER BY h.created_at) - h.created_at)) / 86400 AS days_in_stage FROM initiative_workflow_history h JOIN initiatives i ON i.id = h.initiative_id WHERE i.workspace_id = $1) durations WHERE days_in_stage IS NOT NULL GROUP BY stage`, [workspaceId]);
    return res.json({ success: true, data: { ...totals.rows[0], byStage: byStage.rows, timeByStage: timeByStage.rows } });
  }
}

export const initiativeController = new InitiativeController();
