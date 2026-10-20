import type { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../lib/db';
import { eventStore } from '../services/EventStoreService';

const effortUnits = ['HOURS', 'DAYS', 'STORY_POINTS'] as const;

function isValidDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDateOnly, 'La fecha no es válida');

const createDecisionInput = z.object({
  title: z.string().trim().min(1).max(200),
  context: z.string().trim().max(1200).nullable().optional(),
  outcome: z.string().trim().min(1).max(2000),
  rationale: z.string().trim().min(1).max(2000),
  decisionDate: dateOnly,
  supersedesId: z.string().uuid().nullable().optional(),
});

const createBaselineInput = z.object({
  scope: z.string().trim().min(1).max(5000),
  startDate: dateOnly,
  targetDate: dateOnly,
  effortValue: z.number().positive().max(9999999999.99).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001),
  effortUnit: z.enum(effortUnits),
  changeReason: z.string().trim().max(1500).nullable().optional(),
}).refine((value) => value.targetDate >= value.startDate, {
  message: 'La fecha objetivo debe ser igual o posterior al inicio.',
  path: ['targetDate'],
});

const objectiveInput = z.object({
  statement: z.string().trim().min(1).max(2000),
  successMetric: z.string().trim().max(160).nullable().optional(),
  targetValue: z.number().finite().min(-9999999999.99).max(9999999999.99).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  changeReason: z.string().trim().max(1500).nullable().optional(),
});

const deliverableInput = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE', 'AT_RISK']).optional(),
  cardIds: z.array(z.string().uuid()).max(100).optional(),
});

const requirementInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  acceptanceCriteria: z.string().trim().min(1).max(2000),
  requirementType: z.enum(['FUNCTIONAL', 'NON_FUNCTIONAL', 'CONSTRAINT']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['DEFINED', 'IN_PROGRESS', 'VERIFIED', 'BLOCKED']).optional(),
  verificationMethod: z.string().trim().max(500).nullable().optional(),
  evidence: z.string().trim().max(2000).nullable().optional(),
  cardIds: z.array(z.string().uuid()).max(100).optional(),
});

const outcomeInput = z.object({
  metricName: z.string().trim().min(1).max(160),
  targetValue: z.number().finite().min(-9999999999.99).max(9999999999.99).nullable().optional(),
  actualValue: z.number().finite().min(-9999999999.99).max(9999999999.99),
  unit: z.string().trim().min(1).max(40),
  evidence: z.string().trim().max(2000).nullable().optional(),
  measuredAt: dateOnly,
  deliverableId: z.string().uuid().nullable().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
});

const milestoneLinkInput = z.object({ deliverableId: z.string().uuid().nullable() });

const decisionSelect = [
  'SELECT d.id, d.project_id, d.title, d.context, d.outcome, d.rationale,',
  '       d.decision_date, d.actor_id, d.actor_name, d.supersedes_id, d.created_at,',
  '       successor.id AS superseded_by_id',
  '  FROM project_decisions d',
  '  LEFT JOIN project_decisions successor',
  '    ON successor.project_id = d.project_id AND successor.supersedes_id = d.id',
].join('\n');

const baselineSelect = [
  'SELECT b.id, b.project_id, b.version, b.scope, b.start_date, b.target_date,',
  '       b.effort_value, b.effort_unit, b.change_reason, b.is_current,',
  '       b.created_by, b.created_by_name, b.created_at',
  '  FROM project_baselines b',
].join('\n');

function asDateOnly(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

function formatDecision(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    context: row.context,
    outcome: row.outcome,
    rationale: row.rationale,
    decisionDate: asDateOnly(row.decision_date),
    recorderId: row.actor_id,
    recorderName: row.actor_name,
    supersedesId: row.supersedes_id,
    supersededById: row.superseded_by_id,
    isCurrent: !row.superseded_by_id,
    createdAt: row.created_at,
  };
}

function formatBaseline(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    version: row.version,
    scope: row.scope,
    startDate: asDateOnly(row.start_date),
    targetDate: asDateOnly(row.target_date),
    effortValue: Number(row.effort_value),
    effortUnit: row.effort_unit,
    changeReason: row.change_reason,
    isCurrent: row.is_current,
    creatorId: row.created_by,
    creatorName: row.created_by_name,
    createdAt: row.created_at,
  };
}

function formatOutcome(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    objectiveId: row.objective_id,
    deliverableId: row.deliverable_id ?? null,
    deliverableName: row.deliverable_name ?? null,
    milestoneId: row.milestone_id ?? null,
    milestoneName: row.milestone_name ?? null,
    metricName: row.metric_name,
    targetValue: row.target_value == null ? null : Number(row.target_value),
    actualValue: Number(row.actual_value),
    unit: row.unit,
    evidence: row.evidence,
    measuredAt: asDateOnly(row.measured_at),
    recorderId: row.recorded_by,
    recorderName: row.recorded_by_name,
    objectiveVersion: row.objective_version,
    objectiveStatement: row.objective_statement,
    createdAt: row.created_at,
  };
}

