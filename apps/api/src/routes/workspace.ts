// apps/api/src/routes/workspace.ts

import { Router } from 'express';
import { workspaceController } from '../controllers/WorkspaceController';
import { activityLogController } from '../controllers/ActivityLogController';
import { workspaceGithubController } from '../controllers/WorkspaceGithubController';
import { projectController } from '../controllers/ProjectController';
import { authenticateJWT } from '../middleware/auth';
import { checkWorkspaceMembership, requireAdmin, requireOwner } from '../middleware/workspace';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

/**
 * POST /api/workspaces
 * Crear un nuevo workspace
 * Permisos: Usuario autenticado
 */
router.post('/', (req, res) => workspaceController.create(req, res));

/**
 * GET /api/workspaces
 * Listar todos los workspaces del usuario
 * Permisos: Usuario autenticado
 */
router.get('/', (req, res) => workspaceController.list(req, res));

/**
 * POST /api/workspaces/from-template
 * Crear workspace desde template predefinido
 * DEBE ir antes de /:id para que Express no lo capture como parámetro
 */
router.post('/from-template', (req, res) => workspaceController.createFromTemplate(req, res));

/**
 * POST /api/workspaces/join/:token
 * Unirse a workspace vía link de invitación
 * DEBE ir antes de /:id
 */
router.post('/join/:token', (req, res) => workspaceController.joinByToken(req, res));

/**
 * GET /api/workspaces/:id
 * Obtener un workspace específico
 * Permisos: Miembro del workspace
 */
router.get('/:id', checkWorkspaceMembership, (req, res) => workspaceController.getById(req, res));

/**
 * PUT /api/workspaces/:id
 * Actualizar un workspace
 * Permisos: ADMIN o OWNER
 */
router.put('/:id', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.update(req, res)
);

/**
 * DELETE /api/workspaces/:id
 * Eliminar un workspace
 * Permisos: Solo OWNER
 */
router.delete('/:id', checkWorkspaceMembership, requireOwner, (req, res) =>
  workspaceController.delete(req, res)
);

/**
 * POST /api/workspaces/:id/invite
 * Invitar un miembro al workspace
 * Permisos: ADMIN o OWNER
 */
router.post('/:id/invite', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.inviteMember(req, res)
);

/**
 * POST /api/workspaces/:id/invite-multiple
 * Invitar múltiples miembros al workspace
 * Permisos: ADMIN o OWNER
 */
router.post('/:id/invite-multiple', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.inviteMultipleMembers(req, res)
);

/**
 * GET /api/workspaces/:id/members
 * Obtener miembros del workspace
 * Permisos: Miembro del workspace
 */
router.get('/:id/members', checkWorkspaceMembership, (req, res) =>
  workspaceController.getMembers(req, res)
);

/**
 * PUT /api/workspaces/:id/members/:userId
 * Cambiar rol de un miembro
 * Permisos: Solo OWNER
 */
router.put('/:id/members/:userId', checkWorkspaceMembership, requireOwner, (req, res) =>
  workspaceController.changeMemberRole(req, res)
);

/**
 * DELETE /api/workspaces/:id/members/:userId
 * Remover un miembro del workspace
 * Permisos: ADMIN o OWNER
 */
router.delete('/:id/members/:userId', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.removeMember(req, res)
);

/**
 * GET /api/workspaces/:id/stats
 * Obtener estadísticas del workspace
 */
router.get('/:id/stats', checkWorkspaceMembership, (req, res) =>
  workspaceController.getStats(req, res)
);

/**
 * GET /api/workspaces/:id/teams
 * Equipos activos derivados de project_teams, con miembros
 */
router.get('/:id/teams', checkWorkspaceMembership, (req, res) =>
  workspaceController.getTeams(req, res)
);

/**
 * POST /api/workspaces/:id/archive
 * Archivar workspace (solo OWNER)
 */
router.post('/:id/archive', checkWorkspaceMembership, requireOwner, (req, res) =>
  workspaceController.archive(req, res)
);

/**
 * POST /api/workspaces/:id/restore
 * Restaurar workspace archivado (solo OWNER)
 */
router.post('/:id/restore', checkWorkspaceMembership, requireOwner, (req, res) =>
  workspaceController.restore(req, res)
);

/**
 * POST /api/workspaces/:id/duplicate
 * Duplicar workspace (OWNER o ADMIN)
 */
router.post('/:id/duplicate', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.duplicate(req, res)
);

/**
 * PUT /api/workspaces/:id/visibility
 * Cambiar visibilidad (OWNER o ADMIN)
 */
router.put('/:id/visibility', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.updateVisibility(req, res)
);

/**
 * POST /api/workspaces/:id/invite-token
 * Generar token de invitación público (OWNER o ADMIN)
 */
router.post('/:id/invite-token', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.regenerateInviteToken(req, res)
);

/**
 * DELETE /api/workspaces/:id/invite-token
 * Revocar token de invitación (OWNER o ADMIN)
 */
router.delete('/:id/invite-token', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceController.revokeInviteToken(req, res)
);

/**
 * GET /api/workspaces/:id/github
 * Estado de la conexión GitHub del workspace
 */
router.get('/:id/github', checkWorkspaceMembership, (req, res) =>
  workspaceGithubController.getConnection(req, res)
);

/**
 * GET /api/workspaces/:id/github/repos
 * Lista repos accesibles con el token guardado (o ?token=xxx para preview)
 */
router.get('/:id/github/repos', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceGithubController.listRepos(req, res)
);

/**
 * POST /api/workspaces/:id/github
 * Conectar GitHub (guardar token + registrar webhooks)
 */
router.post('/:id/github', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceGithubController.connect(req, res)
);

/**
 * DELETE /api/workspaces/:id/github
 * Desconectar GitHub (eliminar webhooks + borrar fila)
 */
router.delete('/:id/github', checkWorkspaceMembership, requireAdmin, (req, res) =>
  workspaceGithubController.disconnect(req, res)
);

/**
 * GET /api/workspaces/:id/projects
 * Listar proyectos del workspace
 */
router.get('/:id/projects', checkWorkspaceMembership, (req, res) => {
  req.params.wsId = req.params.id;
  projectController.listByWorkspace(req, res);
});

/**
 * POST /api/workspaces/:id/projects
 * Crear proyecto en el workspace
 */
router.post('/:id/projects', checkWorkspaceMembership, (req, res) => {
  req.params.wsId = req.params.id;
  projectController.create(req, res);
});

/**
 * GET /api/workspaces/:id/activity
 * Get activity log for a workspace with filters
 */
router.get('/:id/activity', checkWorkspaceMembership, (req, res) =>
  activityLogController.getWorkspaceActivity(req, res)
);

/**
 * GET /api/workspaces/:id/activity/stats
 * Get activity statistics for a workspace
 */
router.get('/:id/activity/stats', checkWorkspaceMembership, (req, res) =>
  activityLogController.getWorkspaceActivityStats(req, res)
);

export default router;
