// apps/api/src/routes/user.ts

import { Router } from 'express';
import { userController } from '../controllers/UserController';
import { authenticateJWT } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

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
 * GET /api/users/me/preferences
 * Obtener preferencias del usuario
 * Permisos: Usuario autenticado
 */
router.get('/me/preferences', (req, res) => userController.getPreferences(req, res));

/**
 * PUT /api/users/me/preferences
 * Actualizar preferencias del usuario
 * Permisos: Usuario autenticado
 */
router.put('/me/preferences', (req, res) => userController.updatePreferences(req, res));

export default router;
