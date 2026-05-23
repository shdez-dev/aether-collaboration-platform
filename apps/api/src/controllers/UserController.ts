// apps/api/src/controllers/UserController.ts

import { Request, Response } from 'express';
import { pool } from '../lib/db';
import { userActivityService } from '../services/UserActivityService';
import { storageService } from '../services/StorageService';
import path from 'path';
import bcrypt from 'bcrypt';

class UserController {
  /**
   * GET /api/users/search?q=xxx
   * Buscar usuarios por nombre o email parcial (para autocompletado en invitaciones)
   */
  async searchByEmail(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      // Accept both `q` (new) and `email` (legacy) query params
      const raw = (req.query.q ?? req.query.email) as string | undefined;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      if (!raw || typeof raw !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_QUERY', message: 'Query parameter q is required' },
        });
      }

      const q = raw.trim();
      if (q.length < 3) {
        return res.status(400).json({
          success: false,
          error: { code: 'SEARCH_TOO_SHORT', message: 'Search query must be at least 3 characters' },
        });
      }

      const pattern = `%${q}%`;
      const result = await pool.query(
        `SELECT
          id,
          name,
          email,
          avatar,
          bio,
          position,
          location,
          timezone,
          created_at
         FROM users
         WHERE id != $1
           AND (
             name  ILIKE $2
             OR email ILIKE $2
           )
         ORDER BY
           CASE WHEN LOWER(email) = LOWER($3) THEN 0
                WHEN email ILIKE $2            THEN 1
                ELSE 2
           END,
           name ASC
         LIMIT 8`,
        [userId, pattern, q]
      );

      return res.json({
        success: true,
        data: {
          users: result.rows.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            avatar: u.avatar,
            bio: u.bio,
            position: u.position,
            location: u.location,
            timezone: u.timezone,
            createdAt: u.created_at,
          })),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to search users' },
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
        `SELECT COUNT(*) as count
         FROM workspace_members wm
         JOIN workspaces w ON w.id = wm.workspace_id
         WHERE wm.user_id = $1 AND w.archived = false`,
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

      const range = ((req.query.range as string) || '24h') as 'today' | '24h' | 'week';
      const limitByRange: Record<string, number> = { today: 50, '24h': 100, week: 200 };
      const limit = limitByRange[range] ?? 100;

      // Parse optional workspace filter (comma-separated UUIDs)
      const wsParam = req.query.workspaceIds as string | undefined;
      const workspaceIds = wsParam ? wsParam.split(',').filter(Boolean) : undefined;

      const activities = await userActivityService.getUserActivity(userId as any, limit, { workspaceIds, range });

      const events = activities.map((activity) => {
        const userName: string = activity.user_name || 'Miembro del equipo';
        return {
          id: activity.id,
          type: activity.activity_type,
          payload: {
            ...(activity.metadata || {}),
            // contexto enriquecido desde columnas JOIN (sobrescribe metadata si viene del JOIN)
            workspaceName: activity.workspace_name || (activity.metadata || {}).workspaceName,
            boardName:     activity.board_name     || (activity.metadata || {}).boardName,
          },
          timestamp: activity.created_at,
          createdBy: userName,
          userName,
          userAvatar: activity.user_avatar || null,
        };
      });

      return res.json({
        success: true,
        data: {
          events,
        },
      });
    } catch (error) {
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

      // Validar que al menos un campo esté presente (usar undefined, no falsy, para permitir strings vacíos)
      if (
        name === undefined &&
        bio === undefined &&
        position === undefined &&
        timezone === undefined &&
        language === undefined &&
        phone === undefined &&
        location === undefined
      ) {
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

      // Subir a Cloudflare R2
      const ext = path.extname(req.file.originalname) || '.jpg';
      const key = `avatars/${userId}-${Date.now()}${ext}`;
      const avatarUrl = await storageService.upload(key, req.file.buffer, req.file.mimetype);

      // Eliminar avatar anterior si existe y está en R2
      const prevResult = await pool.query('SELECT avatar FROM users WHERE id = $1', [userId]);
      if (prevResult.rows[0]?.avatar) {
        await storageService.deleteByUrl(prevResult.rows[0].avatar).catch(() => {});
      }

      // Actualizar el avatar en la base de datos
      const result = await pool.query(
        `UPDATE users 
         SET avatar = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, email, name, avatar, bio, position, timezone, language, phone, location, created_at, updated_at`,
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
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
          avatarUrl: user.avatar,
        },
      });
    } catch (error) {
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
          `INSERT INTO user_preferences (id, user_id, updated_at) VALUES (uuid_generate_v4(), $1, CURRENT_TIMESTAMP) RETURNING *`,
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
              hasGithubToken: false,
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
            hasGithubToken: !!prefs.github_token,
          },
        },
      });
    } catch (error) {
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
        githubToken,
      } = req.body;

      // Verificar si existen preferencias
      const checkResult = await pool.query('SELECT id FROM user_preferences WHERE user_id = $1', [
        userId,
      ]);

      if (checkResult.rows.length === 0) {
        // Crear preferencias por defecto
        await pool.query('INSERT INTO user_preferences (id, user_id, updated_at) VALUES (uuid_generate_v4(), $1, CURRENT_TIMESTAMP)', [userId]);
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
      if (githubToken !== undefined) {
        updates.push(`github_token = $${paramIndex++}`);
        values.push(githubToken || null);  // empty string clears the token
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
            hasGithubToken: !!prefs.github_token,
          },
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update preferences',
        },
      });
    }
  }

  /**
   * GET /api/users/me/agenda
   * Milestones y sprints próximos de los boards del usuario
   */
  async getAgenda(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const result = await pool.query(
        `SELECT 'milestone' as type,
                bm.id,
                bm.name,
                bm.date::text as event_date,
                bm.color,
                b.id as board_id,
                b.name as board_name,
                w.id as workspace_id,
                w.name as workspace_name
         FROM board_milestones bm
         JOIN boards b ON bm.board_id = b.id
         JOIN workspaces w ON b.workspace_id = w.id
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1
           AND b.archived = false
           AND bm.date BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE + INTERVAL '14 days'

         UNION ALL

         SELECT 'sprint_end' as type,
                bs.id,
                'Sprint: ' || bs.name as name,
                bs.end_date::text as event_date,
                '#f59e0b' as color,
                b.id as board_id,
                b.name as board_name,
                w.id as workspace_id,
                w.name as workspace_name
         FROM board_sprints bs
         JOIN boards b ON bs.board_id = b.id
         JOIN workspaces w ON b.workspace_id = w.id
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1
           AND b.archived = false
           AND bs.status IN ('PLANNED', 'ACTIVE')
           AND bs.end_date BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE + INTERVAL '14 days'

         ORDER BY event_date ASC`,
        [userId]
      );

      const items = result.rows.map((r) => ({
        type: r.type,
        id: r.id,
        name: r.name,
        date: r.event_date,
        color: r.color,
        boardId: r.board_id,
        boardName: r.board_name,
        workspaceId: r.workspace_id,
        workspaceName: r.workspace_name,
      }));

      return res.json({ success: true, data: items });
    } catch (error) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get agenda' } });
    }
  }

  /**
   * GET /api/users/me/github/prs
   * PRs de GitHub donde el usuario es reviewer (requiere github_token en preferencias)
   */
  async getGithubPRs(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const prefsResult = await pool.query(
        `SELECT github_token FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      const token: string | null = prefsResult.rows[0]?.github_token ?? null;
      if (!token) {
        return res.status(400).json({ success: false, error: { code: 'GITHUB_TOKEN_NOT_SET', message: 'GitHub token not configured' } });
      }

      const ghResponse = await fetch(
        'https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=10&sort=updated',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (ghResponse.status === 401) {
        return res.status(400).json({ success: false, error: { code: 'GITHUB_TOKEN_INVALID', message: 'GitHub token is invalid or expired' } });
      }

      if (!ghResponse.ok) {
        return res.status(502).json({ success: false, error: { code: 'GITHUB_API_ERROR', message: `GitHub API error: ${ghResponse.status}` } });
      }

      const ghData = await ghResponse.json() as { items: any[] };

      const prs = (ghData.items || []).map((item: any) => {
        // repository_url: "https://api.github.com/repos/owner/repo"
        const repoMatch = (item.repository_url || '').match(/repos\/(.+)$/);
        const repo = repoMatch ? repoMatch[1] : 'unknown/repo';
        return {
          id: item.id,
          number: item.number,
          title: item.title,
          repo,
          url: item.html_url,
          author: {
            login: item.user?.login ?? '',
            avatarUrl: item.user?.avatar_url ?? '',
          },
          draft: item.draft ?? false,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      });

      return res.json({ success: true, data: prs });
    } catch (error) {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch GitHub PRs' } });
    }
  }

  /**
   * GET /api/users?search=xxx&page=1&limit=20
   * Contactos - Lista de usuarios con workspaces compartidos
   */
  async listUsers(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;
      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const search = (req.query.search as string) || '';
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;

      const searchParam = search ? `%${search.trim()}%` : '%';

      // Solo traer usuarios que comparten al menos un workspace con el usuario actual
      const result = await pool.query(
        `SELECT DISTINCT u.id, u.name, u.email, u.avatar, u.bio, u.position, u.location, u.created_at,
         COUNT(DISTINCT wm2.workspace_id) as shared_workspaces_count,
         EXISTS(
           SELECT 1 FROM user_favorite_contacts ufc 
           WHERE ufc.user_id = $1 AND ufc.favorite_user_id = u.id
         ) as is_favorite
         FROM users u
         INNER JOIN workspace_members wm1 ON wm1.user_id = $1
         INNER JOIN workspace_members wm2 ON wm2.workspace_id = wm1.workspace_id
         WHERE wm2.user_id = u.id
         AND u.id != $1
         AND (LOWER(u.name) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2))
         GROUP BY u.id, u.name, u.email, u.avatar, u.bio, u.position, u.location, u.created_at
         ORDER BY shared_workspaces_count DESC, u.name ASC
         LIMIT $3 OFFSET $4`,
        [requestingUserId, searchParam, limit, offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(DISTINCT u.id) as total
         FROM users u
         INNER JOIN workspace_members wm1 ON wm1.user_id = $1
         INNER JOIN workspace_members wm2 ON wm2.workspace_id = wm1.workspace_id
         WHERE wm2.user_id = u.id
         AND u.id != $1
         AND (LOWER(u.name) LIKE LOWER($2) OR LOWER(u.email) LIKE LOWER($2))`,
        [requestingUserId, searchParam]
      );

      const users = result.rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        bio: u.bio,
        position: u.position,
        location: u.location,
        createdAt: u.created_at,
        sharedWorkspacesCount: parseInt(u.shared_workspaces_count),
        isFavorite: u.is_favorite,
      }));

      return res.json({
        success: true,
        data: {
          users,
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list users' },
      });
    }
  }

  /**
   * GET /api/users/:id
   * Perfil público de un usuario
   */
  async getUserProfile(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;
      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { id } = req.params;

      const result = await pool.query(
        `SELECT id, name, email, avatar, bio, position, location, created_at
         FROM users
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const u = result.rows[0];

      // Workspaces compartidos con el usuario que consulta
      const sharedWorkspaces = await pool.query(
        `SELECT w.id, w.name, w.icon, w.color, wm.role
         FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         JOIN workspace_members wm2 ON wm2.workspace_id = w.id
         WHERE wm.user_id = $1 AND wm2.user_id = $2
         ORDER BY w.name ASC`,
        [id, requestingUserId]
      );

      return res.json({
        success: true,
        data: {
          user: {
            id: u.id,
            name: u.name,
            email: u.email,
            avatar: u.avatar,
            bio: u.bio,
            position: u.position,
            location: u.location,
            createdAt: u.created_at,
          },
          sharedWorkspaces: sharedWorkspaces.rows.map((w) => ({
            id: w.id,
            name: w.name,
            icon: w.icon,
            color: w.color,
            role: w.role,
          })),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get user profile' },
      });
    }
  }

  /**
   * POST /api/users/favorites/:userId
   * Agregar un usuario a favoritos
   */
  async addFavorite(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;
      const { userId: favoriteUserId } = req.params;

      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      if (requestingUserId === favoriteUserId) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Cannot add yourself as favorite' },
        });
      }

      // Verificar que el usuario existe
      const userExists = await pool.query('SELECT id FROM users WHERE id = $1', [favoriteUserId]);
      if (userExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      // Agregar a favoritos (ignora si ya existe)
      await pool.query(
        `INSERT INTO user_favorite_contacts (user_id, favorite_user_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, favorite_user_id) DO NOTHING`,
        [requestingUserId, favoriteUserId]
      );

      return res.json({
        success: true,
        data: { message: 'User added to favorites' },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to add favorite' },
      });
    }
  }

  /**
   * DELETE /api/users/favorites/:userId
   * Quitar un usuario de favoritos
   */
  async removeFavorite(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;
      const { userId: favoriteUserId } = req.params;

      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      await pool.query(
        `DELETE FROM user_favorite_contacts
         WHERE user_id = $1 AND favorite_user_id = $2`,
        [requestingUserId, favoriteUserId]
      );

      return res.json({
        success: true,
        data: { message: 'User removed from favorites' },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove favorite' },
      });
    }
  }

  /**
   * GET /api/users/favorites
   * Obtener lista de usuarios favoritos
   */
  async getFavorites(req: Request, res: Response) {
    try {
      const requestingUserId = req.user?.id;

      if (!requestingUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const result = await pool.query(
        `SELECT 
          u.id, u.name, u.email, u.avatar, u.bio, u.position, u.location, u.created_at,
          ufc.created_at as favorited_at,
          COUNT(DISTINCT wm2.workspace_id) as shared_workspaces_count
         FROM user_favorite_contacts ufc
         INNER JOIN users u ON ufc.favorite_user_id = u.id
         LEFT JOIN workspace_members wm1 ON wm1.user_id = $1
         LEFT JOIN workspace_members wm2 ON wm2.workspace_id = wm1.workspace_id AND wm2.user_id = u.id
         WHERE ufc.user_id = $1
         GROUP BY u.id, u.name, u.email, u.avatar, u.bio, u.position, u.location, u.created_at, ufc.created_at
         ORDER BY ufc.created_at DESC`,
        [requestingUserId]
      );

      const favorites = result.rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        bio: u.bio,
        position: u.position,
        location: u.location,
        createdAt: u.created_at,
        favoritedAt: u.favorited_at,
        sharedWorkspacesCount: parseInt(u.shared_workspaces_count) || 0,
      }));

      return res.json({
        success: true,
        data: { favorites },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get favorites' },
      });
    }
  }

  /** GET /api/users/me/teammates — personas en los mismos equipos que el usuario */
  async getTeammates(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const result = await pool.query(
        `SELECT DISTINCT ON (u.id)
           u.id, u.name, u.email, u.avatar,
           COUNT(cm.card_id) FILTER (WHERE c.completed = false)                                          AS total_cards,
           COUNT(cm.card_id) FILTER (WHERE c.completed = false AND c.due_date < NOW())                   AS overdue_cards,
           COUNT(cm.card_id) FILTER (WHERE c.completed = true AND c.completed_at >= NOW() - INTERVAL '7 days') AS completed_this_week,
           MAX(c.updated_at) AS last_activity
         FROM team_members tm1
         JOIN team_members tm2 ON tm2.team_id = tm1.team_id AND tm2.user_id != tm1.user_id
         JOIN users u ON u.id = tm2.user_id
         LEFT JOIN card_members cm ON cm.user_id = u.id
         LEFT JOIN cards c ON c.id = cm.card_id
         WHERE tm1.user_id = $1
         GROUP BY u.id, u.name, u.email, u.avatar
         ORDER BY u.id, u.name ASC`,
        [userId]
      );

      const teammates = result.rows.map((r) => ({
        id:                r.id,
        name:              r.name,
        email:             r.email,
        avatar:            r.avatar ?? null,
        totalCards:        Number(r.total_cards ?? 0),
        overdueCards:      Number(r.overdue_cards ?? 0),
        completedThisWeek: Number(r.completed_this_week ?? 0),
        lastActivity:      r.last_activity ? new Date(r.last_activity).toISOString() : null,
      }));

      return res.json({ success: true, data: { teammates } });
    } catch (error) {
      console.error('[UserController.getTeammates]', error);
      return res.status(500).json({ success: false, error: { message: 'Error al obtener compañeros' } });
    }
  }

  /** GET /api/users/me/team-standups — standups de hoy de los compañeros de equipo */
  async getTeamStandups(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ success: false, error: { message: 'No autenticado' } });

      const result = await pool.query(
        `SELECT
           s.id, s.user_id, s.today_items, s.blockers, s.published_at,
           u.name AS user_name, u.avatar AS user_avatar
         FROM standups s
         JOIN users u ON u.id = s.user_id
         WHERE s.date = CURRENT_DATE
           AND s.published_at IS NOT NULL
           AND s.user_id IN (
             SELECT DISTINCT tm2.user_id
             FROM team_members tm1
             JOIN team_members tm2 ON tm2.team_id = tm1.team_id AND tm2.user_id != tm1.user_id
             WHERE tm1.user_id = $1
           )
         ORDER BY s.published_at DESC`,
        [userId]
      );

      const standups = result.rows.map((r) => ({
        id:          r.id,
        userId:      r.user_id,
        userName:    r.user_name,
        userAvatar:  r.user_avatar ?? null,
        todayItems:  r.today_items ?? [],
        blockers:    r.blockers ?? [],
        publishedAt: new Date(r.published_at).toISOString(),
      }));

      return res.json({ success: true, data: { standups } });
    } catch (error) {
      console.error('[UserController.getTeamStandups]', error);
      return res.status(500).json({ success: false, error: { message: 'Error al obtener standups del equipo' } });
    }
  }
}

export const userController = new UserController();
