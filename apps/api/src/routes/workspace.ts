// apps/api/src/routes/workspace.ts

import { Router } from 'express';
import { workspaceController } from '../controllers/WorkspaceController';
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
 * GET /api/workspaces/:id/activity
 */
router.get('/:id/activity', checkWorkspaceMembership, (req, res) =>
  workspaceController.getWorkspaceActivity(req, res)
);

/**
 * GET /api/workspaces/:id/stats
 * Obtener estadísticas del workspace
 */
router.get('/:id/stats', checkWorkspaceMembership, (req, res) =>
  workspaceController.getStats(req, res)
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

export default router;
