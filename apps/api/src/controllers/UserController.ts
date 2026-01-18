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

      const workspaceCount = await pool.query(
        `SELECT COUNT(*) as count FROM workspace_members WHERE user_id = $1`,
        [userId]
      );

      const boardCount = await pool.query(
        `SELECT COUNT(DISTINCT b.id) as count
         FROM boards b
         JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
         WHERE wm.user_id = $1 AND b.archived = false`,
        [userId]
      );

      const cardCount = await pool.query(
        `SELECT COUNT(DISTINCT c.id) as count
         FROM cards c
         JOIN lists l ON l.id = c.list_id
         JOIN boards b ON b.id = l.board_id
         JOIN workspace_members wm ON wm.workspace_id = b.workspace_id
         WHERE wm.user_id = $1`,
        [userId]
      );

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

      const activities = await userActivityService.getUserActivity(userId as any, 20);

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

  /**
   * GET /api/users/me/cards
   * Obtener todas las cards asignadas al usuario actual
   *
   * ✅ CLASIFICACIÓN BASADA EN EL CAMPO `completed`:
   * - Completed: cards con completed = true
   * - Overdue: cards con completed = false y due_date < now
   * - Pending: cards con completed = false y (due_date >= now O sin due_date)
   */
  async getUserCards(req: Request, res: Response) {
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

      // Query para obtener todas las cards donde el usuario está asignado
      const result = await pool.query(
        `SELECT 
          c.id,
          c.title,
          c.description,
          c.due_date as "dueDate",
          c.priority,
          c.position,
          c.completed,
          c.completed_at as "completedAt",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          l.id as "listId",
          l.name as "listName",
          b.id as "boardId",
          b.name as "boardName",
          w.id as "workspaceId",
          w.name as "workspaceName"
        FROM cards c
        INNER JOIN card_members cm ON cm.card_id = c.id
        INNER JOIN lists l ON l.id = c.list_id
        INNER JOIN boards b ON b.id = l.board_id
        INNER JOIN workspaces w ON w.id = b.workspace_id
        WHERE cm.user_id = $1
          AND b.archived = false
        ORDER BY 
          c.completed ASC,
          CASE 
            WHEN c.due_date IS NULL THEN 1
            ELSE 0
          END,
          c.due_date ASC,
          c.created_at DESC`,
        [userId]
      );

      // ✅ CLASIFICAR USANDO EL CAMPO `completed` COMO FUENTE DE VERDAD
      const now = new Date();
      const pending: any[] = [];
      const overdue: any[] = [];
      const completed: any[] = [];

      result.rows.forEach((row) => {
        const card = {
          id: row.id,
          title: row.title,
          description: row.description,
          dueDate: row.dueDate,
          priority: row.priority,
          position: row.position,
          completed: row.completed,
          completedAt: row.completedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          listId: row.listId,
          listName: row.listName,
          boardId: row.boardId,
          boardName: row.boardName,
          workspaceId: row.workspaceId,
          workspaceName: row.workspaceName,
        };

        // Si está completada, va a "Finalizadas"
        if (card.completed) {
          completed.push(card);
        }
        // Si no está completada y tiene due_date vencida, va a "Con retraso"
        else if (card.dueDate && new Date(card.dueDate) < now) {
          overdue.push(card);
        }
        // Si no está completada y no está vencida (o no tiene due_date), va a "Próximas"
        else {
          pending.push(card);
        }
      });

      return res.json({
        success: true,
        data: {
          pending,
          overdue,
          completed,
        },
      });
    } catch (error) {
      console.error('[UserController] GetUserCards error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user cards',
        },
      });
    }
  }
}

export const userController = new UserController();
