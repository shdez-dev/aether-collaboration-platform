import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { authenticateJWT } from '../middleware/auth';
import { pool, query } from '../lib/db';
import { getRealtimeGateway } from '../websocket/RealtimeGateway';
import { checkRedisHealth } from '../lib/redis';

const router = Router();
router.use(authenticateJWT);

const announcementSchema = z.object({
  requestId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
});
const planChangeSchema = z.object({ planCode: z.enum(['AUTO', 'FREE', 'TEAMS', 'PORTFOLIO', 'INSTITUTIONAL', 'NETWORK']) });
const organizationCreationTypes = ['INSTITUTION', 'NETWORK_OPERATOR'] as const;
const organizationCreationPermissionsSchema = z.object({
  types: z.array(z.enum(organizationCreationTypes)).max(organizationCreationTypes.length)
    .refine((types) => new Set(types).size === types.length, 'Organization types must be unique'),
});
const uuidSchema = z.string().uuid();
const feedbackStatusSchema = z.object({ status: z.enum(['NEW', 'IN_REVIEW', 'RESOLVED']) });

// Un único identificador estable, configurado solo en el servidor. Sin valor
// por defecto: una instalación sin administrador explícito no expone datos.
function isPlatformAdmin(userId: string): boolean {
  const configuredId = process.env.PLATFORM_ADMIN_USER_ID?.trim();
  return Boolean(configuredId && configuredId.toLowerCase() === userId.toLowerCase());
}

function pagination(req: Request) {
  const page = Math.max(1, Math.min(10000, Number.parseInt(String(req.query.page ?? '1'), 10) || 1));
  const limit = 20;
  const search = String(req.query.search ?? '').trim().slice(0, 100);
  return { page, limit, offset: (page - 1) * limit, search };
}

function requirePlatformAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId || !isPlatformAdmin(userId)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Acceso exclusivo para administradores de la plataforma' } });
    return;
  }
  next();
}

router.get('/access', (req, res) => {
  const userId = (req as Request & { user?: { id: string } }).user?.id;
  res.json({ success: true, data: { platformAdmin: Boolean(userId && isPlatformAdmin(userId)) } });
});

router.use(requirePlatformAdmin);

router.get('/overview', async (_req, res, next) => {
  try {
    const [totals, recentUsers, registrations] = await Promise.all([
      query<{
        users: number; verified_users: number; new_users_7d: number; new_users_30d: number;
        organizations: number; workspaces: number; projects: number; teams: number; boards: number;
        cards: number; documents: number; pending_invitations: number; active_subscriptions: number;
      }>(`SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM users WHERE email_verified = true) AS verified_users,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
        (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,
        (SELECT COUNT(*)::int FROM organizations) AS organizations,
        (SELECT COUNT(*)::int FROM workspaces) AS workspaces,
        (SELECT COUNT(*)::int FROM projects) AS projects,
        (SELECT COUNT(*)::int FROM teams) AS teams,
        (SELECT COUNT(*)::int FROM boards) AS boards,
        (SELECT COUNT(*)::int FROM cards) AS cards,
        (SELECT COUNT(*)::int FROM documents) AS documents,
        (SELECT COUNT(*)::int FROM organization_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()) AS pending_invitations,
        (SELECT COUNT(*)::int FROM subscriptions WHERE status IN ('ACTIVE', 'TRIALING')) AS active_subscriptions`),
      query<{ id: string; name: string; email: string; created_at: Date; email_verified: boolean }>(
        'SELECT id, name, email, created_at, email_verified FROM users ORDER BY created_at DESC LIMIT 8'
      ),
      query<{ day: string; count: number }>(`SELECT days.day::date::text AS day, COUNT(u.id)::int AS count
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS days(day)
        LEFT JOIN users u ON u.created_at::date = days.day::date
        GROUP BY days.day ORDER BY days.day`),
    ]);

    const onlineUserIds = getRealtimeGateway().getOnlineUserIds();
    res.json({ success: true, data: {
      totals: { ...totals.rows[0], online_users: onlineUserIds.size },
      registrations: registrations.rows,
      recentUsers: recentUsers.rows.map((user) => ({
        id: user.id, name: user.name, email: user.email,
        createdAt: user.created_at, emailVerified: user.email_verified,
        online: onlineUserIds.has(user.id),
      })),
      generatedAt: new Date().toISOString(),
      onlineScope: 'current_instance',
    } });
  } catch (error) {
    next(error);
  }
});

