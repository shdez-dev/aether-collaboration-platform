import { Request, Response } from 'express';
import { z } from 'zod';
import { getClient, pool } from '../lib/db';
import { capabilityService } from '../services/CapabilityService';
import { portfolioAuthorizationService, type PortfolioAction, type PortfolioAccess } from '../services/PortfolioAuthorizationService';
import { projectAuthorizationService } from '../services/ProjectAuthorizationService';

const uuid = z.string().uuid();
const portfolioRole = z.enum(['ADMIN', 'MANAGER', 'VIEWER']);
const createInput = z.object({
  organizationId: uuid,
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10_000).nullable().optional(),
});
const updateInput = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, 'At least one field is required');
const memberInput = z.object({ userId: uuid, role: portfolioRole.default('VIEWER') });
const projectInput = z.object({ projectId: uuid });
const dateRangeFields = {
  effectiveFrom: z.coerce.date(),
  effectiveUntil: z.coerce.date().nullable().optional(),
};
const dateRange = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, ...dateRangeFields }).refine((value) => !value.effectiveUntil || value.effectiveUntil > value.effectiveFrom, {
  message: 'effectiveUntil must be after effectiveFrom',
});
const availabilityInput = dateRange({
  userId: uuid,
  weeklyAvailableMinutes: z.coerce.number().int().min(0).max(10_080),
});
const availabilityUpdateInput = dateRange({
  weeklyAvailableMinutes: z.coerce.number().int().min(0).max(10_080),
});
const allocationInput = dateRange({
  projectId: uuid,
  userId: uuid,
  weeklyMinutes: z.coerce.number().int().min(0).max(10_080),
});
const allocationUpdateInput = z.object({
  weeklyMinutes: z.coerce.number().int().min(0).max(10_080).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const alertLifecycleInput = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
});
const overviewQuery = z.object({
  workspaceId: uuid.optional(),
  teamId: uuid.optional(),
  status: z.string().trim().min(1).max(30).optional(),
  maturity: z.string().trim().min(1).max(30).optional(),
  priority: z.string().trim().min(1).max(30).optional(),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  ownerId: uuid.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: 'dateFrom must be before dateTo',
});

const fail = (res: Response, status: number, code: string, message: string, details?: unknown) =>
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } });

