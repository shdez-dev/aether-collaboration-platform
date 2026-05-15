import { Router } from 'express';
import { authController } from '../controllers/AuthController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/refresh', (req, res) => authController.refresh(req, res));
router.post('/verify-email', (req, res) => authController.verifyEmail(req, res));
router.post('/resend-verification', (req, res) => authController.resendVerificationPublic(req, res));
router.post('/check-verification', (req, res) => authController.checkVerification(req, res));
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

// Rutas protegidas (requieren autenticación)
router.post('/logout', authenticateJWT, (req, res) => authController.logout(req, res));
router.get('/me', authenticateJWT, (req, res) => authController.me(req, res));
router.post('/send-verification-email', authenticateJWT, (req, res) =>
  authController.sendVerificationEmail(req, res)
);

export default router;
