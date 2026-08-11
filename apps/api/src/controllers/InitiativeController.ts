import { Request, Response } from 'express';
import { z } from 'zod';
import { getClient, pool } from '../lib/db';

const stages = ['SUBMITTED', 'TRIAGE', 'DIAGNOSIS', 'VALIDATION', 'APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED'] as const;
const participantRoles = ['REQUESTER', 'TRIAGE_COORDINATOR', 'MENTOR', 'EVALUATOR', 'PROJECT_LEAD', 'COLLABORATOR', 'SPONSOR'] as const;
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
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
  title: z.string().trim().min(3).max(500),
  description: z.string().max(8000).optional().nullable(),
  problemStatement: z.string().max(8000).optional().nullable(),
  proposedNextStep: z.string().max(2000).optional().nullable(),
  priority: z.enum(priorities).optional(),
  evidence: z.array(z.object({ title: z.string().max(255), url: z.string().url().optional(), note: z.string().max(2000).optional() })).max(30).optional(),
  attachments: z.array(z.object({ name: z.string().max(255), url: z.string().url(), type: z.string().max(100).optional() })).max(30).optional(),
  nextReviewAt: z.string().datetime().optional().nullable(),
});
const updateInput = initiativeInput.omit({ workspaceId: true }).partial();
const transitionInput = z.object({ stage: z.enum(stages), decision: z.string().trim().max(30).optional().nullable(), reason: z.string().trim().max(4000).optional().nullable(), nextReviewAt: z.string().datetime().optional().nullable() });
const participantInput = z.object({ userId: z.string().uuid(), role: z.enum(participantRoles) });
const settingsInput = z.object({ initiativeTeamId: z.string().uuid().nullable().optional(), activeStandardId: z.string().uuid().nullable().optional(), intakeEnabled: z.boolean().optional(), triageCriteria: z.array(z.string().trim().min(1).max(300)).max(30).optional(), reviewCadenceDays: z.number().int().min(1).max(365).optional(), requiredInitiativeFields: z.array(z.enum(['title', 'description', 'problemStatement', 'proposedNextStep', 'evidence', 'attachments'])).min(1).optional() });

