import { Router, type Request, type Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { query } from '../lib/db';
import { getRealtimeGateway } from '../websocket/RealtimeGateway';
import { checkRedisHealth } from '../lib/redis';

const router = Router();
router.use(authenticateJWT);

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

router.use(requirePlatformAdmin);

router.get('/access', (_req, res) => {
  res.json({ success: true, data: { platformAdmin: true } });
});

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
        (SELECT MAX(ual.created_at) FROM user_activity_log ual WHERE ual.user_id = u.id) AS last_activity_at
        FROM users u ${where}
        ORDER BY u.created_at DESC LIMIT $${onlineFilter ? 3 : 2} OFFSET $${onlineFilter ? 4 : 3}`, params),
      query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM users u ${where}`, onlineFilter ? params.slice(0, 2) : params.slice(0, 1)),
    ]);
    res.json({ success: true, data: {
      users: rows.rows.map((row) => ({
        id: row.id, name: row.name, email: row.email, emailVerified: row.email_verified,
        createdAt: row.created_at, lastActivityAt: row.last_activity_at,
        organizations: row.organizations, workspaces: row.workspaces,
        online: onlineIds.includes(row.id),
      })),
      page, pageSize: limit, total: count.rows[0]?.total ?? 0,
    } });
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
    query('SELECT 1').then(() => true).catch(() => false),
    checkRedisHealth(),
  ]);
  res.json({ success: true, data: {
    database, redis, api: true, uptimeSeconds: Math.floor(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    environment: process.env.NODE_ENV ?? 'development', checkedAt: new Date().toISOString(),
  } });
});

export default router;
