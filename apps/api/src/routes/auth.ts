import { Router } from 'express';
import { authController } from '../controllers/AuthController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/refresh', (req, res) => authController.refresh(req, res));

// Rutas protegidas (requieren autenticación)
router.post('/logout', authenticateJWT, (req, res) => authController.logout(req, res));
router.get('/me', authenticateJWT, (req, res) => authController.me(req, res));

export default router;
