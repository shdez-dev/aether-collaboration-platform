// apps/api/src/routes/user.ts

import { Router } from 'express';
import { userController } from '../controllers/UserController';
import { standupController } from '../controllers/StandupController';
import { authenticateJWT } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';
import { AccountDeletionError, getAccountDeletionBlockers, requestAccountDeletion } from '../services/AccountDeletionService';
import { createAuthRateLimit } from '../middleware/authRateLimit';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

router.get('/me/deletion', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const blockers = await getAccountDeletionBlockers(req.user!.id);
    res.json({ success: true, data: { blockers } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo revisar la cuenta.' } });
  }
});

const accountDeletionRateLimit = createAuthRateLimit({ policy: 'account-deletion', scopes: [{ type: 'ip', limit: 20, windowMs: 60 * 60 * 1000 }] });
router.post('/me/deletion', accountDeletionRateLimit, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
    return res.status(400).json({ success: false, error: { code: 'PASSWORD_REQUIRED', message: 'Confirma tu contraseña.' } });
  }
  try {
    const requestId = await requestAccountDeletion(req.user!.id, password);
    return res.status(202).json({ success: true, data: { status: 'PENDING', requestId } });
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message, blockers: error.blockers } });
    }
    console.error('[accountDeletion] request failed:', error);
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo iniciar la eliminación.' } });
  }
});

/**
 * GET /api/users?search=xxx&page=1&limit=20
 * Directorio de usuarios con búsqueda
 * Permisos: Usuario autenticado
 */
router.get('/', (req, res) => userController.listUsers(req, res));

/**
 * GET /api/users/search?email=xxx
 * Buscar usuario por email
 * Permisos: Usuario autenticado
 */
router.get('/search', (req, res) => userController.searchByEmail(req, res));

/**
 * GET /api/users/me/stats
 * Obtener estadísticas del dashboard
 * Permisos: Usuario autenticado
 */
router.get('/me/stats', (req, res) => userController.getUserStats(req, res));

/**
 * GET /api/users/me/activity
 * Obtener actividad reciente del usuario
 * Permisos: Usuario autenticado
 */
router.get('/me/activity', (req, res) => userController.getUserActivity(req, res));

/**
 * GET /api/users/me/cards
 * Obtener todas las cards asignadas al usuario
 * Permisos: Usuario autenticado
 */
router.get('/me/cards', (req, res) => userController.getUserCards(req, res));

/**
 * GET /api/users/me/preferences
 * Obtener preferencias del usuario
 * Permisos: Usuario autenticado
 */
router.get('/me/preferences', (req, res) => userController.getPreferences(req, res));

/**
 * PUT /api/users/me
 * Actualizar perfil del usuario autenticado
 * Permisos: Usuario autenticado
 */
router.put('/me', (req, res) => userController.updateProfile(req, res));

/**
 * PUT /api/users/me/password
 * Cambiar contraseña del usuario
 * Permisos: Usuario autenticado
 */
router.put('/me/password', (req, res) => userController.changePassword(req, res));

/**
 * POST /api/users/me/avatar
 * Subir avatar del usuario
 * Permisos: Usuario autenticado
 */
router.post('/me/avatar', uploadAvatar, (req, res) => userController.uploadAvatar(req, res));

/**
 * PUT /api/users/me/preferences
 * Actualizar preferencias del usuario
 * Permisos: Usuario autenticado
 */
router.put('/me/preferences', (req, res) => userController.updatePreferences(req, res));

/**
 * GET /api/users/favorites
 * Obtener lista de usuarios favoritos
 * Permisos: Usuario autenticado
 */
router.get('/favorites', (req, res) => userController.getFavorites(req, res));

/**
 * POST /api/users/favorites/:userId
 * Agregar usuario a favoritos
 * Permisos: Usuario autenticado
 */
router.post('/favorites/:userId', (req, res) => userController.addFavorite(req, res));

/**
 * DELETE /api/users/favorites/:userId
 * Quitar usuario de favoritos
 * Permisos: Usuario autenticado
 */
router.delete('/favorites/:userId', (req, res) => userController.removeFavorite(req, res));

/**
 * GET /api/users/me/agenda
 * Milestones y sprints próximos de los boards del usuario
 */
router.get('/me/agenda', (req, res) => userController.getAgenda(req, res));

/**
 * GET /api/users/me/github/prs
 * PRs de GitHub donde el usuario es reviewer
 */
router.get('/me/github/prs',    (req, res) => userController.getGithubPRs(req, res));
router.get('/me/teammates',     (req, res) => userController.getTeammates(req, res));

/**
 * GET /api/users/me/standup?workspaceId=xxx
 * Obtener el standup de hoy del usuario
 */
router.get('/me/standup', (req, res) => standupController.getTodayStandup(req, res));

/**
 * PUT /api/users/me/standup
 * Crear o actualizar borrador del standup de hoy
 */
router.put('/me/standup', (req, res) => standupController.upsertStandup(req, res));

/**
 * POST /api/users/me/standup/publish
 * Publicar el standup de hoy
 */
router.post('/me/standup/publish', (req, res) => standupController.publishStandup(req, res));

/**
 * GET /api/users/:id
 * Perfil público de un usuario (debe ir AL FINAL, después de todas las rutas /me/*)
 * Permisos: Usuario autenticado
 */
router.get('/:id', (req, res) => userController.getUserProfile(req, res));

export default router;
