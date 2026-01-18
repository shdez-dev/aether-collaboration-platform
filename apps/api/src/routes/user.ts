// apps/api/src/routes/user.ts

import { Router } from 'express';
import { userController } from '../controllers/UserController';
import { authenticateJWT } from '../middleware/auth';

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

export default router;