router.get('/feedback', async (req, res, next) => {
  const { page, limit, offset, search } = pagination(req);
  const status = z.enum(['all', 'NEW', 'IN_REVIEW', 'RESOLVED']).safeParse(String(req.query.status ?? 'all'));
  const type = z.enum(['all', 'FEEDBACK', 'BUG']).safeParse(String(req.query.type ?? 'all'));
  if (!status.success || !type.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'El filtro de comentarios no es válido.' } });
  }

  const params: unknown[] = [`%${search}%`];
  let where = `WHERE (f.title ILIKE $1 OR f.description ILIKE $1
    OR COALESCE(f.reproduction_steps, '') ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1)`;
  if (status.data !== 'all') {
    params.push(status.data);
    where += ` AND f.status = $${params.length}::"FeedbackStatus"`;
  }
  if (type.data !== 'all') {
    params.push(type.data);
    where += ` AND f.type = $${params.length}::"FeedbackType"`;
  }
  const listParams = [...params, limit, offset];

  try {
    const [rows, count] = await Promise.all([
      query(`SELECT f.id, f.type, f.title, f.description, f.reproduction_steps,
        f.page_path, f.status, f.handled_at, f.created_at, f.updated_at,
        u.id AS user_id, u.name AS user_name, u.email AS user_email
        FROM feedback_submissions f JOIN users u ON u.id = f.user_id
        ${where}
        ORDER BY CASE f.status WHEN 'NEW' THEN 0 WHEN 'IN_REVIEW' THEN 1 ELSE 2 END,
          f.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, listParams),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total
        FROM feedback_submissions f JOIN users u ON u.id = f.user_id ${where}`, params),
    ]);
    return res.json({ success: true, data: {
      feedback: rows.rows.map((row) => ({
        id: row.id, type: row.type, title: row.title, description: row.description,
        reproductionSteps: row.reproduction_steps, pagePath: row.page_path,
        status: row.status, handledAt: row.handled_at, createdAt: row.created_at,
        updatedAt: row.updated_at, userId: row.user_id, userName: row.user_name, userEmail: row.user_email,
      })),
      page, pageSize: limit, total: count.rows[0]?.total ?? 0,
    } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/feedback/:feedbackId', async (req, res, next) => {
  const id = uuidSchema.safeParse(req.params.feedbackId);
  const input = feedbackStatusSchema.safeParse(req.body);
  if (!id.success || !input.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'El comentario o su estado no son válidos.' } });
  }

  try {
    const updated = await query<{ id: string; status: string; handled_at: Date | null }>(
      `UPDATE feedback_submissions
       SET status = $2::"FeedbackStatus",
           handled_at = CASE WHEN $2::"FeedbackStatus" = 'RESOLVED' THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, status, handled_at`,
      [id.data, input.data.status],
    );
    if (!updated.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'FEEDBACK_NOT_FOUND', message: 'No encontramos ese comentario.' } });
    }
    return res.json({ success: true, data: {
      id: updated.rows[0].id, status: updated.rows[0].status, handledAt: updated.rows[0].handled_at,
    } });
  } catch (error) {
    return next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { page, limit, offset, search } = pagination(req);
    const filter = String(req.query.filter ?? 'all');
    const onlineIds = [...getRealtimeGateway().getOnlineUserIds()];
    const onlineFilter = filter === 'online';
    const params: unknown[] = onlineFilter ? [`%${search}%`, onlineIds, limit, offset] : [`%${search}%`, limit, offset];
    const where = `WHERE (u.name ILIKE $1 OR u.email ILIKE $1)
      ${filter === 'verified' ? 'AND u.email_verified = true' : filter === 'unverified' ? 'AND u.email_verified = false' : onlineFilter ? 'AND u.id = ANY($2::uuid[])' : ''}`;
    const [rows, count] = await Promise.all([
      query(`SELECT u.id, u.name, u.email, u.email_verified, u.created_at,
        (SELECT COUNT(*)::int FROM organization_members om WHERE om.user_id = u.id) AS organizations,
        (SELECT COUNT(*)::int FROM workspace_members wm WHERE wm.user_id = u.id) AS workspaces,
        (SELECT MAX(ual.created_at) FROM user_activity_log ual WHERE ual.user_id = u.id) AS last_activity_at,
        personal_org.id AS personal_organization_id,
        COALESCE(personal_plan.plan_code, 'FREE') AS personal_plan,
        CASE WHEN personal_plan.provider = 'platform-admin' THEN 'ADMIN' ELSE 'AUTOMATIC' END AS personal_plan_source,
        COALESCE((SELECT array_agg(g.organization_type::text ORDER BY g.organization_type::text)
          FROM user_organization_creation_grants g
          WHERE g.user_id = u.id AND g.organization_type <> 'COMPANY'), ARRAY[]::text[]) AS organization_creation_types
        FROM users u
        LEFT JOIN LATERAL (
          SELECT o.id FROM organizations o
          WHERE o.owner_user_id = u.id AND o.type = 'PERSONAL'
          ORDER BY o.created_at ASC LIMIT 1
        ) personal_org ON true
        LEFT JOIN LATERAL (
          SELECT s.plan_code, s.provider FROM subscriptions s
          WHERE s.organization_id = personal_org.id
            AND s.status IN ('ACTIVE', 'TRIALING', 'PAST_DUE')
            AND (s.current_period_end IS NULL OR s.current_period_end > CURRENT_TIMESTAMP)
          ORDER BY CASE WHEN s.provider = 'platform-admin' THEN 0 ELSE 1 END,
            CASE s.status WHEN 'ACTIVE' THEN 1 WHEN 'TRIALING' THEN 2 ELSE 3 END,
            s.updated_at DESC, s.created_at DESC, s.id DESC
          LIMIT 1
        ) personal_plan ON true
        ${where}
        ORDER BY u.created_at DESC LIMIT $${onlineFilter ? 3 : 2} OFFSET $${onlineFilter ? 4 : 3}`, params),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM users u ${where}`, onlineFilter ? params.slice(0, 2) : params.slice(0, 1)),
    ]);
    res.json({ success: true, data: {
      users: rows.rows.map((row) => ({
        id: row.id, name: row.name, email: row.email, emailVerified: row.email_verified,
        createdAt: row.created_at, lastActivityAt: row.last_activity_at,
        organizations: row.organizations, workspaces: row.workspaces,
        personalOrganizationId: row.personal_organization_id,
        personalPlan: row.personal_plan,
        personalPlanSource: row.personal_plan_source,
        organizationCreationTypes: row.organization_creation_types ?? [],
        online: onlineIds.includes(row.id),
      })),
      page, pageSize: limit, total: count.rows[0]?.total ?? 0,
    } });
  } catch (error) { next(error); }
});

router.patch('/users/:userId/plan', async (req, res, next) => {
  const userId = uuidSchema.safeParse(req.params.userId);
  const input = planChangeSchema.safeParse(req.body);
  if (!userId.success || !input.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Usuario o plan inválido' } });
  try {
    const personal = await query<{ id: string }>(
      `SELECT id FROM organizations WHERE owner_user_id = $1 AND type = 'PERSONAL' ORDER BY created_at ASC LIMIT 1`,
      [userId.data],
    );
    const organizationId = personal.rows[0]?.id;
    if (!organizationId) return res.status(404).json({ success: false, error: { code: 'PERSONAL_ORGANIZATION_NOT_FOUND', message: 'La cuenta no tiene una organización personal' } });

    if (input.data.planCode === 'AUTO') {
      await query(`UPDATE subscriptions SET status = 'CANCELED', updated_at = CURRENT_TIMESTAMP
        WHERE provider_subscription_id = 'platform-admin:' || $1`, [organizationId]);
    } else {
      await query(`INSERT INTO subscriptions (id, organization_id, plan_code, status, provider, provider_subscription_id, current_period_end, cancel_at_period_end, created_at, updated_at)
        VALUES (uuid_generate_v4(), $1, $2, 'ACTIVE', 'platform-admin', 'platform-admin:' || $1, NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (provider_subscription_id)
        DO UPDATE SET plan_code = EXCLUDED.plan_code, status = 'ACTIVE', current_period_end = NULL,
          cancel_at_period_end = FALSE, updated_at = CURRENT_TIMESTAMP`, [organizationId, input.data.planCode]);
    }
    const effective = await query<{ plan_code: string; provider: string | null }>(`SELECT plan_code, provider FROM subscriptions
      WHERE organization_id = $1 AND status IN ('ACTIVE', 'TRIALING', 'PAST_DUE')
        AND (current_period_end IS NULL OR current_period_end > CURRENT_TIMESTAMP)
      ORDER BY CASE WHEN provider = 'platform-admin' THEN 0 ELSE 1 END,
        CASE status WHEN 'ACTIVE' THEN 1 WHEN 'TRIALING' THEN 2 ELSE 3 END,
        updated_at DESC, created_at DESC, id DESC LIMIT 1`, [organizationId]);
    const plan = effective.rows[0];
    return res.json({ success: true, data: {
      personalOrganizationId: organizationId,
      planCode: plan?.plan_code ?? 'FREE',
      source: plan?.provider === 'platform-admin' ? 'ADMIN' : 'AUTOMATIC',
    } });
  } catch (error) { next(error); }
});

router.patch('/users/:userId/organization-creation-permissions', async (req, res, next) => {
  const userId = uuidSchema.safeParse(req.params.userId);
  const input = organizationCreationPermissionsSchema.safeParse(req.body);
  if (!userId.success || !input.success) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Usuario o tipos de organización inválidos' } });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const target = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId.data]);
    if (!target.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'No encontramos esa cuenta' } });
    }

    await client.query('DELETE FROM user_organization_creation_grants WHERE user_id = $1', [userId.data]);
    if (input.data.types.length > 0) {
      await client.query(
        `INSERT INTO user_organization_creation_grants (user_id, organization_type, granted_by)
         SELECT $1, organization_type::"OrganizationType", $3
           FROM unnest($2::text[]) AS requested(organization_type)`,
        [userId.data, input.data.types, req.user!.id],
      );
    }
    await client.query('COMMIT');
    return res.json({ success: true, data: { types: input.data.types } });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    return next(error);
  } finally {
    client?.release();
  }
});

router.post('/announcements', async (req, res, next) => {
  const input = announcementSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Escribe un título y un mensaje válidos' } });
  const { requestId, title, message } = input.data;
  const authorId = req.user!.id;
  const dedupeKey = `admin-announcement:${requestId}`;
  try {
    const inserted = await query<{ id: string; user_id: string }>(
      `INSERT INTO notifications (id, user_id, type, title, message, data, dedupe_key, read, created_at)
       SELECT uuid_generate_v4(), u.id, 'ADMIN_ANNOUNCEMENT', $1, $2,
         jsonb_build_object('announcementId', $3::text, 'authorId', $4::text), $5, FALSE, CURRENT_TIMESTAMP
       FROM users u
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING id, user_id`,
      [title, message, requestId, authorId, dedupeKey],
    );
    const delivered = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE dedupe_key = $1`, [dedupeKey],
    );
    try {
      const gateway = getRealtimeGateway();
      const online = gateway.getOnlineUserIds();
      for (const row of inserted.rows) {
        if (!online.has(row.user_id)) continue;
        gateway.sendToUser(row.user_id, {
          eventId: randomUUID(), type: 'notification.created', timestamp: Date.now(), version: 1,
          actor: { id: authorId, name: 'Administración de Aether' },
          subject: { type: 'notification', id: row.id, name: title },
          context: { workspaceId: '' }, vectorClock: {},
          payload: { notificationId: row.id, userId: row.user_id, type: 'ADMIN_ANNOUNCEMENT', title, message, data: { announcementId: requestId, authorId } },
        } as any);
      }
    } catch {
      // Las notificaciones ya quedaron guardadas; la entrega en vivo es opcional.
    }
    return res.status(201).json({ success: true, data: { requestId, recipients: delivered.rows[0]?.count ?? inserted.rows.length } });
  } catch (error) { next(error); }
});

