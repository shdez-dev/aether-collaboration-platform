// apps/api/src/controllers/AuthController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { UserId } from '@aether/types';
import { eventStore } from '../services/EventStoreService';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { pool } from '../lib/db';

// Esquemas de validación con Zod
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Password debe tener mínimo 8 caracteres'),
  name: z.string().min(2, 'Nombre debe tener mínimo 2 caracteres'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Password es requerida'),
});

export class AuthController {
  /**
   * POST /api/auth/register
   * Registra un nuevo usuario
   */
  async register(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      // 1. Validar input
      const validatedData = registerSchema.parse(req.body);
      const { email, password, name } = validatedData;

      // 2. Verificar que el email no exista
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Este email ya está registrado',
          },
        });
      }

      // 3. Hashear password con bcrypt
      const hashedPassword = await bcrypt.hash(password, 12);

      // 4. Crear usuario en la base de datos
      const result = await client.query(
        `INSERT INTO users (id, email, password, name, created_at, updated_at) 
         VALUES (uuid_generate_v4(), $1, $2, $3, NOW(), NOW()) 
         RETURNING id, email, name, avatar, created_at`,
        [email, hashedPassword, name]
      );

      const user = result.rows[0];

      // 5. Emitir evento auth.user.registered
      await eventStore.emit(
        'auth.user.registered',
        {
          userId: user.id as UserId,
          email: user.email,
          name: user.name,
        },
        user.id as UserId
      );

      // 6. Retornar usuario creado (SIN password)
      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            createdAt: user.created_at,
          },
        },
        meta: {
          timestamp: Date.now(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    } catch (error) {
      // Manejo de errores de validación Zod
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: error.errors,
          },
        });
      }

      console.error('[AUTH] Register error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al registrar usuario',
        },
      });
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/auth/login
   * Inicia sesión de un usuario
   */
  async login(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      // 1. Validar input
      const validatedData = loginSchema.parse(req.body);
      const { email, password } = validatedData;

      // 2. Buscar usuario por email
      const result = await client.query(
        'SELECT id, email, name, password, avatar FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos',
          },
        });
      }

      const user = result.rows[0];

      // 3. Comparar password con bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos',
          },
        });
      }

      // 4. Generar JWT access token y refresh token
      const tokenPayload = {
        userId: user.id as UserId,
        email: user.email,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // 5. Emitir evento auth.user.loggedIn
      await eventStore.emit(
        'auth.user.loggedIn',
        {
          userId: user.id as UserId,
          email: user.email,
        },
        user.id as UserId
      );

      // 6. Retornar tokens y datos de usuario
      return res.status(200).json({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
          },
        },
        meta: {
          timestamp: Date.now(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: error.errors,
          },
        });
      }

      console.error('[AUTH] Login error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al iniciar sesión',
        },
      });
    } finally {
      client.release();
    }
  }

  /**
   * POST /api/auth/logout
   * Cierra sesión del usuario
   */
  async logout(req: Request, res: Response) {
    try {
      // Cambio: user?.id en lugar de user?.userId
      const userId = (req as any).user?.id;

      if (userId) {
        await eventStore.emit('auth.user.loggedOut', { userId }, userId);
      }

      return res.status(200).json({
        success: true,
        data: {
          message: 'Sesión cerrada exitosamente',
        },
      });
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al cerrar sesión',
        },
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Renueva el access token usando el refresh token
   */
  async refresh(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_REQUIRED',
            message: 'Refresh token es requerido',
          },
        });
      }

      // Verificar el refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Buscar usuario en la base de datos
      const result = await client.query('SELECT id, email, name, avatar FROM users WHERE id = $1', [
        decoded.userId,
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado',
          },
        });
      }

      const user = result.rows[0];

      // Generar nuevos tokens
      const tokenPayload = {
        userId: user.id as UserId,
        email: user.email,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      return res.status(200).json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
          },
        },
      });
    } catch (error) {
      console.error('[AUTH] Refresh token error:', error);
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token inválido o expirado',
        },
      });
    } finally {
      client.release();
    }
  }

  /**
   * GET /api/auth/me
   * Obtiene información del usuario autenticado
   */
  async me(req: Request, res: Response) {
    const client = await pool.connect();
    try {
      // Cambio: user?.id en lugar de user?.userId
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No autenticado',
          },
        });
      }

      const result = await client.query(
        `SELECT id, email, name, avatar, bio, position, phone, location, timezone, language,
                created_at, updated_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Usuario no encontrado',
          },
        });
      }

      const user = result.rows[0];

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            bio: user.bio,
            position: user.position,
            phone: user.phone,
            location: user.location,
            timezone: user.timezone,
            language: user.language,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
        },
      });
    } catch (error) {
      console.error('[AUTH] Me error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al obtener usuario',
        },
      });
    } finally {
      client.release();
    }
  }
}

export const authController = new AuthController();
