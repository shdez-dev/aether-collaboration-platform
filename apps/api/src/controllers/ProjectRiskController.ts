import type { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db';
import { eventStore } from '../services/EventStoreService';

const probabilityScale = z.number().int().min(1).max(5);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}, 'La fecha de revisión no es válida').nullable();
const riskStatuses = ['OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED'] as const;

const createRiskInput = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  probability: probabilityScale,
  impact: probabilityScale,
  residualProbability: probabilityScale.nullable().optional(),
  residualImpact: probabilityScale.nullable().optional(),
  mitigationPlan: z.string().trim().min(1).max(5000),
  ownerId: z.string().uuid(),
  status: z.enum(riskStatuses).default('OPEN'),
  nextReviewAt: dateOnly.optional(),
});

const updateRiskInput = createRiskInput.partial().extend({
  nextReviewAt: dateOnly.optional(),
}).refine((data) => Object.keys(data).length > 0, 'Incluye al menos un cambio.');

const riskSelect = `
  SELECT r.id, r.project_id AS "projectId", r.title, r.description,
         r.probability, r.impact,
         r.probability * r.impact AS "inherentScore",
         r.residual_probability AS "residualProbability",
         r.residual_impact AS "residualImpact",
         COALESCE(r.residual_probability, r.probability)
           * COALESCE(r.residual_impact, r.impact) AS "residualScore",
         r.mitigation_plan AS "mitigationPlan", r.owner_id AS "ownerId",
         owner.name AS "ownerName", owner.email AS "ownerEmail", owner.avatar AS "ownerAvatar",
         r.status, r.next_review_at AS "nextReviewAt",
         r.created_by AS "createdById", r.created_at AS "createdAt", r.updated_at AS "updatedAt"
    FROM project_risks r
    LEFT JOIN users owner ON owner.id = r.owner_id`;

