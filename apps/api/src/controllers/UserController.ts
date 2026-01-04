// apps/api/src/controllers/UserController.ts

import { Request, Response } from 'express';
import { pool } from '../lib/db';

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
}

export const userController = new UserController();