function format(row: any) {
  return {
    id: row.id, workspaceId: row.workspace_id, networkProgramId: row.network_program_id,
    submittedById: row.submitted_by, title: row.title, description: row.description,
    problemStatement: row.problem_statement, proposedNextStep: row.proposed_next_step,
    priority: row.priority, evidence: row.evidence ?? [], attachments: row.attachments ?? [],
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
  const { rows } = await pool.query(`SELECT wm.role, w.owner_id FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id WHERE wm.workspace_id = $1 AND wm.user_id = $2`, [workspaceId, userId]);
  return rows[0] ?? null;
}

async function access(initiativeId: string, userId: string) {
  const { rows } = await pool.query(
    `SELECT i.workspace_id, i.submitted_by, i.stage, wm.role AS workspace_role,
      EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2) AS participant,
      EXISTS(SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2 AND ip.role = 'TRIAGE_COORDINATOR') AS explicit_coordinator,
      EXISTS(SELECT 1 FROM workspaces w LEFT JOIN workspace_institutional_settings s ON s.workspace_id = w.id JOIN team_members tm ON tm.team_id = COALESCE(s.initiative_team_id, w.initiative_team_id) WHERE w.id = i.workspace_id AND tm.user_id = $2) AS team_coordinator
     FROM initiatives i JOIN workspace_members wm ON wm.workspace_id = i.workspace_id AND wm.user_id = $2 WHERE i.id = $1`,
    [initiativeId, userId]
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return { ...row, isRequester: row.submitted_by === userId, isCoordinator: row.explicit_coordinator || row.team_coordinator, isAdmin: ['OWNER', 'ADMIN'].includes(row.workspace_role) };
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
    const params: unknown[] = [workspaceId, actorId]; let where = `i.workspace_id = $1 AND (i.submitted_by = $2 OR EXISTS (SELECT 1 FROM initiative_participants ip WHERE ip.initiative_id = i.id AND ip.user_id = $2) OR EXISTS (SELECT 1 FROM workspaces w LEFT JOIN workspace_institutional_settings s ON s.workspace_id = w.id JOIN team_members tm ON tm.team_id = COALESCE(s.initiative_team_id, w.initiative_team_id) WHERE w.id = i.workspace_id AND tm.user_id = $2) OR $3::boolean)`;
    params.push(['OWNER', 'ADMIN'].includes(member.role));
    if (stage && stages.includes(stage as any)) { params.push(stage); where += ` AND i.stage = $${params.length}`; }
    const result = await pool.query(`${initiativeSelect} WHERE ${where} ORDER BY i.priority = 'URGENT' DESC, i.next_review_at NULLS LAST, i.created_at DESC`, params);
    return res.json({ success: true, data: { initiatives: result.rows.map(format) } });
  }

  async getById(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const gate = await access(req.params.id, actorId); if (!gate || !(gate.isRequester || gate.participant || gate.isCoordinator || gate.isAdmin)) return error(res, 403, 'FORBIDDEN', 'Initiative access required');
    const [initiative, participants, history] = await Promise.all([
      pool.query(`${initiativeSelect} WHERE i.id = $1`, [req.params.id]),
      pool.query(`SELECT ip.id, ip.role, ip.assigned_at, u.id AS user_id, u.name, u.email, u.avatar FROM initiative_participants ip JOIN users u ON u.id = ip.user_id WHERE ip.initiative_id = $1 ORDER BY ip.assigned_at`, [req.params.id]),
      pool.query(`SELECT h.*, u.name AS actor_name FROM initiative_workflow_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.initiative_id = $1 ORDER BY h.created_at DESC`, [req.params.id]),
    ]);
    return res.json({ success: true, data: { initiative: format(initiative.rows[0]), participants: participants.rows.map((r: any) => ({ id: r.id, role: r.role, assignedAt: r.assigned_at, user: { id: r.user_id, name: r.name, email: r.email, avatar: r.avatar } })), history: history.rows.map((r: any) => ({ id: r.id, fromStage: r.from_stage, toStage: r.to_stage, decision: r.decision, reason: r.reason, actorId: r.actor_id, actorName: r.actor_name, createdAt: r.created_at })) } });
  }

  async create(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = initiativeInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid initiative data');
    const data = parsed.data; const member = await membership(data.workspaceId, actorId); if (!member) return error(res, 403, 'FORBIDDEN', 'Workspace access required');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(`INSERT INTO initiatives (id, workspace_id, submitted_by, title, description, problem_statement, proposed_next_step, priority, evidence, attachments, next_review_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10) RETURNING *`, [data.workspaceId, actorId, data.title, data.description ?? null, data.problemStatement ?? null, data.proposedNextStep ?? null, data.priority ?? 'MEDIUM', JSON.stringify(data.evidence ?? []), JSON.stringify(data.attachments ?? []), data.nextReviewAt ?? null]);
      const initiative = result.rows[0];
      await client.query(`INSERT INTO initiative_participants (id, initiative_id, user_id, role, assigned_by) VALUES (gen_random_uuid(), $1, $2, 'REQUESTER', $2) ON CONFLICT DO NOTHING`, [initiative.id, actorId]);
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
    const dbFields: Record<string, string> = { title: 'title', description: 'description', problemStatement: 'problem_statement', proposedNextStep: 'proposed_next_step', priority: 'priority', evidence: 'evidence', attachments: 'attachments', nextReviewAt: 'next_review_at' };
    for (const [key, column] of Object.entries(dbFields)) if (key in data) { values.push(['evidence', 'attachments'].includes(key) ? JSON.stringify((data as any)[key] ?? []) : (data as any)[key]); fields.push(`${column} = $${values.length}${['evidence', 'attachments'].includes(key) ? '::jsonb' : ''}`); }
    if (!fields.length) return this.getById(req, res);
    values.push(req.params.id); const result = await pool.query(`UPDATE initiatives SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`, values);
    return res.json({ success: true, data: { initiative: format(result.rows[0]) } });
  }

  async addParticipant(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = participantInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid participant');
    const gate = await access(req.params.id, actorId); if (!gate || !gate.isCoordinator) return error(res, 403, 'FORBIDDEN', 'A triage coordinator is required');
    if (!(await assertWorkspaceUser(gate.workspace_id, parsed.data.userId))) return error(res, 400, 'VALIDATION_ERROR', 'Participant must belong to the workspace');
    const result = await pool.query(`INSERT INTO initiative_participants (id, initiative_id, user_id, role, assigned_by) VALUES (gen_random_uuid(), $1, $2, $3, $4) ON CONFLICT (initiative_id, user_id, role) DO UPDATE SET assigned_by = EXCLUDED.assigned_by RETURNING *`, [req.params.id, parsed.data.userId, parsed.data.role, actorId]);
    if (parsed.data.role === 'TRIAGE_COORDINATOR') await pool.query(`UPDATE initiatives SET triage_owner_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id, parsed.data.userId]);
    if (parsed.data.role === 'MENTOR') await pool.query(`UPDATE initiatives SET mentor_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id, parsed.data.userId]);
    return res.status(201).json({ success: true, data: { participant: result.rows[0] } });
  }

  async removeParticipant(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const gate = await access(req.params.id, actorId); if (!gate || !gate.isCoordinator) return error(res, 403, 'FORBIDDEN', 'A triage coordinator is required');
    await pool.query(`DELETE FROM initiative_participants WHERE initiative_id = $1 AND user_id = $2 AND role <> 'REQUESTER'`, [req.params.id, req.params.userId]);
    await pool.query(`UPDATE initiatives SET mentor_id = NULL WHERE id = $1 AND mentor_id = $2`, [req.params.id, req.params.userId]);
    return res.json({ success: true, data: { message: 'Participant removed' } });
  }

  async transition(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = transitionInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid transition');
    const gate = await access(req.params.id, actorId); if (!gate || !gate.isCoordinator) return error(res, 403, 'FORBIDDEN', 'Only a triage coordinator can change the institutional flow');
    if (parsed.data.stage !== gate.stage && !allowedTransitions[gate.stage]?.includes(parsed.data.stage)) return error(res, 409, 'INVALID_TRANSITION', `The transition from ${gate.stage} to ${parsed.data.stage} is not allowed`);
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const result = await client.query(`UPDATE initiatives SET stage = $2, decision = $3, decision_reason = $4, next_review_at = $5, triage_owner_id = COALESCE(triage_owner_id, $6), updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [req.params.id, parsed.data.stage, parsed.data.decision ?? null, parsed.data.reason ?? null, parsed.data.nextReviewAt ?? null, actorId]);
      await client.query(`INSERT INTO initiative_workflow_history (id, initiative_id, from_stage, to_stage, decision, reason, actor_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`, [req.params.id, gate.stage, parsed.data.stage, parsed.data.decision ?? null, parsed.data.reason ?? null, actorId]);
      await client.query('COMMIT'); return res.json({ success: true, data: { initiative: format(result.rows[0]) } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async convert(req: Request, res: Response) {
    const actorId = userId(req); if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const gate = await access(req.params.id, actorId); if (!gate || !gate.isCoordinator) return error(res, 403, 'FORBIDDEN', 'A triage coordinator is required');
    if (gate.stage !== 'APPROVED') return error(res, 409, 'INVALID_TRANSITION', 'Only approved initiatives can become projects');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const locked = await client.query(`SELECT i.* FROM initiatives i WHERE i.id = $1 FOR UPDATE`, [req.params.id]); if (!locked.rows[0]) throw new Error('Initiative not found'); const i = locked.rows[0];
      const existing = await client.query(`SELECT id FROM projects WHERE source_initiative_id = $1`, [i.id]); if (existing.rows[0]) { await client.query('ROLLBACK'); return res.json({ success: true, data: { projectId: existing.rows[0].id, alreadyConverted: true } }); }
      const lead = await client.query(`SELECT user_id FROM initiative_participants WHERE initiative_id = $1 AND role = 'PROJECT_LEAD' ORDER BY assigned_at LIMIT 1`, [i.id]);
      const ownerId = lead.rows[0]?.user_id ?? i.triage_owner_id ?? actorId;
      const standard = await client.query(`SELECT id, version FROM workspace_project_standards WHERE workspace_id = $1 AND is_active = true ORDER BY version DESC, updated_at DESC LIMIT 1`, [i.workspace_id]);
      const project = await client.query(`INSERT INTO projects (id, workspace_id, source_initiative_id, name, description, status, maturity_stage, problem_statement, next_step, owner_id, formalized_at, applied_standard_id, applied_standard_version, standard_applied_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, 'PLANNING', 'FORMALIZED', $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id`, [i.workspace_id, i.id, i.title, i.description, i.problem_statement, i.proposed_next_step, ownerId, standard.rows[0]?.id ?? null, standard.rows[0]?.version ?? 1]);
      const projectId = project.rows[0].id;
      const board = await client.query(`INSERT INTO boards (id, workspace_id, name, description, position, created_by, color) VALUES (gen_random_uuid(), $1, $2, $3, COALESCE((SELECT MAX(position) + 1 FROM boards WHERE workspace_id = $1), 0), $4, '#F2571E') RETURNING id`, [i.workspace_id, `Ejecución · ${i.title}`, 'Tablero inicial creado desde una iniciativa aprobada.', actorId]);
      await client.query(`INSERT INTO project_boards (id, project_id, board_id) VALUES (gen_random_uuid(), $1, $2)`, [projectId, board.rows[0].id]);
      await client.query(`INSERT INTO project_milestones (id, project_id, name, description, date, color) VALUES (gen_random_uuid(), $1, 'Definir plan inicial', 'Primer hito generado al formalizar la iniciativa.', CURRENT_DATE + INTERVAL '7 days', '#F59E0B')`, [projectId]);
      await client.query(`INSERT INTO project_teams (id, project_id, team_id, assigned_by) SELECT gen_random_uuid(), $1, s.initiative_team_id, $2 FROM workspace_institutional_settings s JOIN teams t ON t.id = s.initiative_team_id AND t.workspace_id = s.workspace_id WHERE s.workspace_id = $3 AND s.initiative_team_id IS NOT NULL ON CONFLICT DO NOTHING`, [projectId, actorId, i.workspace_id]);
      await client.query(`INSERT INTO project_role_assignments (id, project_id, user_id, role, is_primary, assigned_by) SELECT gen_random_uuid(), $1, ip.user_id, CASE ip.role WHEN 'REQUESTER' THEN 'REQUESTER'::"ProjectOperationalRole" WHEN 'TRIAGE_COORDINATOR' THEN 'TRIAGE_COORDINATOR'::"ProjectOperationalRole" WHEN 'MENTOR' THEN 'MENTOR'::"ProjectOperationalRole" WHEN 'EVALUATOR' THEN 'EVALUATOR'::"ProjectOperationalRole" WHEN 'PROJECT_LEAD' THEN 'PROJECT_LEAD'::"ProjectOperationalRole" WHEN 'COLLABORATOR' THEN 'COLLABORATOR'::"ProjectOperationalRole" ELSE 'COLLABORATOR'::"ProjectOperationalRole" END, ip.role = 'PROJECT_LEAD', $2 FROM initiative_participants ip WHERE ip.initiative_id = $3 ON CONFLICT DO NOTHING`, [projectId, actorId, i.id]);
      await client.query(`INSERT INTO project_role_assignments (id, project_id, user_id, role, is_primary, assigned_by) SELECT gen_random_uuid(), $1, $2, 'PROJECT_LEAD', true, $3 WHERE NOT EXISTS (SELECT 1 FROM project_role_assignments WHERE project_id = $1 AND role = 'PROJECT_LEAD') ON CONFLICT DO NOTHING`, [projectId, ownerId, actorId]);
      await client.query(`INSERT INTO initiative_workflow_history (id, initiative_id, from_stage, to_stage, decision, reason, actor_id) VALUES (gen_random_uuid(), $1, 'APPROVED', 'APPROVED', 'FORMALIZED', 'Iniciativa convertida en proyecto: ' || $2, $3)`, [i.id, projectId, actorId]);
      await client.query('COMMIT'); return res.status(201).json({ success: true, data: { projectId, boardId: board.rows[0].id } });
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  async getSettings(req: Request, res: Response) {
    const actorId = userId(req); const workspaceId = req.params.workspaceId; if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required'); if (!(await membership(workspaceId, actorId))) return error(res, 403, 'FORBIDDEN', 'Workspace access required');
    const result = await pool.query(`SELECT s.workspace_id, COALESCE(s.initiative_team_id, w.initiative_team_id) AS initiative_team_id, s.active_standard_id, COALESCE(s.intake_enabled, true) AS intake_enabled, COALESCE(s.triage_criteria, '[]'::jsonb) AS triage_criteria, COALESCE(s.review_cadence_days, 7) AS review_cadence_days, COALESCE(s.required_initiative_fields, '["title", "problemStatement", "proposedNextStep"]'::jsonb) AS required_initiative_fields FROM workspaces w LEFT JOIN workspace_institutional_settings s ON s.workspace_id = w.id WHERE w.id = $1`, [workspaceId]);
    return res.json({ success: true, data: { settings: result.rows[0] ?? { workspace_id: workspaceId, intake_enabled: true, triage_criteria: [], review_cadence_days: 7, required_initiative_fields: ['title', 'problemStatement', 'proposedNextStep'] } } });
  }

  async updateSettings(req: Request, res: Response) {
    const actorId = userId(req); const workspaceId = req.params.workspaceId; if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required'); const member = await membership(workspaceId, actorId); if (!member || !['OWNER', 'ADMIN'].includes(member.role)) return error(res, 403, 'FORBIDDEN', 'Workspace administration is required');
    const parsed = settingsInput.safeParse(req.body); if (!parsed.success) return error(res, 400, 'VALIDATION_ERROR', 'Invalid institutional settings'); const d = parsed.data;
    if (d.initiativeTeamId) { const valid = await pool.query(`SELECT 1 FROM teams WHERE id = $1 AND workspace_id = $2`, [d.initiativeTeamId, workspaceId]); if (!valid.rows[0]) return error(res, 400, 'VALIDATION_ERROR', 'Initiative team must belong to the workspace'); }
    if (d.activeStandardId) { const valid = await pool.query(`SELECT 1 FROM workspace_project_standards WHERE id = $1 AND workspace_id = $2`, [d.activeStandardId, workspaceId]); if (!valid.rows[0]) return error(res, 400, 'VALIDATION_ERROR', 'Standard must belong to the workspace'); }
    const result = await pool.query(`INSERT INTO workspace_institutional_settings (workspace_id, initiative_team_id, active_standard_id, intake_enabled, triage_criteria, review_cadence_days, required_initiative_fields) VALUES ($1, $2, $3, COALESCE($4, true), COALESCE($5::jsonb, '[]'::jsonb), COALESCE($6, 7), COALESCE($7::jsonb, '["title", "problemStatement", "proposedNextStep"]'::jsonb)) ON CONFLICT (workspace_id) DO UPDATE SET initiative_team_id = CASE WHEN $8 THEN $2 ELSE workspace_institutional_settings.initiative_team_id END, active_standard_id = CASE WHEN $9 THEN $3 ELSE workspace_institutional_settings.active_standard_id END, intake_enabled = COALESCE($4, workspace_institutional_settings.intake_enabled), triage_criteria = COALESCE($5::jsonb, workspace_institutional_settings.triage_criteria), review_cadence_days = COALESCE($6, workspace_institutional_settings.review_cadence_days), required_initiative_fields = COALESCE($7::jsonb, workspace_institutional_settings.required_initiative_fields), updated_at = CURRENT_TIMESTAMP RETURNING *`, [workspaceId, d.initiativeTeamId ?? null, d.activeStandardId ?? null, d.intakeEnabled, d.triageCriteria ? JSON.stringify(d.triageCriteria) : null, d.reviewCadenceDays, d.requiredInitiativeFields ? JSON.stringify(d.requiredInitiativeFields) : null, d.initiativeTeamId !== undefined, d.activeStandardId !== undefined]);
    if (d.initiativeTeamId !== undefined) await pool.query(`UPDATE workspaces SET initiative_team_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [workspaceId, d.initiativeTeamId]);
    return res.json({ success: true, data: { settings: result.rows[0] } });
  }

  async reports(req: Request, res: Response) {
    const actorId = userId(req); const workspaceId = req.query.workspaceId as string; if (!actorId) return error(res, 401, 'UNAUTHORIZED', 'Authentication required'); if (!workspaceId) return error(res, 400, 'VALIDATION_ERROR', 'workspaceId is required'); const member = await membership(workspaceId, actorId); if (!member) return error(res, 403, 'FORBIDDEN', 'Workspace access required');
    const totals = await pool.query(`SELECT COUNT(*) FILTER (WHERE true)::int AS received, COUNT(*) FILTER (WHERE stage = 'APPROVED')::int AS approved, COUNT(*) FILTER (WHERE stage = 'PAUSED')::int AS paused, COUNT(*) FILTER (WHERE next_review_at IS NULL AND stage NOT IN ('APPROVED', 'DECLINED', 'ARCHIVED'))::int AS without_followup, COUNT(p.id)::int AS formalized FROM initiatives i LEFT JOIN projects p ON p.source_initiative_id = i.id WHERE i.workspace_id = $1`, [workspaceId]);
    const byStage = await pool.query(`SELECT stage, COUNT(*)::int AS count FROM initiatives WHERE workspace_id = $1 GROUP BY stage ORDER BY stage`, [workspaceId]);
    const timeByStage = await pool.query(`SELECT stage, ROUND(AVG(days_in_stage)::numeric, 1) AS average_days FROM (SELECT h.to_stage AS stage, EXTRACT(EPOCH FROM (LEAD(h.created_at) OVER (PARTITION BY h.initiative_id ORDER BY h.created_at) - h.created_at)) / 86400 AS days_in_stage FROM initiative_workflow_history h JOIN initiatives i ON i.id = h.initiative_id WHERE i.workspace_id = $1) durations WHERE days_in_stage IS NOT NULL GROUP BY stage`, [workspaceId]);
    return res.json({ success: true, data: { ...totals.rows[0], byStage: byStage.rows, timeByStage: timeByStage.rows } });
  }
}

export const initiativeController = new InitiativeController();
