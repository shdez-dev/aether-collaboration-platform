import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db';
import { authenticateJWT } from '../middleware/auth';
import { projectAuthorizationService } from '../services/ProjectAuthorizationService';

const router = Router();
router.use(authenticateJWT);

const contextSchema = z.object({
  type: z.enum(['PERSONAL', 'ORGANIZATION', 'WORKSPACE', 'PROJECT']),
  id: z.string().uuid().nullable(),
}).refine((context) => context.type === 'PERSONAL' ? context.id === null : context.id !== null);

const widgetSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.string().min(1).max(80),
  column: z.number().finite().min(1).max(24),
  row: z.number().finite().min(1).max(1000),
  width: z.number().finite().min(1).max(24),
  height: z.number().finite().min(1).max(100),
  config: z.record(z.unknown()).optional(),
}).strict();

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  context: contextSchema,
  widgets: z.array(widgetSchema).max(100).default([]),
  locked: z.boolean().default(false),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  widgets: z.array(widgetSchema).max(100).optional(),
  locked: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

type DashboardContext = z.infer<typeof contextSchema>;

async function canUseContext(context: DashboardContext, userId: string) {
  if (context.type === 'PERSONAL') return true;
  if (!context.id) return false;
  if (context.type === 'PROJECT') return Boolean(await projectAuthorizationService.getAccess(context.id, userId));
  if (context.type === 'ORGANIZATION') {
    const result = await pool.query(
      `SELECT 1 FROM organizations o
       WHERE o.id = $1 AND (o.owner_user_id = $2 OR EXISTS (
         SELECT 1 FROM organization_members om WHERE om.organization_id = o.id AND om.user_id = $2
       )) AND NOT EXISTS (
         SELECT 1 FROM organization_access_revocations r WHERE r.organization_id = o.id AND r.user_id = $2
       )`, [context.id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
  const result = await pool.query(
    `SELECT 1 FROM workspaces w
     WHERE w.id = $1 AND w.archived = false
       AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = $2)
       AND NOT EXISTS (
         SELECT 1 FROM organization_access_revocations r WHERE r.organization_id = w.organization_id AND r.user_id = $2
       )`, [context.id, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

function toDashboard(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    context: { type: row.context_type, id: row.context_id },
    widgets: row.widgets,
    locked: row.locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ success: false, error: { code, message } });
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM user_dashboards WHERE user_id = $1 ORDER BY created_at ASC, id ASC`, [req.user!.id],
    );
    const visible = [];
    for (const row of result.rows) {
      if (await canUseContext({ type: row.context_type, id: row.context_id }, req.user!.id)) visible.push(toDashboard(row));
    }
    return res.json({ success: true, data: { dashboards: visible } });
  } catch (error) {
    console.error('[dashboards.list]', error);
    return fail(res, 500, 'DASHBOARDS_UNAVAILABLE', 'No se pudieron cargar los tableros.');
  }
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'INVALID_DASHBOARD', 'Revisa el nombre, el contexto y los widgets del tablero.');
  try {
    if (!await canUseContext(parsed.data.context, req.user!.id)) {
      return fail(res, 403, 'CONTEXT_FORBIDDEN', 'Ya no tienes acceso al contexto elegido.');
    }
    const result = await pool.query(
      `INSERT INTO user_dashboards (user_id, name, context_type, context_id, widgets, locked)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING *`,
      [req.user!.id, parsed.data.name, parsed.data.context.type, parsed.data.context.id, JSON.stringify(parsed.data.widgets), parsed.data.locked],
    );
    return res.status(201).json({ success: true, data: { dashboard: toDashboard(result.rows[0]) } });
  } catch (error) {
    console.error('[dashboards.create]', error);
    return fail(res, 500, 'DASHBOARD_CREATE_FAILED', 'No se pudo crear el tablero.');
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return fail(res, 400, 'INVALID_ID', 'El tablero no es válido.');
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, 'INVALID_DASHBOARD', 'Revisa los cambios del tablero.');
  try {
    const result = await pool.query(
      `UPDATE user_dashboards SET
         name = COALESCE($3, name),
         widgets = COALESCE($4::jsonb, widgets),
         locked = COALESCE($5, locked),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user!.id, parsed.data.name ?? null,
        parsed.data.widgets ? JSON.stringify(parsed.data.widgets) : null, parsed.data.locked ?? null],
    );
    if (!result.rows[0]) return fail(res, 404, 'DASHBOARD_NOT_FOUND', 'No encontramos este tablero.');
    return res.json({ success: true, data: { dashboard: toDashboard(result.rows[0]) } });
  } catch (error) {
    console.error('[dashboards.update]', error);
    return fail(res, 500, 'DASHBOARD_UPDATE_FAILED', 'No se pudo guardar el tablero.');
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  if (!z.string().uuid().safeParse(req.params.id).success) return fail(res, 400, 'INVALID_ID', 'El tablero no es válido.');
  try {
    const result = await pool.query(
      `DELETE FROM user_dashboards WHERE id = $1 AND user_id = $2 RETURNING id`, [req.params.id, req.user!.id],
    );
    if (!result.rows[0]) return fail(res, 404, 'DASHBOARD_NOT_FOUND', 'No encontramos este tablero.');
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('[dashboards.delete]', error);
    return fail(res, 500, 'DASHBOARD_DELETE_FAILED', 'No se pudo eliminar el tablero.');
  }
});

router.get('/projects', async (req: Request, res: Response) => {
  const context = contextSchema.safeParse({ type: req.query.type, id: req.query.id || null });
  if (!context.success) return fail(res, 400, 'INVALID_CONTEXT', 'El contexto del tablero no es válido.');
  try {
    if (!await canUseContext(context.data, req.user!.id)) return fail(res, 403, 'CONTEXT_FORBIDDEN', 'Ya no tienes acceso a este contexto.');
    const result = await pool.query(
      `SELECT p.id, p.name, p.color, p.status, p.description, p.product_goal AS "productGoal", p.methodology,
              p.workspace_id AS "workspaceId",
              w.name AS "workspaceName", w.organization_id AS "organizationId", o.name AS "organizationName"
       FROM projects p
       JOIN workspaces w ON w.id = p.workspace_id AND w.archived = false
       JOIN organizations o ON o.id = w.organization_id
       WHERE p.status != 'ARCHIVED' AND ($1 = 'PERSONAL' OR ($1 = 'ORGANIZATION' AND o.id = $2)
         OR ($1 = 'WORKSPACE' AND w.id = $2) OR ($1 = 'PROJECT' AND p.id = $2))
       ORDER BY o.name, w.name, p.name`, [context.data.type, context.data.id],
    );
    const projects: Record<string, unknown>[] = [];
    for (let index = 0; index < result.rows.length; index += 8) {
      const batch = result.rows.slice(index, index + 8);
      const access = await Promise.all(batch.map((row) => projectAuthorizationService.getAccess(row.id, req.user!.id)));
      batch.forEach((row, offset) => { if (access[offset]) projects.push(row); });
    }
    return res.json({ success: true, data: { projects } });
  } catch (error) {
    console.error('[dashboards.projects]', error);
    return fail(res, 500, 'DASHBOARD_PROJECTS_FAILED', 'No se pudieron cargar los proyectos del tablero.');
  }
});

export default router;
