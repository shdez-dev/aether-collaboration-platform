// apps/api/src/controllers/UserController.ts

import { Request, Response } from 'express';
import { pool } from '../lib/db';
import { userActivityService } from '../services/UserActivityService';

class UserController {
  /**
   * GET /api/users/search?email=xxx
   * Buscar usuario por email (para autocompletado en invitaciones)
   */
  async searchByEmail(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { email } = req.query;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_EMAIL',
            message: 'Email parameter is required',
          },
        });
      }

      // Buscar usuario por email exacto
      const result = await pool.query(
        `SELECT id, name, email, avatar 
         FROM users 
         WHERE LOWER(email) = LOWER($1)`,
        [email.trim()]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'No user found with this email',
          },
        });
      }

      const user = result.rows[0];

      // No devolver información sensible
      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          },
        },
      });
    } catch (error) {
      console.error('[UserController] SearchByEmail error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to search user',
        },
      });
    }
  }

  /**
   * GET /api/users/me/stats
   * Obtener estadísticas del dashboard del usuario
   */
  async getUserStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Contar workspaces del usuario
      const workspaceCount = await pool.query(
        `SELECT COUNT(*) as count FROM workspace_members WHERE user_id = $1`,
        [userId]
      );

      // Contar boards activos
      const boardCount = await pool.query(
        `SELECT COUNT(DISTINCT b.id) as count
         FROM boards b
         JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
         WHERE wm.user_id = $1 AND b.archived = false`,
        [userId]
      );

      // Contar cards totales
      const cardCount = await pool.query(
        `SELECT COUNT(DISTINCT c.id) as count
         FROM cards c
         JOIN lists l ON l.id = c.list_id
         JOIN boards b ON b.id = l.board_id
         JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
         WHERE wm.user_id = $1`,
        [userId]
      );

      // Contar miembros totales en todos los workspaces del usuario
      const memberCount = await pool.query(
        `SELECT COUNT(DISTINCT wm2.user_id) as count
         FROM workspace_members wm1
         JOIN workspace_members wm2 ON wm2.workspace_id = wm1.workspace_id
         WHERE wm1.user_id = $1`,
        [userId]
      );

      return res.json({
        success: true,
        data: {
          workspaceCount: parseInt(workspaceCount.rows[0].count),
          activeBoardCount: parseInt(boardCount.rows[0].count),
          totalCardCount: parseInt(cardCount.rows[0].count),
          totalMemberCount: parseInt(memberCount.rows[0].count),
        },
      });
    } catch (error) {
      console.error('[UserController] GetUserStats error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user stats',
        },
      });
    }
  }

  /**
   * GET /api/users/me/activity
   * Obtener actividad reciente del usuario desde user_activity_log
   */
  async getUserActivity(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      // Obtener actividad desde user_activity_log
      const activities = await userActivityService.getUserActivity(userId as any, 20);

      // Transformar a formato esperado por el frontend
      const events = activities.map((activity) => ({
        id: activity.id,
        type: activity.activity_type,
        payload: activity.metadata || {},
        timestamp: activity.created_at,
        createdBy: activity.user_id,
      }));

      return res.json({
        success: true,
        data: {
          events,
        },
      });
    } catch (error) {
      console.error('[UserController] GetUserActivity error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user activity',
        },
      });
    }
  }
}

export const userController = new UserController();
