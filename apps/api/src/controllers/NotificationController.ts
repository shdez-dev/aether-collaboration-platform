// apps/api/src/controllers/NotificationController.ts

import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';
import { z } from 'zod';

// ==================== SCHEMAS DE VALIDACIÓN ====================

const markAsReadSchema = z.object({
  notificationId: z.string().uuid(),
});

const notificationListSchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  archived: z.enum(['true', 'false']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
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
      const filters = notificationListSchema.safeParse(req.query);
      if (!filters.success) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: filters.error.flatten() } });
      }
      const notifications = await notificationService.getNotifications(userId, {
        onlyUnread: filters.data.unread === 'true',
        includeArchived: filters.data.archived === 'true',
        includeResolved: filters.data.resolved === 'true',
        limit: filters.data.limit,
      });

      return res.status(200).json({
        success: true,
        data: { notifications },
      });
    } catch (error: any) {
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
      const parsed = markAsReadSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NOTIFICATION_ID',
            message: 'Notification ID is required',
          },
        });
      }

      await notificationService.markAsRead(parsed.data.notificationId, userId);

      return res.status(200).json({
        success: true,
        data: { message: 'Notification marked as read' },
      });
    } catch (error: any) {
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
      const parsed = markAsReadSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_NOTIFICATION_ID',
            message: 'Notification ID is required',
          },
        });
      }

      await notificationService.deleteNotification(parsed.data.notificationId, userId);

      return res.status(200).json({
        success: true,
        data: { message: 'Notification deleted' },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error.message },
      });
    }
  }

  static async archive(req: Request, res: Response) {
    return NotificationController.transition(req, res, 'archive');
  }

  static async restore(req: Request, res: Response) {
    return NotificationController.transition(req, res, 'restore');
  }

  static async resolve(req: Request, res: Response) {
    return NotificationController.transition(req, res, 'resolve');
  }

  static async reopen(req: Request, res: Response) {
    return NotificationController.transition(req, res, 'reopen');
  }

  private static async transition(req: Request, res: Response, action: 'archive' | 'restore' | 'resolve' | 'reopen') {
    const userId = (req as any).user?.id as string | undefined;
    const parsed = markAsReadSchema.safeParse(req.params);
    if (!userId) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'INVALID_NOTIFICATION_ID', message: 'Notification ID must be a UUID' } });
    try {
      const method = {
        archive: notificationService.archiveNotification,
        restore: notificationService.restoreNotification,
        resolve: notificationService.resolveNotification,
        reopen: notificationService.reopenNotification,
      }[action];
      await method.call(notificationService, parsed.data.notificationId, userId);
      return res.json({ success: true, data: { notificationId: parsed.data.notificationId, action } });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
  }
}
