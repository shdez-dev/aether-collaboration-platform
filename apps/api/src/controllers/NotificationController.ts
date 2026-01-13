// apps/api/src/controllers/NotificationController.ts

import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';
import { z } from 'zod';

// ==================== SCHEMAS DE VALIDACIÓN ====================

const markAsReadSchema = z.object({
  notificationId: z.string().uuid(),
});

// ==================== CONTROLLER ====================

export class NotificationController {
  /**
   * GET /api/notifications
   * Obtener todas las notificaciones del usuario autenticado
   */
  static async getNotifications(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id;
      const onlyUnread = req.query.unread === 'true';

      console.log('[NotificationController] Getting notifications for user:', userId);

      const notifications = await notificationService.getNotifications(userId, onlyUnread);

      return res.status(200).json({
        success: true,
        data: { notifications },
      });
    } catch (error: any) {
      console.error('❌ Error getting notifications:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Obtener contador de notificaciones no leídas
   */
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id;
      const count = await notificationService.getUnreadCount(userId);

      return res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('❌ Error getting unread count:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * PATCH /api/notifications/:notificationId/read
   * Marcar una notificación como leída
   */
  static async markAsRead(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id;
      const { notificationId } = req.params;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NOTIFICATION_ID',
            message: 'Notification ID is required',
          },
        });
      }

      await notificationService.markAsRead(notificationId, userId);

      return res.status(200).json({
        success: true,
        data: { message: 'Notification marked as read' },
      });
    } catch (error: any) {
      console.error('❌ Error marking notification as read:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * POST /api/notifications/mark-all-read
   * Marcar todas las notificaciones como leídas
   */
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id;

      await notificationService.markAllAsRead(userId);

      return res.status(200).json({
        success: true,
        data: { message: 'All notifications marked as read' },
      });
    } catch (error: any) {
      console.error('❌ Error marking all notifications as read:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  /**
   * DELETE /api/notifications/:notificationId
   * Eliminar una notificación
   */
  static async deleteNotification(req: Request, res: Response) {
    try {
      const user = (req as any).user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userId = user.id;
      const { notificationId } = req.params;

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NOTIFICATION_ID',
            message: 'Notification ID is required',
          },
        });
      }

      await notificationService.deleteNotification(notificationId, userId);

      return res.status(200).json({
        success: true,
        data: { message: 'Notification deleted' },
      });
    } catch (error: any) {
      console.error('❌ Error deleting notification:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }
}
