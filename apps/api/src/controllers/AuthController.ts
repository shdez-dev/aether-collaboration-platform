// apps/api/src/controllers/AuthController.ts

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import type { UserId } from '@aether/types';
import { eventStore } from '../services/EventStoreService';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { pool } from '../lib/db';
import { emailService } from '../services/EmailService';
import { RefreshTokenService } from '../services/RefreshTokenService';
import { passwordSchema } from '../schemas/password';
import { buildFrontendUrl } from '../utils/frontendUrl';
import { invalidateUserSockets } from '../websocket/RealtimeGateway';

// Hash usado para nunca almacenar tokens de reset/verificación en claro en la BD.
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Esquemas de validación con Zod
const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  name: z.string().min(2, 'Nombre debe tener mínimo 2 caracteres'),
  invitationToken: z.string().regex(/^[a-f0-9]{64}$/i, 'Invitación inválida'),
  termsRead: z.literal(true),
  privacyRead: z.literal(true),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Password es requerida'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token es requerido'),
  newPassword: passwordSchema,
});

// Hash bcrypt de relleno con coste 12 para igualar la latencia cuando el email
// no existe — evita un oráculo de enumeración de usuarios por tiempo de respuesta.
const DUMMY_BCRYPT_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO3J0Poy3xWg6m9rJ0sQ5kJ0aQ8zq5n2u';

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token es requerido'),
});

