import { Router } from 'express';
import { authController } from '../controllers/AuthController';
import { authenticateJWT } from '../middleware/auth';
import {
  forgotPasswordRateLimit,
  loginRateLimit,
  refreshRateLimit,
  registerRateLimit,
  resendVerificationRateLimit,
  resetPasswordRateLimit,
  verifyEmailRateLimit,
} from '../middleware/authRateLimit';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.post('/register', registerRateLimit, (req, res) => authController.register(req, res));
router.post('/login', loginRateLimit, (req, res) => authController.login(req, res));
router.post('/refresh', refreshRateLimit, (req, res) => authController.refresh(req, res));
router.post('/verify-email', verifyEmailRateLimit, (req, res) =>
  authController.verifyEmail(req, res)
);
router.post('/resend-verification', resendVerificationRateLimit, (req, res) =>
  authController.resendVerificationPublic(req, res)
);
router.post('/forgot-password', forgotPasswordRateLimit, (req, res) =>
  authController.forgotPassword(req, res)
);
router.post('/reset-password', resetPasswordRateLimit, (req, res) =>
  authController.resetPassword(req, res)
);

// Rutas protegidas (requieren autenticación)
router.post('/logout', authenticateJWT, (req, res) => authController.logout(req, res));
router.get('/me', authenticateJWT, (req, res) => authController.me(req, res));
router.post('/send-verification-email', authenticateJWT, (req, res) =>
  authController.sendVerificationEmail(req, res)
);

export default router;
