// apps/api/src/routes/notifications.ts

import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * ==================== RUTAS DE NOTIFICATIONS ====================
 *
 * Todas las rutas requieren autenticación
 */

// Obtener todas las notificaciones del usuario autenticado
// Query params: ?unread=true
router.get('/notifications', authenticateJWT, NotificationController.getNotifications);

// Obtener contador de notificaciones no leídas
router.get('/notifications/unread-count', authenticateJWT, NotificationController.getUnreadCount);

// Marcar una notificación como leída
router.patch(
  '/notifications/:notificationId/read',
  authenticateJWT,
  NotificationController.markAsRead
);

// Marcar todas las notificaciones como leídas
router.post('/notifications/mark-all-read', authenticateJWT, NotificationController.markAllAsRead);

// Eliminar una notificación
router.delete(
  '/notifications/:notificationId',
  authenticateJWT,
  NotificationController.deleteNotification
);

export default router;