export class AuthController {
  async invitationPreview(req: Request, res: Response) {
    res.set('Cache-Control', 'no-store');
    const token = req.params.token;
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(404).json({ success: false, error: { code: 'INVITATION_NOT_FOUND', message: 'Invitación no disponible.' } });
    }
    try {
      const platform = await pool.query(
        `SELECT email, expires_at AS "expiresAt" FROM platform_invitations
         WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`,
        [hashToken(token)]
      );
      if (platform.rows[0]) {
        return res.json({ success: true, data: { invitation: { ...platform.rows[0], type: 'PLATFORM' } } });
      }
      const result = await pool.query(
        `SELECT oi.email, o.name AS "organizationName", oi.expires_at AS "expiresAt"
         FROM organization_invitations oi JOIN organizations o ON o.id = oi.organization_id
         WHERE oi.token_hash = $1 AND oi.accepted_at IS NULL AND oi.revoked_at IS NULL
           AND oi.expires_at > NOW() AND o.type <> 'PERSONAL'`,
        [hashToken(token)]
      );
      if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'INVITATION_NOT_FOUND', message: 'Invitación no disponible.' } });
      return res.json({ success: true, data: { invitation: { ...result.rows[0], type: 'ORGANIZATION' } } });
    } catch {
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'No se pudo consultar la invitación.' } });
    }
  }
  /**
   * POST /api/auth/join
   * Activa una cuenta desde una invitación vigente a Aether o a una organización.
   */
  async register(req: Request, res: Response) {
    let client;
    try {
      // 1. Validar input primero (antes de obtener conexión)
      const validatedData = registerSchema.parse(req.body);
      const { email: rawEmail, password, name, invitationToken } = validatedData;
      const email = rawEmail.trim().toLowerCase();
      // organizations.name es VARCHAR(255); reservar los 9 caracteres del
      // sufijo evita que un nombre de usuario válido rompa el registro.
      const personalOrganizationName = `${name.trim().slice(0, 246) || 'Cuenta personal'} - Aether`;

      // 2. Obtener conexión del pool
      client = await pool.connect();

      // El enlace llega al correo invitado y queda ligado a ese destinatario.
      const platformInvitation = await client.query(
        `SELECT id, email FROM platform_invitations
         WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()`,
        [hashToken(invitationToken)]
      );
      const organizationInvitation = platformInvitation.rows[0] ? null : await client.query(
        `SELECT oi.id, oi.email FROM organization_invitations oi
         JOIN organizations o ON o.id = oi.organization_id
         WHERE oi.token_hash = $1 AND oi.accepted_at IS NULL AND oi.revoked_at IS NULL
           AND oi.expires_at > NOW() AND o.type <> 'PERSONAL'`,
        [hashToken(invitationToken)]
      );
      const invitation = platformInvitation.rows[0] ?? organizationInvitation?.rows[0];
      const isPlatformInvitation = Boolean(platformInvitation.rows[0]);
      if (!invitation || invitation.email.toLowerCase() !== email) {
        return res.status(403).json({ success: false, error: { code: 'INVITATION_REQUIRED', message: 'La invitación no está vigente o no corresponde a este correo.' } });
      }

      // 3. Verificar que el email no exista
      const existingUser = await client.query('SELECT id FROM users WHERE lower(email) = $1', [email]);

      if (existingUser.rows.length > 0) {
        client.release();
        client = undefined;
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'Este email ya está registrado',
          },
        });
      }

      // 4. Hashear password con bcrypt
      const hashedPassword = await bcrypt.hash(password, 12);

      // 6. Crear la cuenta y su organización personal vacía como una sola
      // unidad. No crear ningún workspace aquí: la persona elige su nombre y
      // lo crea explícitamente durante el onboarding.
      await client.query('BEGIN');
      let user;
      try {
        // Bloquear la invitación durante la creación evita activar una cuenta
        // con un enlace revocado o consumido en paralelo.
        const lockedInvitation = await client.query(
          `SELECT email FROM ${isPlatformInvitation ? 'platform_invitations' : 'organization_invitations'} WHERE id = $1 AND token_hash = $2
           AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW() FOR UPDATE`,
          [invitation.id, hashToken(invitationToken)]
        );
        if (!lockedInvitation.rows[0] || lockedInvitation.rows[0].email.toLowerCase() !== email) {
          await client.query('ROLLBACK');
          return res.status(403).json({ success: false, error: { code: 'INVITATION_REQUIRED', message: 'La invitación ya no está disponible.' } });
        }
        const result = await client.query(
          `INSERT INTO users (id, email, password, name, email_verified, terms_read_at, privacy_read_at, created_at, updated_at)
           VALUES (uuid_generate_v4(), $1, $2, $3, TRUE, NOW(), NOW(), NOW(), NOW())
           RETURNING id, email, name, avatar, created_at`,
          [email, hashedPassword, name]
        );
        user = result.rows[0];

        const organization = await client.query(
          `INSERT INTO organizations (id, name, type, owner_user_id, created_at, updated_at)
           VALUES (uuid_generate_v4(), $1, 'PERSONAL'::"OrganizationType", $2, NOW(), NOW())
           RETURNING id`,
          [personalOrganizationName, user.id]
        );

        await client.query(
          `INSERT INTO organization_members (id, organization_id, user_id, role)
           VALUES (uuid_generate_v4(), $1, $2, 'OWNER'::"OrganizationMemberRole")`,
          [organization.rows[0].id, user.id]
        );
        if (isPlatformInvitation) {
          await client.query(
            `UPDATE platform_invitations SET accepted_by = $2, accepted_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [invitation.id, user.id],
          );
        }
        await client.query('COMMIT');
      } catch (registrationError) {
        await client.query('ROLLBACK');
        throw registrationError;
      }

      // El enlace de invitación recibido en el correo acredita su posesión.
      client.release();
      client = undefined;

      // 8. Retornar usuario creado — el cliente debe verificar su email antes de iniciar sesión
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
          requiresEmailVerification: false,
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

      console.error('[register] ERROR:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al registrar usuario',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * POST /api/auth/login
   * Inicia sesión de un usuario
   */
  async login(req: Request, res: Response) {
    let client;
    try {
      // 1. Validar input primero
      const validatedData = loginSchema.parse(req.body);
      const { email: rawEmail, password } = validatedData;
      const email = rawEmail.trim().toLowerCase();

      // 2. Obtener conexión del pool
      client = await pool.connect();

      // 3. Buscar usuario por email
      const result = await client.query(
        'SELECT id, email, name, password, avatar, email_verified FROM users WHERE email = $1 AND deletion_requested_at IS NULL',
        [email]
      );

      if (result.rows.length === 0) {
        client.release();
        client = undefined;
        // Comparación de relleno para igualar el tiempo de respuesta del caso
        // "usuario existe" y no filtrar la existencia del email por timing.
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Email o contraseña incorrectos',
          },
        });
      }

      const user = result.rows[0];

      // Liberar conexión ya que no la necesitamos más
      client.release();
      client = undefined;

      // 4. Comparar password con bcrypt
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

      if (!user.email_verified) {
        return res.status(403).json({
          success: false,
          error: { code: 'EMAIL_NOT_VERIFIED', message: 'Debes verificar tu correo electrónico antes de iniciar sesión' },
        });
      }

      // 6. Generar JWT access token y refresh token
      const tokenPayload = {
        userId: user.id as UserId,
        email: user.email,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Registrar el refresh token en la allowlist (permite revocación y rotación)
      await RefreshTokenService.issue(user.id, refreshToken);

      // 7. Retornar tokens y datos de usuario
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

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al iniciar sesión',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * POST /api/auth/logout
   * Cierra sesión del usuario
   */
  async logout(req: Request, res: Response) {
    try {
      // Revocar todos los refresh tokens del usuario para que no puedan reutilizarse
      // tras cerrar sesión (logout efectivo, no un no-op).
      const userId = (req as any).user?.id;
      if (userId) {
        await RefreshTokenService.revokeAllForUser(userId);
        await invalidateUserSockets(userId);
      }

      return res.status(200).json({
        success: true,
        data: {
          message: 'Sesión cerrada exitosamente',
        },
      });
    } catch (error) {
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
    let client;
    try {
      client = await pool.connect();
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

      // Verificar la firma/expiración del refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Validar contra la allowlist de tokens (permite revocación)
      const tokenState = await RefreshTokenService.check(refreshToken);

      if (tokenState === 'revoked') {
        // Reuso de un token ya rotado/revocado → posible robo. Revocar toda la
        // familia de tokens del usuario como respuesta defensiva.
        await RefreshTokenService.revokeAllForUser(decoded.userId);
        await invalidateUserSockets(decoded.userId);
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token inválido o expirado' },
        });
      }

      if (tokenState !== 'valid') {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token inválido o expirado' },
        });
      }

      // Buscar usuario en la base de datos
      const result = await client.query('SELECT id, email, name, avatar FROM users WHERE id = $1 AND deletion_requested_at IS NULL', [
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

      // Rotar: revocar el viejo y registrar el nuevo de forma atómica
      await RefreshTokenService.rotate(user.id, refreshToken, newRefreshToken);

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
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token inválido o expirado',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * GET /api/auth/me
   * Obtiene información del usuario autenticado
   */
  async me(req: Request, res: Response) {
    let client;
    try {
      client = await pool.connect();
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
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al obtener usuario',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * POST /api/auth/send-verification-email
   * Sends or resends email verification email
   */
  async sendVerificationEmail(req: Request, res: Response) {
    let client;
    try {
      client = await pool.connect();
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

      // Get user info
      const result = await client.query(
        'SELECT id, email, name, email_verified FROM users WHERE id = $1 AND deletion_requested_at IS NULL',
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

      if (user.email_verified) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_VERIFIED',
            message: 'Email ya está verificado',
          },
        });
      }

      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Guardar SOLO el hash del token (el token en claro viaja en el email)
      await client.query(
        `UPDATE users
         SET email_verification_token = $1, email_verification_expires = $2
         WHERE id = $3`,
        [hashToken(token), expires, userId]
      );

      // Send verification email
      const verificationLink = buildFrontendUrl('/verify-email', { token });

      await emailService.sendVerificationEmail(user.email, {
        userName: user.name,
        verificationLink,
      });

      return res.status(200).json({
        success: true,
        data: {
          message: 'Email de verificación enviado',
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al enviar email de verificación',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * POST /api/auth/resend-verification
   * Reenvía el email de verificación sin requerir autenticación.
   * Acepta { email } en el body. Por seguridad, siempre retorna 200
   * aunque el email no exista o ya esté verificado.
   */
  async resendVerificationPublic(req: Request, res: Response) {
    let client;
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Email requerido' },
        });
      }

      client = await pool.connect();
      const result = await client.query(
        'SELECT id, email, name, email_verified FROM users WHERE email = $1 AND deletion_requested_at IS NULL',
        [email.toLowerCase().trim()]
      );

      if (result.rows.length === 0 || result.rows[0].email_verified) {
        // Respuesta genérica para no revelar si el email existe o ya está verificado
        return res.status(200).json({
          success: true,
          data: { message: 'Si el correo existe y no está verificado, recibirás un email.' },
        });
      }

      const user = result.rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await client.query(
        `UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3`,
        [hashToken(token), expires, user.id]
      );

      const verificationLink = buildFrontendUrl('/verify-email', { token });

      await emailService.sendVerificationEmail(user.email, {
        userName: user.name,
        verificationLink,
      });

      return res.status(200).json({
        success: true,
        data: { message: 'Si el correo existe y no está verificado, recibirás un email.' },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Error al procesar la solicitud' },
      });
    } finally {
      if (client) client.release();
    }
  }

  /**
   * POST /api/auth/verify-email
   * Verify email address with token
   */
  async verifyEmail(req: Request, res: Response) {
    let client;
    let transactionOpen = false;
    try {
      client = await pool.connect();
      const validatedData = verifyEmailSchema.parse(req.body);
      const { token } = validatedData;

      // Find user with this token (se compara contra el hash almacenado)
      const result = await client.query(
        `SELECT id, email, name, email_verification_token, email_verification_expires
         FROM users
         WHERE email_verification_token = $1`,
        [hashToken(token)]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de verificación inválido',
          },
        });
      }

      const user = result.rows[0];

      // Check if token is expired
      if (new Date() > new Date(user.email_verification_expires)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token de verificación expirado',
          },
        });
      }

      // La sesión y la verificación se confirman juntas: un fallo al guardar
      // el refresh token no debe consumir un enlace válido.
      const tokenPayload = { userId: user.id as UserId, email: user.email };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);
      await client.query('BEGIN');
      transactionOpen = true;
      await RefreshTokenService.issue(user.id, refreshToken, client);
      await client.query(
        `UPDATE users 
         SET email_verified = TRUE, 
             email_verification_token = NULL, 
             email_verification_expires = NULL 
         WHERE id = $1`,
        [user.id]
      );

      // Obtener avatar del usuario
      const profileResult = await client.query('SELECT avatar FROM users WHERE id = $1', [user.id]);
      const avatar = profileResult.rows[0]?.avatar || null;
      await client.query('COMMIT');
      transactionOpen = false;

      return res.status(200).json({
        success: true,
        data: {
          message: 'Email verificado exitosamente',
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar,
          },
        },
      });
    } catch (error) {
      if (transactionOpen && client) {
        try { await client.query('ROLLBACK'); } catch { /* original error wins */ }
      }
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

      console.error('[verify-email] failed:', error instanceof Error ? error.message : 'unknown');
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al verificar email',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Request password reset email
   */
  async forgotPassword(req: Request, res: Response) {
    let client;
    try {
      client = await pool.connect();
      const validatedData = forgotPasswordSchema.parse(req.body);
      const email = validatedData.email.trim().toLowerCase();

      // Find user by email
      const result = await client.query('SELECT id, email, name FROM users WHERE email = $1 AND deletion_requested_at IS NULL', [
        email,
      ]);

      // Always return success even if user doesn't exist (security best practice)
      if (result.rows.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            message: 'Si el email existe, recibirás un correo con instrucciones',
          },
        });
      }

      const user = result.rows[0];

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Guardar SOLO el hash del token (el token en claro viaja en el email)
      await client.query(
        `UPDATE users
         SET password_reset_token = $1, password_reset_expires = $2
         WHERE id = $3`,
        [hashToken(token), expires, user.id]
      );

      // Send password reset email
      const resetLink = buildFrontendUrl('/reset-password', { token });

      await emailService.sendPasswordResetEmail(user.email, {
        userName: user.name,
        resetLink,
      });

      return res.status(200).json({
        success: true,
        data: {
          message: 'Si el email existe, recibirás un correo con instrucciones',
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

      console.error('forgotPassword error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: process.env.NODE_ENV === 'development'
            ? (error instanceof Error ? error.message : String(error))
            : 'Error al procesar solicitud',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * POST /api/auth/reset-password
   * Reset password with token
   */
  async resetPassword(req: Request, res: Response) {
    let client;
    try {
      client = await pool.connect();
      const validatedData = resetPasswordSchema.parse(req.body);
      const { token, newPassword } = validatedData;

      // Find user with this token (se compara contra el hash almacenado)
      const result = await client.query(
        `SELECT id, email, password_reset_token, password_reset_expires
         FROM users
         WHERE password_reset_token = $1`,
        [hashToken(token)]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de recuperación inválido',
          },
        });
      }

      const user = result.rows[0];

      // Check if token is expired
      if (new Date() > new Date(user.password_reset_expires)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token de recuperación expirado',
          },
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and clear token
      await client.query(
        `UPDATE users
         SET password = $1,
             password_reset_token = NULL,
             password_reset_expires = NULL
         WHERE id = $2`,
        [hashedPassword, user.id]
      );

      // Al cambiar la contraseña, invalidar todas las sesiones activas (refresh tokens)
      await RefreshTokenService.revokeAllForUser(user.id);
      await invalidateUserSockets(user.id);

      return res.status(200).json({
        success: true,
        data: {
          message: 'Contraseña actualizada exitosamente',
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

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error al restablecer contraseña',
        },
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}

export const authController = new AuthController();
