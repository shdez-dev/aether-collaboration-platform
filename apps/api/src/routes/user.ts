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

export default router;
