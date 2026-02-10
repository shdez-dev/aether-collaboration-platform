// apps/api/src/controllers/UserController.ts

import { Request, Response } from 'express';
import { pool } from '../lib/db';
import { userActivityService } from '../services/UserActivityService';
import bcrypt from 'bcrypt';

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

  /**
   * PUT /api/users/me
   * Actualizar perfil del usuario autenticado
   */
  async updateProfile(req: Request, res: Response) {
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

      const { name, bio, position, timezone, language, phone, location } = req.body;

      // Validar que al menos un campo esté presente
      if (!name && !bio && !position && !timezone && !language && !phone && !location) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'At least one field is required',
          },
        });
      }

      // Construir query dinámicamente solo con los campos proporcionados
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (bio !== undefined) {
        updates.push(`bio = $${paramIndex++}`);
        values.push(bio);
      }
      if (position !== undefined) {
        updates.push(`position = $${paramIndex++}`);
        values.push(position);
      }
      if (timezone !== undefined) {
        updates.push(`timezone = $${paramIndex++}`);
        values.push(timezone);
      }
      if (language !== undefined) {
        updates.push(`language = $${paramIndex++}`);
        values.push(language);
      }
      if (phone !== undefined) {
        updates.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (location !== undefined) {
        updates.push(`location = $${paramIndex++}`);
        values.push(location);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const result = await pool.query(
        `UPDATE users 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, email, name, avatar, bio, position, timezone, language, phone, location, created_at, updated_at`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const user = result.rows[0];

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            bio: user.bio,
            position: user.position,
            timezone: user.timezone,
            language: user.language,
            phone: user.phone,
            location: user.location,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
        },
      });
    } catch (error) {
      console.error('[UserController] UpdateProfile error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update profile',
        },
      });
    }
  }

  /**
   * PUT /api/users/me/password
   * Cambiar contraseña del usuario autenticado
   */
  async changePassword(req: Request, res: Response) {
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

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'Current password and new password are required',
          },
        });
      }

      // Validar longitud de nueva contraseña
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'New password must be at least 6 characters long',
          },
        });
      }

      // Obtener contraseña actual del usuario
      const userResult = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const user = userResult.rows[0];

      // Verificar que la contraseña actual sea correcta
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: 'Current password is incorrect',
          },
        });
      }

      // Hash de la nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar contraseña
      await pool.query(
        'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashedPassword, userId]
      );

      return res.json({
        success: true,
        data: {
          message: 'Password changed successfully',
        },
      });
    } catch (error) {
      console.error('[UserController] ChangePassword error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to change password',
        },
      });
    }
  }

  /**
   * POST /api/users/me/avatar
   * Subir avatar del usuario
   */
  async uploadAvatar(req: Request, res: Response) {
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

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE',
            message: 'No file uploaded',
          },
        });
      }

      // Construir URL pública del avatar
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Actualizar el avatar en la base de datos
      const result = await pool.query(
        `UPDATE users 
         SET avatar = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, name, avatar, bio, position, timezone, language, phone, location`,
        [avatarUrl, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const user = result.rows[0];

      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            bio: user.bio,
            position: user.position,
            timezone: user.timezone,
            language: user.language,
            phone: user.phone,
            location: user.location,
          },
          avatarUrl: user.avatar,
        },
      });
    } catch (error) {
      console.error('[UserController] UploadAvatar error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to upload avatar',
        },
      });
    }
  }

  /**
   * GET /api/users/me/preferences
   * Obtener preferencias del usuario
   */
  async getPreferences(req: Request, res: Response) {
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

      const result = await pool.query(`SELECT * FROM user_preferences WHERE user_id = $1`, [
        userId,
      ]);

      // Si no existen preferencias, crearlas con valores por defecto
      if (result.rows.length === 0) {
        const createResult = await pool.query(
          `INSERT INTO user_preferences (user_id) VALUES ($1) RETURNING *`,
          [userId]
        );

        const prefs = createResult.rows[0];
        return res.json({
          success: true,
          data: {
            preferences: {
              theme: prefs.theme,
              emailNotifications: prefs.email_notifications,
              pushNotifications: prefs.push_notifications,
              inAppNotifications: prefs.in_app_notifications,
              notificationFrequency: prefs.notification_frequency,
              compactMode: prefs.compact_mode,
              showArchived: prefs.show_archived,
              defaultBoardView: prefs.default_board_view,
            },
          },
        });
      }

      const prefs = result.rows[0];

      return res.json({
        success: true,
        data: {
          preferences: {
            theme: prefs.theme,
            emailNotifications: prefs.email_notifications,
            pushNotifications: prefs.push_notifications,
            inAppNotifications: prefs.in_app_notifications,
            notificationFrequency: prefs.notification_frequency,
            compactMode: prefs.compact_mode,
            showArchived: prefs.show_archived,
            defaultBoardView: prefs.default_board_view,
          },
        },
      });
    } catch (error) {
      console.error('[UserController] GetPreferences error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get preferences',
        },
      });
    }
  }

  /**
   * PUT /api/users/me/preferences
   * Actualizar preferencias del usuario
   */
  async updatePreferences(req: Request, res: Response) {
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

      const {
        theme,
        emailNotifications,
        pushNotifications,
        inAppNotifications,
        notificationFrequency,
        compactMode,
        showArchived,
        defaultBoardView,
      } = req.body;

      // Verificar si existen preferencias
      const checkResult = await pool.query('SELECT id FROM user_preferences WHERE user_id = $1', [
        userId,
      ]);

      if (checkResult.rows.length === 0) {
        // Crear preferencias por defecto
        await pool.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [userId]);
      }

      // Construir query dinámicamente
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (theme !== undefined) {
        updates.push(`theme = $${paramIndex++}`);
        values.push(theme);
      }
      if (emailNotifications !== undefined) {
        updates.push(`email_notifications = $${paramIndex++}`);
        values.push(emailNotifications);
      }
      if (pushNotifications !== undefined) {
        updates.push(`push_notifications = $${paramIndex++}`);
        values.push(pushNotifications);
      }
      if (inAppNotifications !== undefined) {
        updates.push(`in_app_notifications = $${paramIndex++}`);
        values.push(inAppNotifications);
      }
      if (notificationFrequency !== undefined) {
        updates.push(`notification_frequency = $${paramIndex++}`);
        values.push(notificationFrequency);
      }
      if (compactMode !== undefined) {
        updates.push(`compact_mode = $${paramIndex++}`);
        values.push(compactMode);
      }
      if (showArchived !== undefined) {
        updates.push(`show_archived = $${paramIndex++}`);
        values.push(showArchived);
      }
      if (defaultBoardView !== undefined) {
        updates.push(`default_board_view = $${paramIndex++}`);
        values.push(defaultBoardView);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'At least one preference field is required',
          },
        });
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const result = await pool.query(
        `UPDATE user_preferences 
         SET ${updates.join(', ')}
         WHERE user_id = $${paramIndex}
         RETURNING *`,
        values
      );

      const prefs = result.rows[0];

      return res.json({
        success: true,
        data: {
          preferences: {
            theme: prefs.theme,
            emailNotifications: prefs.email_notifications,
            pushNotifications: prefs.push_notifications,
            inAppNotifications: prefs.in_app_notifications,
            notificationFrequency: prefs.notification_frequency,
            compactMode: prefs.compact_mode,
            showArchived: prefs.show_archived,
            defaultBoardView: prefs.default_board_view,
          },
        },
      });
    } catch (error) {
      console.error('[UserController] UpdatePreferences error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update preferences',
        },
      });
    }
  }
}

export const userController = new UserController();