export class ProjectRiskController {
  private async ownerBelongsToProject(projectId: string, ownerId: string) {
    const result = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM projects p
          WHERE p.id = $1 AND (
            p.owner_id = $2
            OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2)
            OR EXISTS (SELECT 1 FROM project_role_assignments pra WHERE pra.project_id = p.id AND pra.user_id = $2 AND pra.ended_at IS NULL)
            OR EXISTS (
              SELECT 1 FROM project_teams pt JOIN team_members tm ON tm.team_id = pt.team_id
               WHERE pt.project_id = p.id AND tm.user_id = $2
            )
          )
       ) AS allowed`,
      [projectId, ownerId],
    );
    return result.rows[0]?.allowed === true;
  }

  private async findRisk(projectId: string, riskId: string) {
    const result = await pool.query(`${riskSelect} WHERE r.project_id = $1 AND r.id = $2`, [projectId, riskId]);
    return result.rows[0] ?? null;
  }

  private async ownersForProject(projectId: string) {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar
         FROM users u
        WHERE EXISTS (SELECT 1 FROM projects p WHERE p.id = $1 AND p.owner_id = u.id)
           OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = u.id)
           OR EXISTS (SELECT 1 FROM project_role_assignments pra WHERE pra.project_id = $1 AND pra.user_id = u.id AND pra.ended_at IS NULL)
           OR EXISTS (
             SELECT 1 FROM project_teams pt JOIN team_members tm ON tm.team_id = pt.team_id
              WHERE pt.project_id = $1 AND tm.user_id = u.id
           )
        ORDER BY u.name, u.id`,
      [projectId],
    );
    return result.rows.map((row) => ({ id: row.id, name: row.name, email: row.email, avatar: row.avatar }));
  }

  private async recordEvent(
    req: Request,
    projectId: string,
    risk: { id: string; title: string },
    type: 'project.risk.created' | 'project.risk.updated' | 'project.risk.status-changed',
    delta?: { before: Record<string, unknown>; after: Record<string, unknown> },
  ) {
    try {
      const [projectResult, actorResult] = await Promise.all([
        pool.query('SELECT workspace_id, name FROM projects WHERE id = $1', [projectId]),
        pool.query('SELECT name FROM users WHERE id = $1', [req.user!.id]),
      ]);
      const workspaceId = projectResult.rows[0]?.workspace_id;
      if (!workspaceId) return;
      await eventStore.emit({
        type,
        actor: { id: req.user!.id, name: actorResult.rows[0]?.name ?? '' },
        subject: { type: 'project-risk', id: risk.id, name: risk.title },
        context: { workspaceId },
        delta,
        payload: { projectId, projectName: projectResult.rows[0].name },
      });
    } catch {
      // El registro de riesgos sigue guardado si el servicio de actividad no está disponible.
    }
  }

  async list(req: Request, res: Response) {
    try {
      const [riskResult, owners] = await Promise.all([
        pool.query(`${riskSelect} WHERE r.project_id = $1 ORDER BY CASE r.status WHEN 'CLOSED' THEN 1 ELSE 0 END, "residualScore" DESC, r.updated_at DESC, r.id`, [req.params.id]),
        this.ownersForProject(req.params.id),
      ]);
      return res.json({ success: true, data: { risks: riskResult.rows, owners } });
    } catch {
      return res.status(500).json({ success: false, error: { message: 'No se pudieron cargar los riesgos del proyecto' } });
    }
  }

  async create(req: Request, res: Response) {
    const parsed = createRiskInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { message: 'Revisa los datos del riesgo', details: parsed.error.errors } });
    }

    const projectId = req.params.id;
    try {
      if (!(await this.ownerBelongsToProject(projectId, parsed.data.ownerId))) {
        return res.status(400).json({ success: false, error: { message: 'El responsable debe pertenecer al proyecto' } });
      }
      const data = parsed.data;
      const created = await pool.query(
        `INSERT INTO project_risks (
           project_id, title, description, probability, impact, residual_probability,
           residual_impact, mitigation_plan, owner_id, status, next_review_at, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::"ProjectRiskStatus", $11::date, $12)
         RETURNING id, title`,
        [projectId, data.title, data.description ?? null, data.probability, data.impact,
          data.residualProbability ?? null, data.residualImpact ?? null, data.mitigationPlan,
          data.ownerId, data.status, data.nextReviewAt ?? null, req.user!.id],
      );
      const risk = await this.findRisk(projectId, created.rows[0].id);
      await this.recordEvent(req, projectId, created.rows[0], 'project.risk.created', {
        before: {},
        after: {
          title: data.title,
          probability: data.probability,
          impact: data.impact,
          residualProbability: data.residualProbability ?? data.probability,
          residualImpact: data.residualImpact ?? data.impact,
          ownerId: data.ownerId,
          status: data.status,
        },
      });
      return res.status(201).json({ success: true, data: { risk } });
    } catch {
      return res.status(500).json({ success: false, error: { message: 'No se pudo registrar el riesgo' } });
    }
  }

  async update(req: Request, res: Response) {
    const parsed = updateRiskInput.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { message: 'Revisa los cambios del riesgo', details: parsed.error.errors } });
    }

    const projectId = req.params.id;
    const riskId = req.params.riskId;
    try {
      const before = await this.findRisk(projectId, riskId);
      if (!before) return res.status(404).json({ success: false, error: { message: 'Riesgo no encontrado' } });
      if (parsed.data.ownerId && !(await this.ownerBelongsToProject(projectId, parsed.data.ownerId))) {
        return res.status(400).json({ success: false, error: { message: 'El responsable debe pertenecer al proyecto' } });
      }

      const data = parsed.data;
      const updateResult = await pool.query(
        `UPDATE project_risks SET
           title = COALESCE($3, title),
           description = CASE WHEN $4 THEN $5 ELSE description END,
           probability = COALESCE($6, probability),
           impact = COALESCE($7, impact),
           residual_probability = CASE WHEN $8 THEN $9 ELSE residual_probability END,
           residual_impact = CASE WHEN $10 THEN $11 ELSE residual_impact END,
           mitigation_plan = COALESCE($12, mitigation_plan),
           owner_id = COALESCE($13, owner_id),
           status = COALESCE($14::"ProjectRiskStatus", status),
           next_review_at = CASE WHEN $15 THEN $16::date ELSE next_review_at END,
           updated_at = NOW()
         WHERE project_id = $1 AND id = $2`,
        [projectId, riskId, data.title ?? null, data.description !== undefined, data.description ?? null,
          data.probability ?? null, data.impact ?? null,
          data.residualProbability !== undefined, data.residualProbability ?? null,
          data.residualImpact !== undefined, data.residualImpact ?? null,
          data.mitigationPlan ?? null, data.ownerId ?? null, data.status ?? null,
          data.nextReviewAt !== undefined, data.nextReviewAt ?? null],
      );
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ success: false, error: { message: 'Riesgo no encontrado' } });
      }

      const after = await this.findRisk(projectId, riskId);
      if (!after) return res.status(404).json({ success: false, error: { message: 'Riesgo no encontrado' } });
      const changedStatus = before.status !== after.status;
      await this.recordEvent(req, projectId, after, changedStatus ? 'project.risk.status-changed' : 'project.risk.updated', {
        before: {
          title: before.title,
          probability: before.probability,
          impact: before.impact,
          residualProbability: before.residualProbability,
          residualImpact: before.residualImpact,
          mitigationPlan: before.mitigationPlan,
          ownerId: before.ownerId,
          status: before.status,
          nextReviewAt: before.nextReviewAt,
        },
        after: {
          title: after.title,
          probability: after.probability,
          impact: after.impact,
          residualProbability: after.residualProbability,
          residualImpact: after.residualImpact,
          mitigationPlan: after.mitigationPlan,
          ownerId: after.ownerId,
          status: after.status,
          nextReviewAt: after.nextReviewAt,
        },
      });
      return res.json({ success: true, data: { risk: after } });
    } catch {
      return res.status(500).json({ success: false, error: { message: 'No se pudo actualizar el riesgo' } });
    }
  }
}

export const projectRiskController = new ProjectRiskController();