router.get('/organizations', async (req, res, next) => {
  try {
    const { page, limit, offset, search } = pagination(req);
    const params = [`%${search}%`, limit, offset];
    const [rows, count] = await Promise.all([
      query(`SELECT o.id, o.name, o.type, o.created_at, owner.name AS owner_name,
        COUNT(DISTINCT om.user_id)::int AS members,
        COUNT(DISTINCT w.id)::int AS workspaces,
        COUNT(DISTINCT p.id)::int AS projects
        FROM organizations o
        LEFT JOIN users owner ON owner.id = o.owner_user_id
        LEFT JOIN organization_members om ON om.organization_id = o.id
        LEFT JOIN workspaces w ON w.organization_id = o.id
        LEFT JOIN projects p ON p.workspace_id = w.id
        WHERE o.name ILIKE $1
        GROUP BY o.id, owner.name ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`, params),
      query<{ total: number }>('SELECT COUNT(*)::int AS total FROM organizations WHERE name ILIKE $1', params.slice(0, 1)),
    ]);
    res.json({ success: true, data: { organizations: rows.rows.map((row) => ({
      id: row.id, name: row.name, type: row.type, ownerName: row.owner_name,
      members: row.members, workspaces: row.workspaces, projects: row.projects, createdAt: row.created_at,
    })), page, pageSize: limit, total: count.rows[0]?.total ?? 0 } });
  } catch (error) { next(error); }
});