async function recordDeletionEvent(
  req: Request,
  event: 'project.deliverable.deleted' | 'project.outcome.deleted',
  subject: { type: 'project-deliverable' | 'project-outcome'; id: string; name: string },
  project: { id: string; name: string; workspaceId: string | null },
  payload: Record<string, unknown>,
) {
  if (!project.workspaceId) return;
  try {
    const actor = await pool.query('SELECT name FROM users WHERE id = $1', [req.user!.id]);
    await eventStore.emit({
      type: event,
      actor: { id: req.user!.id, name: actor.rows[0]?.name ?? '' },
      subject,
      context: { workspaceId: project.workspaceId },
      payload: { projectId: project.id, projectName: project.name, ...payload },
    });
  } catch (error) {
    console.error('[ProjectTraceabilityController.recordDeletionEvent]', error);
  }
}

const outcomeSelect = `SELECT o.*, d.name AS deliverable_name, m.name AS milestone_name,
         obj.version AS objective_version, obj.statement AS objective_statement
  FROM project_outcomes o
  LEFT JOIN project_deliverables d ON d.id = o.deliverable_id AND d.project_id = o.project_id
  LEFT JOIN project_milestones m ON m.id = o.milestone_id AND m.project_id = o.project_id
  LEFT JOIN project_objectives obj ON obj.id = o.objective_id`;