function actor(req: Request) { return req.user?.id; }

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Prevent spreadsheet formulas from executing when a directional CSV is opened. */
function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Portfolio metadata is a management resource, not a backdoor into projects. */
function formatPortfolio(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PortfolioController {
  private async requireCapability(res: Response, organizationId: string) {
    try {
      await capabilityService.require(organizationId, 'portfolio');
      return true;
    } catch (error: any) {
      return fail(res, 403, error?.code ?? 'CAPABILITY_REQUIRED', error?.message ?? 'Portfolio is not available for this organization');
    }
  }

  private async access(res: Response, portfolioId: string, userId: string, action: PortfolioAction): Promise<PortfolioAccess | null> {
    if (!uuid.safeParse(portfolioId).success) {
      fail(res, 400, 'VALIDATION_ERROR', 'Invalid portfolio id');
      return null;
    }
    const result = await portfolioAuthorizationService.can(portfolioId, userId, action);
    if (!result) {
      fail(res, 404, 'PORTFOLIO_NOT_FOUND', 'Portfolio not found or access denied');
      return null;
    }
    if (!(await this.requireCapability(res, result.organizationId))) return null;
    if (action !== 'READ' && result.archivedAt) {
      fail(res, 409, 'PORTFOLIO_ARCHIVED', 'Archived portfolios are read-only');
      return null;
    }
    return result;
  }

  private requireOrganizationAdmin(res: Response, access: PortfolioAccess) {
    if (access.implicitOrganizationAdmin) return true;
    fail(res, 403, 'FORBIDDEN', 'Organization administration is required for organization-wide capacity');
    return false;
  }

  /**
   * This is deliberately an executive projection. It never joins documents,
   * card content or comments, and it never uses portfolio membership as a
   * project grant. The caller obtains `canOpenProject` separately from the
   * project authorization service in one set query.
   */
  private async overviewRows(portfolioId: string, filters: z.infer<typeof overviewQuery>, limit = filters.limit, offset = (filters.page - 1) * filters.limit) {
    const values: unknown[] = [portfolioId];
    const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
    const baseWhere = ['pp.portfolio_id = $1'];
    if (filters.workspaceId) baseWhere.push(`p.workspace_id = ${param(filters.workspaceId)}::uuid`);
    if (filters.teamId) baseWhere.push(`EXISTS (SELECT 1 FROM project_teams filter_pt WHERE filter_pt.project_id = p.id AND filter_pt.team_id = ${param(filters.teamId)}::uuid)`);
    if (filters.status) baseWhere.push(`p.status = ${param(filters.status)}`);
    if (filters.maturity) baseWhere.push(`p.maturity_stage = ${param(filters.maturity)}`);
    if (filters.ownerId) baseWhere.push(`p.owner_id = ${param(filters.ownerId)}::uuid`);
    if (filters.dateFrom) baseWhere.push(`COALESCE(p.next_review_at, p.end_date, p.start_date) >= ${param(filters.dateFrom)}::date`);
    if (filters.dateTo) baseWhere.push(`COALESCE(p.next_review_at, p.end_date, p.start_date) <= ${param(filters.dateTo)}::date`);

    const scoredWhere: string[] = [];
    if (filters.priority) scoredWhere.push(`s.top_priority = ${param(filters.priority)}`);
    if (filters.risk) scoredWhere.push(`s.risk = ${param(filters.risk)}`);
    const where = scoredWhere.length ? `WHERE ${scoredWhere.join(' AND ')}` : '';
    const limitParam = param(limit);
    const offsetParam = param(offset);

    return pool.query(
      `WITH base AS (
         SELECT p.id, p.workspace_id, p.name, p.status, p.maturity_stage,
                p.next_step, p.start_date, p.end_date, p.next_review_at,
                p.owner_id, p.created_at, p.updated_at,
                w.name AS workspace_name,
                owner.name AS owner_name, owner.email AS owner_email,
                EXISTS (SELECT 1 FROM workspace_members owner_membership
                         WHERE owner_membership.workspace_id = p.workspace_id AND owner_membership.user_id = p.owner_id) AS owner_active
           FROM portfolio_projects pp
           JOIN projects p ON p.id = pp.project_id
           JOIN workspaces w ON w.id = p.workspace_id
           LEFT JOIN users owner ON owner.id = p.owner_id
          WHERE ${baseWhere.join(' AND ')}
       ),
       measured AS (
         SELECT b.*,
                COALESCE(cards.total_cards, 0)::int AS total_cards,
                COALESCE(cards.completed_cards, 0)::int AS completed_cards,
                COALESCE(cards.overdue_cards, 0)::int AS overdue_cards,
                COALESCE(cards.blocked_cards, 0)::int AS blocked_cards,
                cards.last_card_activity,
                workflow.last_workflow_activity,
                milestones.next_milestone_at,
                teams.teams,
                teams.team_count,
                cards.top_priority
           FROM base b
           LEFT JOIN LATERAL (
             SELECT COUNT(DISTINCT c.id)::int AS total_cards,
                    COUNT(DISTINCT c.id) FILTER (WHERE c.completed)::int AS completed_cards,
                    COUNT(DISTINCT c.id) FILTER (WHERE NOT c.completed AND c.due_date < CURRENT_DATE)::int AS overdue_cards,
                    COUNT(DISTINCT c.id) FILTER (WHERE NOT c.completed AND EXISTS (
                      SELECT 1 FROM card_dependencies cd
                      JOIN cards blocking ON blocking.id = cd.blocking_card_id
                       WHERE cd.blocked_card_id = c.id AND NOT blocking.completed
                    ))::int AS blocked_cards,
                    MAX(c.updated_at) AS last_card_activity,
                    (ARRAY_AGG(c.priority ORDER BY CASE c.priority
                      WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END)
                      FILTER (WHERE c.priority IS NOT NULL))[1] AS top_priority
               FROM project_boards pb
               JOIN lists l ON l.board_id = pb.board_id
               JOIN cards c ON c.list_id = l.id
              WHERE pb.project_id = b.id
           ) cards ON true
           LEFT JOIN LATERAL (
             SELECT MAX(pwh.created_at) AS last_workflow_activity
               FROM project_workflow_history pwh WHERE pwh.project_id = b.id
           ) workflow ON true
           LEFT JOIN LATERAL (
             SELECT MIN(pm.date) FILTER (WHERE pm.date >= CURRENT_DATE) AS next_milestone_at
               FROM project_milestones pm WHERE pm.project_id = b.id AND pm.status <> 'COMPLETED'
           ) milestones ON true
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS team_count,
                    COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) ORDER BY t.name), '[]'::jsonb) AS teams
               FROM project_teams pt JOIN teams t ON t.id = pt.team_id
              WHERE pt.project_id = b.id
           ) teams ON true
       ),
       scored AS (
         SELECT m.*,
                GREATEST(m.updated_at, COALESCE(m.last_card_activity, m.updated_at), COALESCE(m.last_workflow_activity, m.updated_at)) AS last_activity_at,
                CASE
                  WHEN m.overdue_cards > 0 OR m.blocked_cards > 0 OR (m.end_date IS NOT NULL AND m.end_date < CURRENT_DATE) THEN 'HIGH'
                  WHEN NULLIF(BTRIM(m.next_step), '') IS NULL
                    OR GREATEST(m.updated_at, COALESCE(m.last_card_activity, m.updated_at), COALESCE(m.last_workflow_activity, m.updated_at)) < CURRENT_TIMESTAMP - INTERVAL '14 days' THEN 'MEDIUM'
                  ELSE 'LOW'
                END AS risk,
                CASE
                  WHEN m.overdue_cards > 0 OR m.blocked_cards > 0 OR (m.end_date IS NOT NULL AND m.end_date < CURRENT_DATE) THEN 'AT_RISK'
                  WHEN NULLIF(BTRIM(m.next_step), '') IS NULL
                    OR GREATEST(m.updated_at, COALESCE(m.last_card_activity, m.updated_at), COALESCE(m.last_workflow_activity, m.updated_at)) < CURRENT_TIMESTAMP - INTERVAL '14 days' THEN 'ATTENTION'
                  ELSE 'HEALTHY'
                END AS health
           FROM measured m
       )
       SELECT s.*, COUNT(*) OVER()::int AS total_count
         FROM scored s
         ${where}
        ORDER BY CASE s.risk WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
                 s.next_review_at ASC NULLS LAST, s.updated_at DESC, s.id DESC
        LIMIT ${limitParam} OFFSET ${offsetParam}`,
      values,
    );
  }

  private formatOverviewRow(row: any, readableProjectIds: Set<string>) {
    const totalCards = Number(row.total_cards ?? 0);
    const completedCards = Number(row.completed_cards ?? 0);
    return {
      projectId: row.id,
      // This projection is useful for portfolio direction, but navigation is
      // only enabled when the project's own authorization says so.
      canOpenProject: readableProjectIds.has(row.id),
      name: row.name,
      workspace: { id: row.workspace_id, name: row.workspace_name },
      status: row.status,
      maturity: row.maturity_stage,
      health: row.health,
      risk: row.risk,
      progress: { totalCards, completedCards, percent: totalCards ? Math.round((completedCards / totalCards) * 100) : null },
      nextStep: row.next_step,
      nextReviewAt: row.next_review_at,
      nextMilestoneAt: row.next_milestone_at,
      owner: row.owner_id && row.owner_active ? { id: row.owner_id, name: row.owner_name } : null,
      teams: row.teams ?? [],
      topPriority: row.top_priority,
      indicators: { overdueCards: Number(row.overdue_cards ?? 0), blockedCards: Number(row.blocked_cards ?? 0), lastActivityAt: row.last_activity_at },
    };
  }

  private async capacitySnapshot(portfolioId: string, organizationId: string, readableProjectIds: Set<string>) {
    const [peopleResult, teamResult, allocationResult] = await Promise.all([
      pool.query(
        `WITH linked_projects AS (
           SELECT pp.project_id FROM portfolio_projects pp WHERE pp.portfolio_id = $1
         ), portfolio_people AS (
           SELECT DISTINCT pca.user_id
             FROM project_capacity_allocations pca JOIN linked_projects lp ON lp.project_id = pca.project_id
            WHERE pca.organization_id = $2
              AND pca.effective_from <= CURRENT_DATE AND (pca.effective_until IS NULL OR pca.effective_until > CURRENT_DATE)
           UNION
           SELECT DISTINCT tm.user_id
             FROM project_teams pt JOIN linked_projects lp ON lp.project_id = pt.project_id
             JOIN team_members tm ON tm.team_id = pt.team_id
         ), portfolio_allocations AS (
           SELECT pca.user_id, SUM(pca.weekly_minutes)::int AS weekly_minutes
             FROM project_capacity_allocations pca JOIN linked_projects lp ON lp.project_id = pca.project_id
            WHERE pca.organization_id = $2
              AND pca.effective_from <= CURRENT_DATE AND (pca.effective_until IS NULL OR pca.effective_until > CURRENT_DATE)
            GROUP BY pca.user_id
         ), organization_allocations AS (
           SELECT pca.user_id, SUM(pca.weekly_minutes)::int AS weekly_minutes
             FROM project_capacity_allocations pca
            WHERE pca.organization_id = $2
              AND pca.effective_from <= CURRENT_DATE AND (pca.effective_until IS NULL OR pca.effective_until > CURRENT_DATE)
            GROUP BY pca.user_id
         )
         SELECT u.id AS user_id, u.name, u.email,
                COALESCE(pa.weekly_minutes, 0)::int AS portfolio_allocated_minutes,
                COALESCE(oa.weekly_minutes, 0)::int AS allocated_minutes,
                COALESCE(av.weekly_available_minutes, 0)::int AS available_minutes
           FROM portfolio_people pp
           JOIN users u ON u.id = pp.user_id
           JOIN organization_members active_member ON active_member.organization_id = $2 AND active_member.user_id = pp.user_id
           LEFT JOIN portfolio_allocations pa ON pa.user_id = pp.user_id
           LEFT JOIN organization_allocations oa ON oa.user_id = pp.user_id
           LEFT JOIN LATERAL (
             SELECT omc.weekly_available_minutes
               FROM organization_member_capacities omc
              WHERE omc.organization_id = $2 AND omc.user_id = pp.user_id
                AND omc.effective_from <= CURRENT_DATE AND (omc.effective_until IS NULL OR omc.effective_until > CURRENT_DATE)
              ORDER BY omc.effective_from DESC, omc.updated_at DESC LIMIT 1
           ) av ON true
          WHERE NOT EXISTS (
            SELECT 1 FROM organization_access_revocations r
             WHERE r.organization_id = active_member.organization_id AND r.user_id = active_member.user_id
          )
          ORDER BY (COALESCE(oa.weekly_minutes, 0) > COALESCE(av.weekly_available_minutes, 0)) DESC, u.name`,
        [portfolioId, organizationId],
      ),
      pool.query(
        `WITH linked_projects AS (SELECT pp.project_id FROM portfolio_projects pp WHERE pp.portfolio_id = $1), linked_teams AS (
           SELECT DISTINCT t.id, t.name FROM project_teams pt JOIN linked_projects lp ON lp.project_id = pt.project_id JOIN teams t ON t.id = pt.team_id
         ), team_people AS (
           SELECT lt.id AS team_id, tm.user_id
             FROM linked_teams lt
             JOIN team_members tm ON tm.team_id = lt.id
             JOIN organization_members om ON om.organization_id = $2 AND om.user_id = tm.user_id
            WHERE NOT EXISTS (
              SELECT 1 FROM organization_access_revocations r
               WHERE r.organization_id = om.organization_id AND r.user_id = om.user_id
            )
         ), organization_allocations AS (
           SELECT user_id, SUM(weekly_minutes)::int AS weekly_minutes FROM project_capacity_allocations
            WHERE organization_id = $2 AND effective_from <= CURRENT_DATE AND (effective_until IS NULL OR effective_until > CURRENT_DATE) GROUP BY user_id
         )
         SELECT lt.id AS team_id, lt.name,
                COALESCE(member_metrics.member_count, 0)::int AS member_count,
                COALESCE(project_metrics.project_count, 0)::int AS project_count,
                COALESCE(member_metrics.allocated_minutes, 0)::int AS allocated_minutes,
                COALESCE(member_metrics.available_minutes, 0)::int AS available_minutes
           FROM linked_teams lt
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS member_count,
                    COALESCE(SUM(oa.weekly_minutes), 0)::int AS allocated_minutes,
                    COALESCE(SUM(av.weekly_available_minutes), 0)::int AS available_minutes
               FROM team_people tp
               LEFT JOIN organization_allocations oa ON oa.user_id = tp.user_id
               LEFT JOIN LATERAL (
                 SELECT omc.weekly_available_minutes FROM organization_member_capacities omc
                  WHERE omc.organization_id = $2 AND omc.user_id = tp.user_id AND omc.effective_from <= CURRENT_DATE
                    AND (omc.effective_until IS NULL OR omc.effective_until > CURRENT_DATE)
                  ORDER BY omc.effective_from DESC, omc.updated_at DESC LIMIT 1
               ) av ON true
              WHERE tp.team_id = lt.id
           ) member_metrics ON true
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS project_count FROM project_teams pt
              JOIN linked_projects lp ON lp.project_id = pt.project_id WHERE pt.team_id = lt.id
           ) project_metrics ON true
          ORDER BY (COALESCE(member_metrics.allocated_minutes, 0) > COALESCE(member_metrics.available_minutes, 0)) DESC, lt.name`,
        [portfolioId, organizationId],
      ),
      pool.query(
        `SELECT pca.project_id, pca.user_id, pca.weekly_minutes, p.name AS project_name, u.name AS user_name
           FROM project_capacity_allocations pca
           JOIN portfolio_projects pp ON pp.project_id = pca.project_id AND pp.portfolio_id = $1
           JOIN projects p ON p.id = pca.project_id
           JOIN users u ON u.id = pca.user_id
           JOIN organization_members active_member ON active_member.organization_id = $2 AND active_member.user_id = pca.user_id
          WHERE pca.organization_id = $2 AND pca.effective_from <= CURRENT_DATE
            AND (pca.effective_until IS NULL OR pca.effective_until > CURRENT_DATE)
            AND NOT EXISTS (
              SELECT 1 FROM organization_access_revocations r
               WHERE r.organization_id = active_member.organization_id AND r.user_id = active_member.user_id
            )
          ORDER BY p.name, u.name`,
        [portfolioId, organizationId],
      ),
    ]);
    const people = peopleResult.rows.map((row) => {
      const allocatedMinutes = Number(row.allocated_minutes ?? 0);
      const availableMinutes = Number(row.available_minutes ?? 0);
      return { userId: row.user_id, name: row.name, portfolioAllocatedMinutes: Number(row.portfolio_allocated_minutes ?? 0), allocatedMinutes, availableMinutes, loadPercent: availableMinutes ? Math.round((allocatedMinutes / availableMinutes) * 100) : null, overallocated: allocatedMinutes > availableMinutes };
    });
    return {
      people,
      teams: teamResult.rows.map((row) => {
        const allocatedMinutes = Number(row.allocated_minutes ?? 0); const availableMinutes = Number(row.available_minutes ?? 0);
        return { teamId: row.team_id, name: row.name, memberCount: Number(row.member_count ?? 0), projectCount: Number(row.project_count ?? 0), allocatedMinutes, availableMinutes, loadPercent: availableMinutes ? Math.round((allocatedMinutes / availableMinutes) * 100) : null, overallocated: allocatedMinutes > availableMinutes };
      }),
      allocations: allocationResult.rows.map((row) => ({ projectId: row.project_id, projectName: row.project_name, canOpenProject: readableProjectIds.has(row.project_id), userId: row.user_id, userName: row.user_name, weeklyMinutes: Number(row.weekly_minutes) })),
    };
  }

  async overview(req: Request, res: Response) {
    const userId = actor(req); const parsed = overviewQuery.safeParse(req.query);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid portfolio filters', parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'READ'); if (!access) return;
    const [result, readableProjectIds] = await Promise.all([
      this.overviewRows(req.params.id, parsed.data),
      projectAuthorizationService.getAccessibleProjectIds(userId),
    ]);
    const readable = new Set(readableProjectIds);
    const total = Number(result.rows[0]?.total_count ?? 0);
    return res.json({ success: true, data: {
      projects: result.rows.map((row) => this.formatOverviewRow(row, readable)),
      page: parsed.data.page,
      limit: parsed.data.limit,
      total,
      totalPages: Math.ceil(total / parsed.data.limit),
      permissions: { level: access.level },
    } });
  }

  /**
   * Evaluates the current portfolio synchronously so an operator does not
   * have to wait for a background job. Fingerprints make repeated reads safe;
   * acknowledged state is retained until a manager resolves it explicitly or
   * its underlying signal disappears during a manager-triggered evaluation.
   * Readers never cause this endpoint to write alert state.
   */
  async alerts(req: Request, res: Response) {
    const userId = actor(req);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const access = await this.access(res, req.params.id, userId, 'READ'); if (!access) return;
    const [overview, readableProjectIds] = await Promise.all([
      this.overviewRows(req.params.id, { page: 1, limit: 5_000 }, 5_000, 0),
      projectAuthorizationService.getAccessibleProjectIds(userId),
    ]);
    const evaluatedProjectCount = Number(overview.rows[0]?.total_count ?? 0);
    const readable = new Set(readableProjectIds);
    const capacity = await this.capacitySnapshot(req.params.id, access.organizationId, readable);
    const overallocatedUsers = new Set(capacity.people.filter((person) => person.overallocated).map((person) => person.userId));
    const desired = new Map<string, { projectId: string; type: string; severity: 'WARNING' | 'CRITICAL'; title: string; detail: string; metadata: Record<string, unknown> }>();
    const add = (projectId: string, type: string, severity: 'WARNING' | 'CRITICAL', title: string, detail: string, metadata: Record<string, unknown> = {}) => {
      desired.set(`${projectId}:${type}`, { projectId, type, severity, title, detail, metadata });
    };
    for (const row of overview.rows) {
      if (!String(row.next_step ?? '').trim()) add(row.id, 'NO_NEXT_STEP', 'WARNING', 'Proyecto sin próximo paso', 'Define una acción concreta para mantener el avance.', {});
      if (!row.owner_id || !row.owner_active) add(row.id, 'NO_OWNER', 'CRITICAL', 'Proyecto sin responsable', 'Asigna una persona responsable activa en el workspace.', {});
      if (new Date(row.last_activity_at).getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000) add(row.id, 'NO_ACTIVITY', 'WARNING', 'Proyecto sin actividad reciente', 'No se registró actividad en los últimos 14 días.', { lastActivityAt: row.last_activity_at });
      if (Number(row.overdue_cards) > 0 || (row.end_date && new Date(row.end_date).getTime() < Date.now())) add(row.id, 'OVERDUE', 'CRITICAL', 'Proyecto atrasado', 'Hay trabajo o una fecha de término vencida.', { overdueCards: Number(row.overdue_cards ?? 0), endDate: row.end_date });
      if (Number(row.blocked_cards) > 0) add(row.id, 'BLOCKED', 'CRITICAL', 'Proyecto bloqueado', 'Hay tarjetas bloqueadas por dependencias pendientes.', { blockedCards: Number(row.blocked_cards ?? 0) });
    }
    for (const allocation of capacity.allocations) {
      if (overallocatedUsers.has(allocation.userId)) add(allocation.projectId, 'CAPACITY_INSUFFICIENT', 'WARNING', 'Capacidad insuficiente', 'Una persona asignada supera su disponibilidad semanal.', { userId: allocation.userId });
    }

    // Readers can inspect the persisted executive signals, but refreshing an
    // alert is an operational write reserved for portfolio managers/admins.
    if (access.level !== 'VIEW') {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        for (const [fingerprint, alert] of desired) {
          await client.query(
            `INSERT INTO portfolio_alerts (id, portfolio_id, project_id, fingerprint, type, severity, status, title, detail, metadata)
             VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5::"PortfolioAlertSeverity", 'OPEN'::"PortfolioAlertStatus", $6, $7, $8::jsonb)
             ON CONFLICT (portfolio_id, fingerprint) DO UPDATE SET
               type = EXCLUDED.type, severity = EXCLUDED.severity, title = EXCLUDED.title,
               detail = EXCLUDED.detail, metadata = EXCLUDED.metadata,
               status = CASE
                 WHEN portfolio_alerts.status = 'RESOLVED'::"PortfolioAlertStatus"
                   THEN 'OPEN'::"PortfolioAlertStatus"
                 ELSE portfolio_alerts.status
               END,
               acknowledged_at = CASE WHEN portfolio_alerts.status = 'RESOLVED'::"PortfolioAlertStatus" THEN NULL ELSE portfolio_alerts.acknowledged_at END,
               acknowledged_by = CASE WHEN portfolio_alerts.status = 'RESOLVED'::"PortfolioAlertStatus" THEN NULL ELSE portfolio_alerts.acknowledged_by END,
               resolved_at = CASE WHEN portfolio_alerts.status = 'RESOLVED'::"PortfolioAlertStatus" THEN NULL ELSE portfolio_alerts.resolved_at END,
               resolved_by = CASE WHEN portfolio_alerts.status = 'RESOLVED'::"PortfolioAlertStatus" THEN NULL ELSE portfolio_alerts.resolved_by END`,
            [req.params.id, alert.projectId, fingerprint, alert.type, alert.severity, alert.title, alert.detail, JSON.stringify(alert.metadata)],
          );
        }
        // A signal that disappeared is resolved by the manager who performed
        // this evaluation. This keeps the append-only lifecycle meaningful and
        // prevents stale alerts appearing as active on later reads.
        // This endpoint evaluates a bounded page. Do not resolve alerts from
        // projects outside that page; a complete background evaluator can do
        // that safely when the portfolio grows beyond this threshold.
        if (evaluatedProjectCount <= 5_000) {
          await client.query(
            `UPDATE portfolio_alerts
                SET status = 'RESOLVED'::"PortfolioAlertStatus",
                    resolved_at = CURRENT_TIMESTAMP,
                    resolved_by = $2
              WHERE portfolio_id = $1
                AND status IN ('OPEN'::"PortfolioAlertStatus", 'ACKNOWLEDGED'::"PortfolioAlertStatus")
                AND NOT (fingerprint = ANY($3::text[]))`,
            [req.params.id, userId, [...desired.keys()]],
          );
        }
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
    const alerts = await pool.query(
      `SELECT id, project_id, fingerprint, type, severity, status, title, detail, metadata, acknowledged_at, resolved_at, created_at, updated_at
         FROM portfolio_alerts
        WHERE portfolio_id = $1 AND status <> 'RESOLVED'::"PortfolioAlertStatus"
        ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, updated_at DESC`,
      [req.params.id],
    );
    return res.json({ success: true, data: {
      alerts: alerts.rows.map((row) => ({ id: row.id, projectId: row.project_id, canOpenProject: readable.has(row.project_id), fingerprint: row.fingerprint, type: row.type, severity: row.severity, status: row.status, title: row.title, detail: row.detail, metadata: row.metadata, acknowledgedAt: row.acknowledged_at, resolvedAt: row.resolved_at, createdAt: row.created_at, updatedAt: row.updated_at })),
      evaluatedAt: new Date().toISOString(),
    } });
  }

  async capacity(req: Request, res: Response) {
    const userId = actor(req);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const access = await this.access(res, req.params.id, userId, 'READ'); if (!access) return;
    const readableProjectIds = new Set(await projectAuthorizationService.getAccessibleProjectIds(userId));
    return res.json({ success: true, data: await this.capacitySnapshot(req.params.id, access.organizationId, readableProjectIds) });
  }

  async addAvailability(req: Request, res: Response) {
    const userId = actor(req); const parsed = availabilityInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid availability', parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'ADMIN'); if (!access || !this.requireOrganizationAdmin(res, access)) return;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const portfolio = await client.query(`SELECT id FROM portfolios WHERE id = $1 AND archived_at IS NULL FOR KEY SHARE`, [req.params.id]);
      if (!portfolio.rows[0]) { await client.query('ROLLBACK'); return fail(res, 409, 'PORTFOLIO_ARCHIVED', 'Archived portfolios are read-only'); }
      const result = await client.query(
        `INSERT INTO organization_member_capacities
           (id, organization_id, user_id, weekly_available_minutes, effective_from, effective_until)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4::date, $5::date)
         RETURNING id, organization_id, user_id, weekly_available_minutes, effective_from, effective_until, created_at, updated_at`,
        [access.organizationId, parsed.data.userId, parsed.data.weeklyAvailableMinutes, formatDate(parsed.data.effectiveFrom), parsed.data.effectiveUntil ? formatDate(parsed.data.effectiveUntil) : null],
      );
      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { availability: result.rows[0] } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async updateAvailability(req: Request, res: Response) {
    const userId = actor(req); const recordId = uuid.safeParse(req.params.capacityId); const parsed = availabilityUpdateInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!recordId.success || !parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid availability', parsed.success ? undefined : parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'ADMIN'); if (!access || !this.requireOrganizationAdmin(res, access)) return;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT omc.* FROM organization_member_capacities omc
          JOIN portfolios p ON p.organization_id = omc.organization_id
         WHERE omc.id = $1 AND p.id = $2 AND p.archived_at IS NULL
         FOR UPDATE OF omc, p`,
        [recordId.data, req.params.id],
      );
      if (!current.rows[0]) { await client.query('ROLLBACK'); return fail(res, 404, 'AVAILABILITY_NOT_FOUND', 'Availability record not found'); }
      const result = await client.query(
        `UPDATE organization_member_capacities
            SET weekly_available_minutes = $1, effective_from = $2::date, effective_until = $3::date
          WHERE id = $4
          RETURNING id, organization_id, user_id, weekly_available_minutes, effective_from, effective_until, created_at, updated_at`,
        [parsed.data.weeklyAvailableMinutes, formatDate(parsed.data.effectiveFrom), parsed.data.effectiveUntil ? formatDate(parsed.data.effectiveUntil) : null, recordId.data],
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: { availability: result.rows[0] } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async removeAvailability(req: Request, res: Response) {
    const userId = actor(req); const recordId = uuid.safeParse(req.params.capacityId);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!recordId.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid availability id');
    const access = await this.access(res, req.params.id, userId, 'ADMIN'); if (!access || !this.requireOrganizationAdmin(res, access)) return;
    const result = await pool.query(
      `DELETE FROM organization_member_capacities omc
        USING portfolios p
       WHERE omc.id = $1 AND p.id = $2 AND p.organization_id = omc.organization_id AND p.archived_at IS NULL
       RETURNING omc.id`,
      [recordId.data, req.params.id],
    );
    if (!result.rows[0]) return fail(res, 404, 'AVAILABILITY_NOT_FOUND', 'Availability record not found');
    return res.status(204).send();
  }

  private async requireAllocationProjectAccess(access: PortfolioAccess, projectId: string, userId: string, res: Response) {
    // An organization administrator can govern portfolio planning. Explicit
    // portfolio roles, including ADMIN, still need MANAGE on the project: the
    // portfolio must never become a lateral project-management grant.
    if (access.implicitOrganizationAdmin) return true;
    if (await projectAuthorizationService.can(projectId, userId, 'MANAGE')) return true;
    fail(res, 403, 'FORBIDDEN', 'Project manage access is required to manage capacity');
    return false;
  }

  async addAllocation(req: Request, res: Response) {
    const userId = actor(req); const parsed = allocationInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid capacity allocation', parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    if (!(await this.requireAllocationProjectAccess(access, parsed.data.projectId, userId, res))) return;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const linked = await client.query(
        `SELECT pp.project_id FROM portfolio_projects pp JOIN portfolios p ON p.id = pp.portfolio_id
          WHERE pp.portfolio_id = $1 AND pp.project_id = $2 AND p.archived_at IS NULL
          FOR KEY SHARE OF pp, p`,
        [req.params.id, parsed.data.projectId],
      );
      if (!linked.rows[0]) { await client.query('ROLLBACK'); return fail(res, 400, 'PORTFOLIO_PROJECT_REQUIRED', 'Capacity can only be planned for a project linked to this portfolio'); }
      const result = await client.query(
        `INSERT INTO project_capacity_allocations
           (id, organization_id, project_id, user_id, weekly_minutes, effective_from, effective_until, assigned_by)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5::date, $6::date, $7)
         RETURNING id, organization_id, project_id, user_id, weekly_minutes, effective_from, effective_until, assigned_by, created_at, updated_at`,
        [access.organizationId, parsed.data.projectId, parsed.data.userId, parsed.data.weeklyMinutes, formatDate(parsed.data.effectiveFrom), parsed.data.effectiveUntil ? formatDate(parsed.data.effectiveUntil) : null, userId],
      );
      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { allocation: result.rows[0] } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async updateAllocation(req: Request, res: Response) {
    const userId = actor(req); const recordId = uuid.safeParse(req.params.allocationId); const parsed = allocationUpdateInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!recordId.success || !parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid capacity allocation', parsed.success ? undefined : parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT pca.* FROM project_capacity_allocations pca
          JOIN portfolio_projects pp ON pp.project_id = pca.project_id
          JOIN portfolios p ON p.id = pp.portfolio_id
         WHERE pca.id = $1 AND pp.portfolio_id = $2 AND p.archived_at IS NULL
         FOR UPDATE OF pca, pp, p`,
        [recordId.data, req.params.id],
      );
      const existing = current.rows[0];
      if (!existing) { await client.query('ROLLBACK'); return fail(res, 404, 'CAPACITY_ALLOCATION_NOT_FOUND', 'Capacity allocation not found'); }
      if (!(await this.requireAllocationProjectAccess(access, existing.project_id, userId, res))) { await client.query('ROLLBACK'); return; }
      const effectiveFrom = parsed.data.effectiveFrom ?? new Date(existing.effective_from);
      const effectiveUntil = parsed.data.effectiveUntil !== undefined ? parsed.data.effectiveUntil : (existing.effective_until ? new Date(existing.effective_until) : null);
      if (effectiveUntil && effectiveUntil <= effectiveFrom) { await client.query('ROLLBACK'); return fail(res, 400, 'VALIDATION_ERROR', 'effectiveUntil must be after effectiveFrom'); }
      const result = await client.query(
        `UPDATE project_capacity_allocations
            SET weekly_minutes = $1, effective_from = $2::date, effective_until = $3::date, assigned_by = $4
          WHERE id = $5
          RETURNING id, organization_id, project_id, user_id, weekly_minutes, effective_from, effective_until, assigned_by, created_at, updated_at`,
        [parsed.data.weeklyMinutes ?? existing.weekly_minutes, formatDate(effectiveFrom), effectiveUntil ? formatDate(effectiveUntil) : null, userId, recordId.data],
      );
      await client.query('COMMIT');
      return res.json({ success: true, data: { allocation: result.rows[0] } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async removeAllocation(req: Request, res: Response) {
    const userId = actor(req); const recordId = uuid.safeParse(req.params.allocationId);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!recordId.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid capacity allocation id');
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    const current = await pool.query(
      `SELECT pca.project_id FROM project_capacity_allocations pca
        JOIN portfolio_projects pp ON pp.project_id = pca.project_id
        JOIN portfolios p ON p.id = pp.portfolio_id
       WHERE pca.id = $1 AND pp.portfolio_id = $2 AND p.archived_at IS NULL`,
      [recordId.data, req.params.id],
    );
    if (!current.rows[0]) return fail(res, 404, 'CAPACITY_ALLOCATION_NOT_FOUND', 'Capacity allocation not found');
    if (!(await this.requireAllocationProjectAccess(access, current.rows[0].project_id, userId, res))) return;
    const result = await pool.query(`DELETE FROM project_capacity_allocations WHERE id = $1 RETURNING id`, [recordId.data]);
    if (!result.rows[0]) return fail(res, 404, 'CAPACITY_ALLOCATION_NOT_FOUND', 'Capacity allocation not found');
    return res.status(204).send();
  }

  async updateAlert(req: Request, res: Response) {
    const userId = actor(req); const alertId = uuid.safeParse(req.params.alertId); const parsed = alertLifecycleInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!alertId.success || !parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid alert lifecycle update', parsed.success ? undefined : parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT pa.* FROM portfolio_alerts pa JOIN portfolios p ON p.id = pa.portfolio_id
          WHERE pa.id = $1 AND pa.portfolio_id = $2 AND p.archived_at IS NULL
          FOR UPDATE OF pa, p`,
        [alertId.data, req.params.id],
      );
      const existing = current.rows[0];
      if (!existing) { await client.query('ROLLBACK'); return fail(res, 404, 'PORTFOLIO_ALERT_NOT_FOUND', 'Portfolio alert not found'); }
      if (existing.status === 'RESOLVED') { await client.query('COMMIT'); return res.json({ success: true, data: { alert: existing, unchanged: true } }); }
      if (parsed.data.status === 'ACKNOWLEDGED' && existing.status === 'ACKNOWLEDGED') { await client.query('COMMIT'); return res.json({ success: true, data: { alert: existing, unchanged: true } }); }
      const result = parsed.data.status === 'ACKNOWLEDGED'
        ? await client.query(
          `UPDATE portfolio_alerts SET status = 'ACKNOWLEDGED'::"PortfolioAlertStatus", acknowledged_at = CURRENT_TIMESTAMP, acknowledged_by = $1
            WHERE id = $2 RETURNING *`, [userId, alertId.data],
        )
        : await client.query(
          `UPDATE portfolio_alerts SET status = 'RESOLVED'::"PortfolioAlertStatus", resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
            WHERE id = $2 RETURNING *`, [userId, alertId.data],
        );
      await client.query('COMMIT');
      return res.json({ success: true, data: { alert: result.rows[0] } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async exportCsv(req: Request, res: Response) {
    const userId = actor(req); const parsed = overviewQuery.safeParse(req.query);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid portfolio filters', parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    try {
      await capabilityService.require(access.organizationId, 'analytics');
    } catch (error: any) {
      return fail(res, 403, error?.code ?? 'CAPABILITY_REQUIRED', error?.message ?? 'Analytics is not available for this organization');
    }
    // A bounded export prevents a direction view from becoming an uncontrolled
    // data extraction endpoint. Larger exports should be an asynchronous job.
    const result = await this.overviewRows(req.params.id, parsed.data, 10_000, 0);
    const header = ['project_id', 'project', 'workspace', 'status', 'maturity', 'health', 'risk', 'progress_percent', 'next_step', 'next_review_at', 'next_milestone_at', 'owner', 'teams', 'top_priority', 'overdue_cards', 'blocked_cards', 'last_activity_at'];
    const lines = [header.map(csvCell).join(',')];
    for (const row of result.rows) {
      const overview = this.formatOverviewRow(row, new Set<string>());
      lines.push([
        overview.projectId, overview.name, overview.workspace.name, overview.status, overview.maturity, overview.health, overview.risk,
        overview.progress.percent, overview.nextStep, overview.nextReviewAt, overview.nextMilestoneAt, overview.owner?.name ?? null,
        (overview.teams as Array<{ name: string }>).map((team) => team.name).join('; '), overview.topPriority,
        overview.indicators.overdueCards, overview.indicators.blockedCards, overview.indicators.lastActivityAt,
      ].map(csvCell).join(','));
    }
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO portfolio_export_audits (id, portfolio_id, organization_id, exported_by, filters, row_count)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4::jsonb, $5)`,
        [req.params.id, access.organizationId, userId, JSON.stringify({ ...parsed.data, page: undefined, limit: undefined }), result.rows.length],
      );
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="portfolio-${req.params.id}.csv"`);
    return res.status(200).send(`\uFEFF${lines.join('\n')}\n`);
  }

  async projectCandidates(req: Request, res: Response) {
    const userId = actor(req);
    const parsed = z.object({
      workspaceId: uuid.optional(),
      query: z.string().trim().min(1).max(100).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).safeParse(req.query);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid project candidate filters', parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    const values: unknown[] = [access.organizationId, userId];
    const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
    const where = ['w.organization_id = $1'];
    if (parsed.data.workspaceId) where.push(`p.workspace_id = ${param(parsed.data.workspaceId)}::uuid`);
    if (parsed.data.query) where.push(`(p.name ILIKE ${param(`%${parsed.data.query}%`)} OR w.name ILIKE ${param(`%${parsed.data.query}%`)})`);
    if (!access.implicitOrganizationAdmin) {
      // Mirrors ProjectAuthorizationService MANAGE precisely, but remains set
      // based so candidates are safe and efficient for large organizations.
      where.push(`(
        (p.owner_id = $2 AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $2))
        OR EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = p.workspace_id AND wm.user_id = $2 AND wm.role IN ('OWNER', 'ADMIN'))
        OR EXISTS (
          SELECT 1 FROM project_members pm JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pm.user_id
           WHERE pm.project_id = p.id AND pm.user_id = $2 AND pm.role IN ('OWNER', 'ADMIN')
        )
        OR EXISTS (
          SELECT 1 FROM project_role_assignments pra JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = pra.user_id
           WHERE pra.project_id = p.id AND pra.user_id = $2 AND pra.ended_at IS NULL AND pra.role = 'PROJECT_LEAD'
        )
      )`);
    }
    const limit = param(parsed.data.limit);
    const result = await pool.query(
      `SELECT p.id, p.name, p.status, p.maturity_stage, p.owner_id, w.id AS workspace_id, w.name AS workspace_name
         FROM projects p JOIN workspaces w ON w.id = p.workspace_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.updated_at DESC, p.id DESC LIMIT ${limit}`,
      values,
    );
    return res.json({ success: true, data: { projects: result.rows.map((row) => ({
      id: row.id, name: row.name, status: row.status, maturity: row.maturity_stage,
      workspace: { id: row.workspace_id, name: row.workspace_name }, ownerId: row.owner_id,
    })) } });
  }

  async list(req: Request, res: Response) {
    const userId = actor(req);
    const organization = uuid.safeParse(req.query.organizationId);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!organization.success) return fail(res, 400, 'VALIDATION_ERROR', 'organizationId is required');
    if (!(await portfolioAuthorizationService.canAccessOrganization(organization.data, userId))) {
      return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Organization not found or access denied');
    }
    if (!(await this.requireCapability(res, organization.data))) return;
    const result = await pool.query(
      `SELECT p.*, pm.role AS member_role,
              (o.owner_user_id = $2 OR EXISTS (
                SELECT 1 FROM organization_members om
                 WHERE om.organization_id = p.organization_id AND om.user_id = $2 AND om.role IN ('OWNER', 'ADMIN')
              )) AS organization_admin,
              COUNT(DISTINCT pp.project_id)::int AS project_count,
              COUNT(DISTINCT members.user_id)::int AS member_count
         FROM portfolios p
         JOIN organizations o ON o.id = p.organization_id
         LEFT JOIN portfolio_members pm ON pm.portfolio_id = p.id AND pm.user_id = $2
         LEFT JOIN portfolio_projects pp ON pp.portfolio_id = p.id
         LEFT JOIN portfolio_members members ON members.portfolio_id = p.id
        WHERE p.organization_id = $1
          AND (p.archived_at IS NULL OR $3 = 'true')
          AND (
            o.owner_user_id = $2
            OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.organization_id AND om.user_id = $2 AND om.role IN ('OWNER', 'ADMIN'))
            OR pm.user_id IS NOT NULL
          )
        GROUP BY p.id, pm.role, o.owner_user_id
        ORDER BY p.archived_at NULLS FIRST, p.updated_at DESC`,
      [organization.data, userId, req.query.includeArchived === 'true'],
    );
    return res.json({ success: true, data: { portfolios: result.rows.map((row) => ({
      ...formatPortfolio(row),
      projectCount: row.project_count,
      memberCount: row.member_count,
      role: row.organization_admin ? 'ADMIN' : row.member_role,
    })) } });
  }

  async create(req: Request, res: Response) {
    const userId = actor(req); const parsed = createInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid portfolio data', parsed.error.errors);
    if (!await portfolioAuthorizationService.canAdministerOrganization(parsed.data.organizationId, userId)) {
      return fail(res, 403, 'FORBIDDEN', 'Organization administration is required to create a portfolio');
    }
    if (!(await this.requireCapability(res, parsed.data.organizationId))) return;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const organization = await client.query(
        `SELECT id FROM organizations WHERE id = $1 FOR SHARE`, [parsed.data.organizationId],
      );
      if (!organization.rows[0]) { await client.query('ROLLBACK'); return fail(res, 404, 'ORGANIZATION_NOT_FOUND', 'Organization not found'); }
      const created = await client.query(
        `INSERT INTO portfolios (id, organization_id, name, description, created_by)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4) RETURNING *`,
        [parsed.data.organizationId, parsed.data.name, parsed.data.description ?? null, userId],
      );
      // Keep the creator's administrator role explicit. This preserves the
      // portfolio grant if their organization role later becomes MEMBER.
      await client.query(
        `INSERT INTO portfolio_members (portfolio_id, user_id, role, added_by)
         VALUES ($1, $2, 'ADMIN'::"PortfolioMemberRole", $2)`,
        [created.rows[0].id, userId],
      );
      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { portfolio: formatPortfolio(created.rows[0]) } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async get(req: Request, res: Response) {
    const userId = actor(req); if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const access = await this.access(res, req.params.id, userId, 'READ'); if (!access) return;
    const [portfolio, links] = await Promise.all([
      pool.query(`SELECT * FROM portfolios WHERE id = $1`, [req.params.id]),
      // Do not select project names, status, owners or documents here. Linking a
      // project is not a grant of ProjectAuthorizationService access.
      pool.query(`SELECT project_id, added_at FROM portfolio_projects WHERE portfolio_id = $1 ORDER BY added_at DESC`, [req.params.id]),
    ]);
    if (!portfolio.rows[0]) return fail(res, 404, 'PORTFOLIO_NOT_FOUND', 'Portfolio not found');
    // A portfolio reader can consume the executive projection but does not
    // need a directory of every person participating in the portfolio.
    const members = access.level === 'VIEW'
      ? { rows: [] as any[] }
      : await pool.query(
        `SELECT pm.user_id, pm.role, pm.added_at, pm.updated_at, u.name, u.email, u.avatar
           FROM portfolio_members pm JOIN users u ON u.id = pm.user_id
          WHERE pm.portfolio_id = $1 ORDER BY CASE pm.role WHEN 'ADMIN' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END, u.name`,
        [req.params.id],
      );
    return res.json({ success: true, data: {
      portfolio: formatPortfolio(portfolio.rows[0]),
      members: members.rows.map((member) => ({ userId: member.user_id, role: member.role, addedAt: member.added_at, updatedAt: member.updated_at, user: { name: member.name, email: member.email, avatar: member.avatar } })),
      projectLinks: links.rows.map((link) => ({ projectId: link.project_id, addedAt: link.added_at })),
      permissions: {
        level: access.level,
        canManage: access.level !== 'VIEW',
        canAdminister: access.level === 'ADMIN',
        canManageOrganizationCapacity: access.implicitOrganizationAdmin,
      },
    } });
  }

  async update(req: Request, res: Response) {
    const userId = actor(req); const parsed = updateInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid portfolio data', parsed.error.errors);
    if (!(await this.access(res, req.params.id, userId, 'MANAGE'))) return;
    const fields: string[] = []; const values: unknown[] = [];
    if (parsed.data.name !== undefined) { values.push(parsed.data.name); fields.push(`name = $${values.length}`); }
    if (parsed.data.description !== undefined) { values.push(parsed.data.description); fields.push(`description = $${values.length}`); }
    values.push(req.params.id);
    const result = await pool.query(`UPDATE portfolios SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return fail(res, 404, 'PORTFOLIO_NOT_FOUND', 'Portfolio not found');
    return res.json({ success: true, data: { portfolio: formatPortfolio(result.rows[0]) } });
  }

  async archive(req: Request, res: Response) {
    const userId = actor(req); if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!(await this.access(res, req.params.id, userId, 'ADMIN'))) return;
    const result = await pool.query(`UPDATE portfolios SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND archived_at IS NULL RETURNING *`, [req.params.id]);
    if (!result.rows[0]) return fail(res, 409, 'PORTFOLIO_ARCHIVED', 'Portfolio is already archived or no longer exists');
    return res.json({ success: true, data: { portfolio: formatPortfolio(result.rows[0]) } });
  }

  async addMember(req: Request, res: Response) {
    const userId = actor(req); const parsed = memberInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid portfolio member', parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'ADMIN'); if (!access) return;
    const client = await getClient();
    try {
      await client.query('BEGIN');
      // Lock organization membership before the insert; the DB trigger repeats
      // the invariant and protects direct SQL writes as well.
      const organizationMember = await client.query(
        `SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 FOR SHARE`,
        [access.organizationId, parsed.data.userId],
      );
      if (!organizationMember.rows[0]) { await client.query('ROLLBACK'); return fail(res, 400, 'ORGANIZATION_MEMBERSHIP_REQUIRED', 'An active organization member is required'); }
      const result = await client.query(
        `INSERT INTO portfolio_members (portfolio_id, user_id, role, added_by)
         VALUES ($1, $2, $3::"PortfolioMemberRole", $4)
         ON CONFLICT (portfolio_id, user_id) DO UPDATE SET role = EXCLUDED.role, added_by = EXCLUDED.added_by
         RETURNING portfolio_id, user_id, role, added_at, updated_at`,
        [req.params.id, parsed.data.userId, parsed.data.role, userId],
      );
      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: { member: result.rows[0] } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async removeMember(req: Request, res: Response) {
    const userId = actor(req); const target = uuid.safeParse(req.params.userId);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!target.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid user id');
    if (!(await this.access(res, req.params.id, userId, 'ADMIN'))) return;
    const result = await pool.query(`DELETE FROM portfolio_members WHERE portfolio_id = $1 AND user_id = $2 RETURNING user_id`, [req.params.id, target.data]);
    if (!result.rows[0]) return fail(res, 404, 'PORTFOLIO_MEMBER_NOT_FOUND', 'Portfolio member not found');
    return res.status(204).send();
  }

  async addProject(req: Request, res: Response) {
    const userId = actor(req); const parsed = projectInput.safeParse(req.body);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!parsed.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid project link', parsed.error.errors);
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    // Portfolio membership never grants project governance. Only an
    // organization administrator may curate links without being a project
    // manager; every explicit portfolio role needs MANAGE on that project.
    if (!access.implicitOrganizationAdmin && !(await projectAuthorizationService.can(parsed.data.projectId, userId, 'MANAGE'))) {
      return fail(res, 403, 'FORBIDDEN', 'Project manage access is required to link a project');
    }
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const project = await client.query(
        `SELECT p.id FROM projects p JOIN workspaces w ON w.id = p.workspace_id
          WHERE p.id = $1 AND w.organization_id = $2 FOR SHARE OF p, w`,
        [parsed.data.projectId, access.organizationId],
      );
      if (!project.rows[0]) { await client.query('ROLLBACK'); return fail(res, 400, 'PROJECT_ORGANIZATION_MISMATCH', 'Project must belong to this portfolio organization'); }
      const linked = await client.query(
        `INSERT INTO portfolio_projects (portfolio_id, project_id, added_by)
         VALUES ($1, $2, $3) ON CONFLICT (portfolio_id, project_id) DO NOTHING
         RETURNING portfolio_id, project_id, added_at`,
        [req.params.id, parsed.data.projectId, userId],
      );
      await client.query('COMMIT');
      return res.status(linked.rows[0] ? 201 : 200).json({ success: true, data: { projectLink: linked.rows[0] ?? { portfolioId: req.params.id, projectId: parsed.data.projectId, existing: true } } });
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async removeProject(req: Request, res: Response) {
    const userId = actor(req); const project = uuid.safeParse(req.params.projectId);
    if (!userId) return fail(res, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!project.success) return fail(res, 400, 'VALIDATION_ERROR', 'Invalid project id');
    const access = await this.access(res, req.params.id, userId, 'MANAGE'); if (!access) return;
    if (!access.implicitOrganizationAdmin && !(await projectAuthorizationService.can(project.data, userId, 'MANAGE'))) {
      return fail(res, 403, 'FORBIDDEN', 'Project manage access is required to remove a project link');
    }
    const result = await pool.query(`DELETE FROM portfolio_projects WHERE portfolio_id = $1 AND project_id = $2 RETURNING project_id`, [req.params.id, project.data]);
    if (!result.rows[0]) return fail(res, 404, 'PORTFOLIO_PROJECT_NOT_FOUND', 'Portfolio project link not found');
    return res.status(204).send();
  }
}

export const portfolioController = new PortfolioController();