router.get('/workspaces', async (req, res, next) => {
  try {
    const { page, limit, offset, search } = pagination(req);
    const params = [`%${search}%`, limit, offset];
    const [rows, count] = await Promise.all([
      query(`SELECT w.id, w.name, w.operating_mode, w.archived, w.created_at,
        o.name AS organization_name, COUNT(DISTINCT wm.user_id)::int AS members,
        COUNT(DISTINCT p.id)::int AS projects
        FROM workspaces w JOIN organizations o ON o.id = w.organization_id
        LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN projects p ON p.workspace_id = w.id
        WHERE w.name ILIKE $1 OR o.name ILIKE $1
        GROUP BY w.id, o.name ORDER BY w.created_at DESC LIMIT $2 OFFSET $3`, params),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM workspaces w JOIN organizations o ON o.id = w.organization_id WHERE w.name ILIKE $1 OR o.name ILIKE $1`, params.slice(0, 1)),
    ]);
    res.json({ success: true, data: { workspaces: rows.rows.map((row) => ({
      id: row.id, name: row.name, organizationName: row.organization_name, mode: row.operating_mode,
      archived: row.archived, members: row.members, projects: row.projects, createdAt: row.created_at,
    })), page, pageSize: limit, total: count.rows[0]?.total ?? 0 } });
  } catch (error) { next(error); }
});

router.get('/projects', async (req, res, next) => {
  try {
    const { page, limit, offset, search } = pagination(req);
    const params = [`%${search}%`, limit, offset];
    const [rows, count] = await Promise.all([
      query(`SELECT p.id, p.name, p.status, p.created_at, p.updated_at,
        w.name AS workspace_name, o.name AS organization_name,
        COUNT(DISTINCT pb.board_id)::int AS boards
        FROM projects p JOIN workspaces w ON w.id = p.workspace_id
        JOIN organizations o ON o.id = w.organization_id
        LEFT JOIN project_boards pb ON pb.project_id = p.id
        WHERE p.name ILIKE $1 OR w.name ILIKE $1 OR o.name ILIKE $1
        GROUP BY p.id, w.name, o.name ORDER BY p.updated_at DESC LIMIT $2 OFFSET $3`, params),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM projects p JOIN workspaces w ON w.id = p.workspace_id JOIN organizations o ON o.id = w.organization_id WHERE p.name ILIKE $1 OR w.name ILIKE $1 OR o.name ILIKE $1`, params.slice(0, 1)),
    ]);
    res.json({ success: true, data: { projects: rows.rows.map((row) => ({
      id: row.id, name: row.name, status: row.status, workspaceName: row.workspace_name,
      organizationName: row.organization_name, boards: row.boards,
      createdAt: row.created_at, updatedAt: row.updated_at,
    })), page, pageSize: limit, total: count.rows[0]?.total ?? 0 } });
  } catch (error) { next(error); }
});

