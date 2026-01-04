// apps/api/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Middleware para autenticar requests con JWT
 *
 * Extrae el token del header Authorization, lo verifica,
 * y adjunta el usuario decodificado al request.
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  try {
    // Extraer token del header Authorization: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Token de autenticación no proporcionado',
        },
      });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Formato de token inválido. Use: Bearer <token>',
        },
      });
    }

    const token = parts[1];

    // Verificar token
    const decoded = verifyAccessToken(token);

    // Mapear userId a id para consistencia con los controllers
    (req as any).user = {
      id: decoded.userId, // ← CAMBIO CRÍTICO AQUÍ
      email: decoded.email,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: error instanceof Error ? error.message : 'Token inválido o expirado',
      },
    });
  }
}

/**
 * Middleware opcional que permite requests sin token
 * pero adjunta usuario si el token está presente
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = verifyAccessToken(token);

        // Mapear userId a id para consistencia
        (req as any).user = {
          id: decoded.userId, // ← CAMBIO CRÍTICO AQUÍ TAMBIÉN
          email: decoded.email,
        };
      }
    }

    next();
  } catch (error) {
    // Si el token es inválido, simplemente continúa sin usuario
    next();
  }
}