export class ProjectTraceabilityController {
  async getTraceability(req: Request, res: Response) {
    const projectId = req.params.id;
    try {
      const [origin, objective, deliverables, requirements, milestones, outcomes] = await Promise.all([
        pool.query('SELECT * FROM project_origin_snapshots WHERE project_id = $1', [projectId]),
        pool.query('SELECT * FROM project_objectives WHERE project_id = $1 ORDER BY version DESC', [projectId]),
        pool.query(
          `SELECT d.id, d.project_id, d.objective_id, d.name, d.description, d.status, d.position, d.created_at, d.updated_at,
             COALESCE(json_agg(json_build_object('id', c.id, 'title', c.title, 'completed', c.completed, 'dueDate', c.due_date, 'cardCode', c.card_code))
               FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS cards
           FROM project_deliverables d
           LEFT JOIN project_deliverable_cards dc ON dc.deliverable_id = d.id
           LEFT JOIN cards c ON c.id = dc.card_id
           WHERE d.project_id = $1
           GROUP BY d.id ORDER BY d.position, d.created_at`,
          [projectId],
        ),
        pool.query(
          `SELECT r.id, r.project_id, r.deliverable_id, r.title, r.description, r.acceptance_criteria,
                  r.requirement_type, r.priority, r.status, r.verification_method, r.evidence,
                  r.position, r.created_at, r.updated_at,
                  COALESCE(json_agg(json_build_object('id', c.id, 'title', c.title, 'completed', c.completed,
                    'dueDate', c.due_date, 'cardCode', c.card_code)) FILTER (WHERE c.id IS NOT NULL), '[]'::json) AS cards
             FROM project_requirements r
             LEFT JOIN project_requirement_cards rc ON rc.requirement_id = r.id
             LEFT JOIN cards c ON c.id = rc.card_id
            WHERE r.project_id = $1
            GROUP BY r.id ORDER BY r.deliverable_id, r.position, r.created_at`,
          [projectId],
        ),
        pool.query(
          `SELECT m.id, m.project_id, m.name, m.description, m.date, m.status, m.color, m.deliverable_id,
                  d.name AS deliverable_name, m.created_at, m.updated_at
             FROM project_milestones m
             LEFT JOIN project_deliverables d ON d.id = m.deliverable_id AND d.project_id = m.project_id
            WHERE m.project_id = $1 ORDER BY m.date NULLS LAST, m.created_at`,
          [projectId],
        ),
        pool.query(outcomeSelect + ' WHERE o.project_id = $1 ORDER BY o.measured_at DESC, o.created_at DESC', [projectId]),
      ]);
      const source = origin.rows[0];
      const currentObjective = objective.rows.find((row) => row.is_current) ?? null;
      const formatObjective = (row: any) => ({
        id: row.id, projectId: row.project_id, version: row.version, isCurrent: row.is_current,
        statement: row.statement, successMetric: row.success_metric,
        targetValue: row.target_value == null ? null : Number(row.target_value), unit: row.unit,
        changeReason: row.change_reason, updatedAt: row.updated_at,
      });
      return res.json({
        success: true,
        data: {
          origin: source ? {
            id: source.id,
            type: source.origin_type,
            sourceInitiativeId: source.source_initiative_id,
            title: source.source_title,
            description: source.source_description,
            problemStatement: source.problem_statement,
            impactedPeople: source.impacted_people,
            problemImpact: source.problem_impact,
            impactedCount: source.impacted_count,
            expectedOutcome: source.expected_outcome,
            proposedSolution: source.proposed_solution,
            differentiation: source.differentiation,
            capturedAt: source.captured_at,
            isReconstructed: source.is_reconstructed,
          } : null,
          objective: currentObjective ? formatObjective(currentObjective) : null,
          objectiveHistory: objective.rows.map(formatObjective),
          deliverables: deliverables.rows.map((row) => ({
            id: row.id, projectId: row.project_id, objectiveId: row.objective_id, name: row.name,
            description: row.description, status: row.status, position: row.position,
            cards: row.cards,
            requirements: requirements.rows.filter((requirement) => requirement.deliverable_id === row.id).map((requirement) => ({
              id: requirement.id,
              projectId: requirement.project_id,
              deliverableId: requirement.deliverable_id,
              title: requirement.title,
              description: requirement.description,
              acceptanceCriteria: requirement.acceptance_criteria,
              requirementType: requirement.requirement_type,
              priority: requirement.priority,
              status: requirement.status,
              verificationMethod: requirement.verification_method,
              evidence: requirement.evidence,
              position: requirement.position,
              cards: requirement.cards,
              createdAt: requirement.created_at,
              updatedAt: requirement.updated_at,
            })),
            createdAt: row.created_at, updatedAt: row.updated_at,
          })),
          milestones: milestones.rows.map((row) => ({
            id: row.id, projectId: row.project_id, name: row.name, description: row.description,
            date: row.date ? asDateOnly(row.date) : null, status: row.status, color: row.color,
            deliverableId: row.deliverable_id, deliverableName: row.deliverable_name,
            createdAt: row.created_at, updatedAt: row.updated_at,
          })),
          outcomes: outcomes.rows.map(formatOutcome),
        },
      });
    } catch (error) {
      console.error('[ProjectTraceabilityController.getTraceability]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo cargar la cadena de trazabilidad.' } });
    }
  }

  async saveObjective(req: Request, res: Response) {
    const parsed = objectiveInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Revisa los datos del objetivo.', details: parsed.error.errors } });
    try {
      const actorId = req.user!.id;
      const { statement, successMetric, targetValue, unit, changeReason } = parsed.data;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [req.params.id]);
        const origin = await client.query('SELECT id FROM project_origin_snapshots WHERE project_id = $1 FOR UPDATE', [req.params.id]);
        if (!origin.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, error: { message: 'Registra el origen del proyecto antes de definir su objetivo.' } });
        }
        const currentResult = await client.query('SELECT * FROM project_objectives WHERE project_id = $1 AND is_current = TRUE FOR UPDATE', [req.params.id]);
        const current = currentResult.rows[0];
        const unchanged = current && current.statement === statement
          && current.success_metric === (successMetric || null)
          && (current.target_value == null ? null : Number(current.target_value)) === (targetValue ?? null)
          && current.unit === (unit || null);
        if (unchanged) {
          await client.query('COMMIT');
          return res.json({ success: true, data: { objective: {
            id: current.id, projectId: current.project_id, version: current.version, isCurrent: true,
            statement: current.statement, successMetric: current.success_metric,
            targetValue: current.target_value == null ? null : Number(current.target_value), unit: current.unit,
            changeReason: current.change_reason, updatedAt: current.updated_at,
          } } });
        }
        if (current && !changeReason?.trim()) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: { message: 'Explica por qué cambia el objetivo para conservar la trazabilidad de sus resultados.' } });
        }
        if (current) await client.query('UPDATE project_objectives SET is_current = FALSE WHERE id = $1', [current.id]);
        const inserted = await client.query(
          `INSERT INTO project_objectives (project_id, origin_snapshot_id, version, is_current, statement, success_metric, target_value, unit, change_reason, created_by)
           VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, $9)
           RETURNING id, project_id, version, is_current, statement, success_metric, target_value, unit, change_reason, updated_at`,
          [req.params.id, origin.rows[0].id, (current?.version ?? 0) + 1, statement, successMetric || null, targetValue ?? null, unit || null, changeReason || null, actorId],
        );
        await client.query('UPDATE project_deliverables SET objective_id = $2, updated_at = CURRENT_TIMESTAMP WHERE project_id = $1', [req.params.id, inserted.rows[0].id]);
        await client.query('UPDATE projects SET product_goal = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id, statement]);
        await client.query('COMMIT');
        const row = inserted.rows[0];
        return res.json({ success: true, data: { objective: {
          id: row.id, projectId: row.project_id, version: row.version, isCurrent: row.is_current,
          statement: row.statement, successMetric: row.success_metric,
          targetValue: row.target_value == null ? null : Number(row.target_value), unit: row.unit,
          changeReason: row.change_reason, updatedAt: row.updated_at,
        } } });
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally { client.release(); }
    } catch (error) {
      console.error('[ProjectTraceabilityController.saveObjective]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo guardar el objetivo.' } });
    }
  }

  async createDeliverable(req: Request, res: Response) {
    const parsed = deliverableInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Revisa los datos del entregable.', details: parsed.error.errors } });
    const projectId = req.params.id;
    const { name, description, status = 'PLANNED', cardIds = [] } = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const objective = await client.query('SELECT id FROM project_objectives WHERE project_id = $1 AND is_current = TRUE FOR UPDATE', [projectId]);
      if (!objective.rows[0]) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, error: { message: 'Define el objetivo del proyecto antes de registrar entregables.' } }); }
      if (cardIds.length) {
        const validCards = await client.query(
          `SELECT DISTINCT c.id FROM cards c JOIN lists l ON l.id = c.list_id JOIN project_boards pb ON pb.board_id = l.board_id
            WHERE pb.project_id = $1 AND c.id = ANY($2::uuid[])`, [projectId, cardIds],
        );
        if (validCards.rowCount !== new Set(cardIds).size) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: { message: 'Todas las tarjetas deben pertenecer a los tableros de este proyecto.' } }); }
      }
      const created = await client.query(
        `INSERT INTO project_deliverables (project_id, objective_id, name, description, status, position, created_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(position) + 1 FROM project_deliverables WHERE project_id = $1), 0), $6)
         RETURNING id, project_id, objective_id, name, description, status, position, created_at, updated_at`,
        [projectId, objective.rows[0].id, name, description || null, status, req.user!.id],
      );
      for (const cardId of [...new Set(cardIds)]) await client.query(
        'INSERT INTO project_deliverable_cards (project_id, deliverable_id, card_id) VALUES ($1, $2, $3) ON CONFLICT (deliverable_id, card_id) DO NOTHING',
        [projectId, created.rows[0].id, cardId],
      );
      await client.query('COMMIT');
      const row = created.rows[0];
      return res.status(201).json({ success: true, data: { deliverable: {
        id: row.id, projectId: row.project_id, objectiveId: row.objective_id, name: row.name,
        description: row.description, status: row.status, position: row.position, cards: [], requirements: [],
        createdAt: row.created_at, updatedAt: row.updated_at,
      } } });
    } catch (error: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (error?.code === '23505') return res.status(409).json({ success: false, error: { message: 'Ya existe un entregable con ese nombre.' } });
      console.error('[ProjectTraceabilityController.createDeliverable]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo crear el entregable.' } });
    } finally { client.release(); }
  }

  async updateDeliverable(req: Request, res: Response) {
    const parsed = deliverableInput.partial().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data ?? {}).length) return res.status(400).json({ success: false, error: { message: 'Revisa los datos del entregable.' } });
    const projectId = req.params.id;
    const deliverableId = req.params.deliverableId;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT id FROM project_deliverables WHERE id = $1 AND project_id = $2 FOR UPDATE', [deliverableId, projectId]);
      if (!found.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { message: 'Entregable no encontrado.' } }); }
      const { name, description, status, cardIds } = parsed.data;
      if (cardIds !== undefined) {
        const uniqueCardIds = [...new Set(cardIds)];
        if (uniqueCardIds.length) {
          const validCards = await client.query(
            `SELECT DISTINCT c.id FROM cards c JOIN lists l ON l.id = c.list_id JOIN project_boards pb ON pb.board_id = l.board_id
              WHERE pb.project_id = $1 AND c.id = ANY($2::uuid[])`, [projectId, uniqueCardIds],
          );
          if (validCards.rowCount !== uniqueCardIds.length) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: { message: 'Todas las tarjetas deben pertenecer a los tableros de este proyecto.' } }); }
        }
        const linkedRequirements = await client.query(
          `SELECT r.title FROM project_requirement_cards rc
             JOIN project_requirements r ON r.id = rc.requirement_id
            WHERE r.project_id = $1 AND r.deliverable_id = $2
              AND NOT (rc.card_id = ANY($3::uuid[]))
            LIMIT 1`,
          [projectId, deliverableId, uniqueCardIds],
        );
        if (linkedRequirements.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, error: { message: 'Desvincula primero del requisito las tarjetas que vas a quitar del entregable.' } });
        }
        await client.query('DELETE FROM project_deliverable_cards WHERE deliverable_id = $1', [deliverableId]);
        for (const cardId of uniqueCardIds) await client.query(
          'INSERT INTO project_deliverable_cards (project_id, deliverable_id, card_id) VALUES ($1, $2, $3)', [projectId, deliverableId, cardId],
        );
      }
      const values: unknown[] = [];
      const sets: string[] = [];
      const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
      if (name !== undefined) add('name', name);
      if (description !== undefined) add('description', description || null);
      if (status !== undefined) add('status', status);
      if (sets.length) {
        values.push(deliverableId, projectId);
        await client.query(`UPDATE project_deliverables SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length - 1} AND project_id = $${values.length}`, values);
      }
      await client.query('COMMIT');
      return res.json({ success: true, data: { id: deliverableId } });
    } catch (error: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (error?.code === '23505') return res.status(409).json({ success: false, error: { message: 'Ya existe un entregable con ese nombre.' } });
      console.error('[ProjectTraceabilityController.updateDeliverable]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo actualizar el entregable.' } });
    } finally { client.release(); }
  }

  async deleteDeliverable(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT d.id, d.name, p.name AS project_name, p.workspace_id,
                (SELECT COUNT(*)::int FROM project_requirements r WHERE r.project_id = d.project_id AND r.deliverable_id = d.id) AS requirements_deleted,
                ((SELECT COUNT(*) FROM project_deliverable_cards dc WHERE dc.project_id = d.project_id AND dc.deliverable_id = d.id)
                  + (SELECT COUNT(*) FROM project_requirement_cards rc JOIN project_requirements r ON r.id = rc.requirement_id
                      WHERE r.project_id = d.project_id AND r.deliverable_id = d.id))::int AS card_links_removed,
                (SELECT COUNT(*)::int FROM project_milestones m WHERE m.project_id = d.project_id AND m.deliverable_id = d.id) AS milestones_unlinked,
                (SELECT COUNT(*)::int FROM project_outcomes o WHERE o.project_id = d.project_id AND o.deliverable_id = d.id) AS outcomes_unlinked,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) ORDER BY m.date NULLS LAST, m.name)
                            FROM project_milestones m WHERE m.project_id = d.project_id AND m.deliverable_id = d.id), '[]'::jsonb) AS milestone_links,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'metricName', o.metric_name, 'measuredAt', o.measured_at,
                                                              'actualValue', o.actual_value, 'unit', o.unit, 'milestoneId', o.milestone_id)
                            ORDER BY o.measured_at DESC, o.created_at DESC)
                            FROM project_outcomes o WHERE o.project_id = d.project_id AND o.deliverable_id = d.id), '[]'::jsonb) AS outcome_links
           FROM project_deliverables d
           JOIN projects p ON p.id = d.project_id
          WHERE d.id = $1 AND d.project_id = $2
          FOR UPDATE OF d`,
        [req.params.deliverableId, req.params.id],
      );
      const row = found.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Entregable no encontrado.' } });
      }
      const deleted = await client.query(
        'DELETE FROM project_deliverables WHERE id = $1 AND project_id = $2 RETURNING id',
        [req.params.deliverableId, req.params.id],
      );
      if (!deleted.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Entregable no encontrado.' } });
      }
      await client.query('COMMIT');
      const impact = {
        requirementsDeleted: row.requirements_deleted,
        cardLinksRemoved: row.card_links_removed,
        milestonesUnlinked: row.milestones_unlinked,
        outcomesUnlinked: row.outcomes_unlinked,
        milestoneLinks: row.milestone_links,
        outcomeLinks: row.outcome_links,
      };
      await recordDeletionEvent(
        req,
        'project.deliverable.deleted',
        { type: 'project-deliverable', id: row.id, name: row.name },
        { id: req.params.id, name: row.project_name, workspaceId: row.workspace_id },
        { deletedName: row.name, impact },
      );
      return res.json({ success: true, data: { deleted: true, impact } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectTraceabilityController.deleteDeliverable]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo eliminar el entregable.' } });
    } finally { client.release(); }
  }

  async createRequirement(req: Request, res: Response) {
    const parsed = requirementInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Revisa los datos del requisito.', details: parsed.error.errors } });
    const projectId = req.params.id;
    const deliverableId = req.params.deliverableId;
    const { title, description, acceptanceCriteria, requirementType = 'FUNCTIONAL', priority = 'MEDIUM', status = 'DEFINED', verificationMethod, evidence, cardIds = [] } = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const deliverable = await client.query('SELECT id FROM project_deliverables WHERE id = $1 AND project_id = $2 FOR UPDATE', [deliverableId, projectId]);
      if (!deliverable.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { message: 'Entregable no encontrado.' } }); }
      const uniqueCardIds = [...new Set(cardIds)];
      if (uniqueCardIds.length) {
        const validCards = await client.query(
          'SELECT card_id FROM project_deliverable_cards WHERE project_id = $1 AND deliverable_id = $2 AND card_id = ANY($3::uuid[])',
          [projectId, deliverableId, uniqueCardIds],
        );
        if (validCards.rowCount !== uniqueCardIds.length) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: { message: 'Vincula primero esas tarjetas al entregable.' } }); }
      }
      const created = await client.query(
        `INSERT INTO project_requirements (project_id, deliverable_id, title, description, acceptance_criteria,
           requirement_type, priority, status, verification_method, evidence, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           COALESCE((SELECT MAX(position) + 1 FROM project_requirements WHERE deliverable_id = $2), 0))
         RETURNING id`,
        [projectId, deliverableId, title, description || null, acceptanceCriteria, requirementType, priority, status, verificationMethod || null, evidence || null],
      );
      for (const cardId of uniqueCardIds) await client.query(
        'INSERT INTO project_requirement_cards (project_id, requirement_id, card_id) VALUES ($1, $2, $3) ON CONFLICT (requirement_id, card_id) DO NOTHING',
        [projectId, created.rows[0].id, cardId],
      );
      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { id: created.rows[0].id } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectTraceabilityController.createRequirement]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo crear el requisito.' } });
    } finally { client.release(); }
  }

  async updateRequirement(req: Request, res: Response) {
    const parsed = requirementInput.partial().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data ?? {}).length) return res.status(400).json({ success: false, error: { message: 'Revisa los datos del requisito.', details: parsed.success ? undefined : parsed.error.errors } });
    const projectId = req.params.id;
    const { deliverableId, requirementId } = req.params;
    const data = parsed.data;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT id FROM project_requirements WHERE id = $1 AND deliverable_id = $2 AND project_id = $3 FOR UPDATE', [requirementId, deliverableId, projectId]);
      if (!found.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { message: 'Requisito no encontrado.' } }); }
      if (data.cardIds !== undefined) {
        const uniqueCardIds = [...new Set(data.cardIds)];
        if (uniqueCardIds.length) {
          const validCards = await client.query(
            'SELECT card_id FROM project_deliverable_cards WHERE project_id = $1 AND deliverable_id = $2 AND card_id = ANY($3::uuid[])',
            [projectId, deliverableId, uniqueCardIds],
          );
          if (validCards.rowCount !== uniqueCardIds.length) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, error: { message: 'Vincula primero esas tarjetas al entregable.' } }); }
        }
        await client.query('DELETE FROM project_requirement_cards WHERE requirement_id = $1', [requirementId]);
        for (const cardId of uniqueCardIds) await client.query(
          'INSERT INTO project_requirement_cards (project_id, requirement_id, card_id) VALUES ($1, $2, $3)',
          [projectId, requirementId, cardId],
        );
      }
      const columns: Record<string, string> = {
        title: 'title', description: 'description', acceptanceCriteria: 'acceptance_criteria',
        requirementType: 'requirement_type', priority: 'priority', status: 'status',
        verificationMethod: 'verification_method', evidence: 'evidence',
      };
      const values: unknown[] = [];
      const sets = Object.entries(columns).flatMap(([key, column]) => {
        if (data[key as keyof typeof data] === undefined) return [];
        values.push(data[key as keyof typeof data] || null);
        return [`${column} = $${values.length}`];
      });
      if (sets.length) {
        values.push(requirementId);
        await client.query(`UPDATE project_requirements SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`, values);
      } else {
        await client.query('UPDATE project_requirements SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [requirementId]);
      }
      await client.query('COMMIT');
      return res.json({ success: true, data: { id: requirementId } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectTraceabilityController.updateRequirement]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo actualizar el requisito.' } });
    } finally { client.release(); }
  }

  async deleteRequirement(req: Request, res: Response) {
    try {
      const result = await pool.query(
        'DELETE FROM project_requirements WHERE id = $1 AND deliverable_id = $2 AND project_id = $3 RETURNING id',
        [req.params.requirementId, req.params.deliverableId, req.params.id],
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, error: { message: 'Requisito no encontrado.' } });
      return res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      console.error('[ProjectTraceabilityController.deleteRequirement]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo eliminar el requisito.' } });
    }
  }

  async linkMilestone(req: Request, res: Response) {
    const parsed = milestoneLinkInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Selecciona un entregable válido.' } });
    try {
      if (parsed.data.deliverableId) {
        const valid = await pool.query('SELECT id FROM project_deliverables WHERE id = $1 AND project_id = $2', [parsed.data.deliverableId, req.params.id]);
        if (!valid.rows[0]) return res.status(400).json({ success: false, error: { message: 'El entregable no pertenece a este proyecto.' } });
      }
      const result = await pool.query(
        `UPDATE project_milestones SET deliverable_id = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND project_id = $3 RETURNING id`,
        [parsed.data.deliverableId, req.params.milestoneId, req.params.id],
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, error: { message: 'Hito no encontrado.' } });
      return res.json({ success: true, data: { milestoneId: req.params.milestoneId, deliverableId: parsed.data.deliverableId } });
    } catch (error) {
      console.error('[ProjectTraceabilityController.linkMilestone]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo asociar el hito al entregable.' } });
    }
  }

  async createOutcome(req: Request, res: Response) {
    const parsed = outcomeInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: { message: 'Revisa los datos del resultado medido.', details: parsed.error.errors } });
    const projectId = req.params.id;
    const data = parsed.data;
    try {
      const [objective, deliverable, milestone, actor] = await Promise.all([
        pool.query('SELECT id FROM project_objectives WHERE project_id = $1', [projectId]),
        data.deliverableId ? pool.query('SELECT id FROM project_deliverables WHERE id = $1 AND project_id = $2', [data.deliverableId, projectId]) : Promise.resolve({ rows: [] }),
        data.milestoneId ? pool.query('SELECT id, deliverable_id FROM project_milestones WHERE id = $1 AND project_id = $2', [data.milestoneId, projectId]) : Promise.resolve({ rows: [] }),
        pool.query('SELECT name FROM users WHERE id = $1', [req.user!.id]),
      ]);
      if (!objective.rows[0]) return res.status(409).json({ success: false, error: { message: 'Define el objetivo antes de registrar un resultado.' } });
      if (data.deliverableId && !deliverable.rows[0]) return res.status(400).json({ success: false, error: { message: 'El entregable no pertenece a este proyecto.' } });
      if (data.milestoneId && !milestone.rows[0]) return res.status(400).json({ success: false, error: { message: 'El hito no pertenece a este proyecto.' } });
      if (data.deliverableId && milestone.rows[0]?.deliverable_id && milestone.rows[0].deliverable_id !== data.deliverableId) {
        return res.status(400).json({ success: false, error: { message: 'El hito seleccionado pertenece a otro entregable.' } });
      }
      const deliverableId = data.deliverableId ?? milestone.rows[0]?.deliverable_id ?? null;
      const created = await pool.query(
        `INSERT INTO project_outcomes (project_id, objective_id, deliverable_id, milestone_id, metric_name, target_value, actual_value, unit, evidence, measured_at, recorded_by, recorded_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11, $12) RETURNING id`,
        [projectId, objective.rows[0].id, deliverableId, data.milestoneId ?? null, data.metricName, data.targetValue ?? null,
          data.actualValue, data.unit, data.evidence || null, data.measuredAt, req.user!.id, actor.rows[0]?.name ?? 'Persona del proyecto'],
      );
      const result = await pool.query(outcomeSelect + ' WHERE o.id = $1 AND o.project_id = $2', [created.rows[0].id, projectId]);
      return res.status(201).json({ success: true, data: { outcome: formatOutcome(result.rows[0]) } });
    } catch (error) {
      console.error('[ProjectTraceabilityController.createOutcome]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo registrar el resultado medido.' } });
    }
  }

  async deleteOutcome(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT o.id, o.deliverable_id, o.milestone_id, o.metric_name, o.target_value, o.actual_value, o.unit, o.evidence, o.measured_at,
                o.objective_id, obj.version AS objective_version, obj.statement AS objective_statement,
                d.name AS deliverable_name, m.name AS milestone_name,
                p.name AS project_name, p.workspace_id
           FROM project_outcomes o
           JOIN projects p ON p.id = o.project_id
           LEFT JOIN project_objectives obj ON obj.id = o.objective_id
           LEFT JOIN project_deliverables d ON d.id = o.deliverable_id AND d.project_id = o.project_id
           LEFT JOIN project_milestones m ON m.id = o.milestone_id AND m.project_id = o.project_id
          WHERE o.id = $1 AND o.project_id = $2
          FOR UPDATE OF o`,
        [req.params.outcomeId, req.params.id],
      );
      const row = found.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Resultado medido no encontrado.' } });
      }
      const deleted = await client.query(
        'DELETE FROM project_outcomes WHERE id = $1 AND project_id = $2 RETURNING id',
        [req.params.outcomeId, req.params.id],
      );
      if (!deleted.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: { message: 'Resultado medido no encontrado.' } });
      }
      await client.query('COMMIT');
      await recordDeletionEvent(
        req,
        'project.outcome.deleted',
        { type: 'project-outcome', id: row.id, name: row.metric_name },
        { id: req.params.id, name: row.project_name, workspaceId: row.workspace_id },
        {
          deletedName: row.metric_name,
          snapshot: {
            metricName: row.metric_name,
            targetValue: row.target_value == null ? null : Number(row.target_value),
            actualValue: Number(row.actual_value),
            unit: row.unit,
            evidence: row.evidence,
            measuredAt: asDateOnly(row.measured_at),
            objectiveVersion: row.objective_version,
            objectiveStatement: row.objective_statement,
            deliverableId: row.deliverable_id,
            deliverableName: row.deliverable_name,
            milestoneId: row.milestone_id,
            milestoneName: row.milestone_name,
          },
        },
      );
      return res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectTraceabilityController.deleteOutcome]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo eliminar el resultado medido.' } });
    } finally { client.release(); }
  }

  async listDecisions(req: Request, res: Response) {
    try {
      const result = await pool.query(
        decisionSelect + ' WHERE d.project_id = $1 ORDER BY d.decision_date DESC, d.created_at DESC',
        [req.params.id],
      );
      return res.json({ success: true, data: { decisions: result.rows.map(formatDecision) } });
    } catch (error) {
      console.error('[ProjectTraceabilityController.listDecisions]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudieron cargar las decisiones del proyecto.' } });
    }
  }

  async createDecision(req: Request, res: Response) {
    const parsed = createDecisionInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { message: 'Revisa los datos de la decisión.', details: parsed.error.errors } });
    }

    const projectId = req.params.id;
    const actorId = req.user!.id;
    const data = parsed.data;
    let client: PoolClient | null = null;
    let transactionOpen = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      transactionOpen = true;
      await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [projectId]);

      if (data.supersedesId) {
        const previous = await client.query(
          'SELECT d.id FROM project_decisions d LEFT JOIN project_decisions successor ON successor.project_id = d.project_id AND successor.supersedes_id = d.id WHERE d.id = $1 AND d.project_id = $2 AND successor.id IS NULL FOR UPDATE OF d',
          [data.supersedesId, projectId],
        );
        if (!previous.rowCount) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return res.status(409).json({ success: false, error: { message: 'La decisión que quieres reemplazar ya no está vigente.' } });
        }
      }

      const actor = await client.query('SELECT name FROM users WHERE id = $1', [actorId]);
      const created = await client.query(
        'INSERT INTO project_decisions (project_id, title, context, outcome, rationale, decision_date, actor_id, actor_name, supersedes_id) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9) RETURNING id',
        [projectId, data.title, data.context ?? null, data.outcome, data.rationale, data.decisionDate, actorId, actor.rows[0]?.name ?? 'Persona del proyecto', data.supersedesId ?? null],
      );
      const result = await client.query(decisionSelect + ' WHERE d.id = $1 AND d.project_id = $2', [created.rows[0].id, projectId]);
      await client.query('COMMIT');
      transactionOpen = false;
      return res.status(201).json({ success: true, data: { decision: formatDecision(result.rows[0]) } });
    } catch (error) {
      if (transactionOpen && client) await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectTraceabilityController.createDecision]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo registrar la decisión.' } });
    } finally {
      client?.release();
    }
  }

  async listBaselines(req: Request, res: Response) {
    try {
      const result = await pool.query(
        baselineSelect + ' WHERE b.project_id = $1 ORDER BY b.version DESC',
        [req.params.id],
      );
      return res.json({ success: true, data: { baselines: result.rows.map(formatBaseline) } });
    } catch (error) {
      console.error('[ProjectTraceabilityController.listBaselines]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo cargar la línea base del proyecto.' } });
    }
  }

  async createBaseline(req: Request, res: Response) {
    const parsed = createBaselineInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { message: 'Revisa los datos de la línea base.', details: parsed.error.errors } });
    }

    const projectId = req.params.id;
    const actorId = req.user!.id;
    const data = parsed.data;
    let client: PoolClient | null = null;
    let transactionOpen = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      transactionOpen = true;
      await client.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [projectId]);

      const latest = await client.query(
        'SELECT COALESCE(MAX(version), 0)::int AS version FROM project_baselines WHERE project_id = $1',
        [projectId],
      );
      const previousVersion = latest.rows[0]?.version ?? 0;
      if (previousVersion > 0 && !data.changeReason?.trim()) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(400).json({ success: false, error: { message: 'Explica por qué cambia la línea base para guardar una nueva versión.' } });
      }

      const actor = await client.query('SELECT name FROM users WHERE id = $1', [actorId]);
      await client.query('UPDATE project_baselines SET is_current = FALSE WHERE project_id = $1 AND is_current = TRUE', [projectId]);
      const created = await client.query(
        'INSERT INTO project_baselines (project_id, version, scope, start_date, target_date, effort_value, effort_unit, change_reason, is_current, created_by, created_by_name) VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, TRUE, $9, $10) RETURNING id',
        [projectId, previousVersion + 1, data.scope, data.startDate, data.targetDate, data.effortValue, data.effortUnit, data.changeReason ?? null, actorId, actor.rows[0]?.name ?? 'Persona del proyecto'],
      );
      const result = await client.query(baselineSelect + ' WHERE b.id = $1 AND b.project_id = $2', [created.rows[0].id, projectId]);
      await client.query('COMMIT');
      transactionOpen = false;
      return res.status(201).json({ success: true, data: { baseline: formatBaseline(result.rows[0]) } });
    } catch (error) {
      if (transactionOpen && client) await client.query('ROLLBACK').catch(() => undefined);
      console.error('[ProjectTraceabilityController.createBaseline]', error);
      return res.status(500).json({ success: false, error: { message: 'No se pudo guardar la nueva versión de la línea base.' } });
    } finally {
      client?.release();
    }
  }
}

export const projectTraceabilityController = new ProjectTraceabilityController();