router.get('/activity', async (req, res, next) => {
  try {
    const { page, limit, offset, search } = pagination(req);
    const params = [`%${search}%`, limit, offset];
    const [rows, count] = await Promise.all([
      query(`SELECT a.id, a.activity_type, a.created_at, u.name AS user_name,
        u.email AS user_email, w.name AS workspace_name
        FROM user_activity_log a JOIN users u ON u.id = a.user_id
        LEFT JOIN workspaces w ON w.id = a.workspace_id
        WHERE a.activity_type ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1
        ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`, params),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM user_activity_log a JOIN users u ON u.id = a.user_id WHERE a.activity_type ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1`, params.slice(0, 1)),
    ]);
    res.json({ success: true, data: { activity: rows.rows.map((row) => ({
      id: row.id, type: row.activity_type, createdAt: row.created_at,
      userName: row.user_name, userEmail: row.user_email, workspaceName: row.workspace_name,
    })), page, pageSize: limit, total: count.rows[0]?.total ?? 0 } });
  } catch (error) { next(error); }
});

router.get('/invitations', async (req, res, next) => {
  try {
    const { page, limit, offset, search } = pagination(req);
    const params = [`%${search}%`, limit, offset];
    const where = `WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()
      AND (i.email ILIKE $1 OR o.name ILIKE $1)`;
    const [rows, count] = await Promise.all([
      query(`SELECT i.id, i.email, i.role, i.created_at, i.expires_at,
        o.name AS organization_name, u.name AS inviter_name
        FROM organization_invitations i
        JOIN organizations o ON o.id = i.organization_id
        JOIN users u ON u.id = i.invited_by
        ${where} ORDER BY i.created_at DESC LIMIT $2 OFFSET $3`, params),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM organization_invitations i JOIN organizations o ON o.id = i.organization_id ${where}`, params.slice(0, 1)),
    ]);
    res.json({ success: true, data: { invitations: rows.rows.map((row) => ({
      id: row.id, email: row.email, role: row.role, organizationName: row.organization_name,
      inviterName: row.inviter_name, createdAt: row.created_at, expiresAt: row.expires_at,
    })), page, pageSize: limit, total: count.rows[0]?.total ?? 0 } });
  } catch (error) { next(error); }
});

