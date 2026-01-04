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

export default router;