router.get('/subscriptions', async (req, res, next) => {
  try {
    const { page, limit, offset, search } = pagination(req);
    const params = [`%${search}%`, limit, offset];
    const [rows, count] = await Promise.all([
      query(`SELECT s.id, s.plan_code, s.status, s.current_period_end, s.cancel_at_period_end,
        s.created_at, o.name AS organization_name
        FROM subscriptions s JOIN organizations o ON o.id = s.organization_id
        WHERE o.name ILIKE $1 OR s.plan_code ILIKE $1
        ORDER BY s.updated_at DESC LIMIT $2 OFFSET $3`, params),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM subscriptions s JOIN organizations o ON o.id = s.organization_id WHERE o.name ILIKE $1 OR s.plan_code ILIKE $1`, params.slice(0, 1)),
    ]);
    res.json({ success: true, data: { subscriptions: rows.rows.map((row) => ({
      id: row.id, organizationName: row.organization_name, plan: row.plan_code,
      status: row.status, periodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end, createdAt: row.created_at,
    })), page, pageSize: limit, total: count.rows[0]?.total ?? 0 } });
  } catch (error) { next(error); }
});

router.get('/system', async (_req, res) => {
  const [database, redis] = await Promise.all([
    query<{ count: number }>('SELECT COUNT(*)::int AS count FROM users').then((result) => result.rows[0]?.count ?? 0).catch(() => null),
    checkRedisHealth(),
  ]);
  res.json({ success: true, data: {
    database: database !== null, users: database ?? 0, redis, api: true, uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    environment: process.env.NODE_ENV ?? 'development', checkedAt: new Date().toISOString(),
  } });
});

export default router;
