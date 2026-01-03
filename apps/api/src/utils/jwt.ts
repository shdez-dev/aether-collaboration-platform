import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import type { UserId } from '@aether/types';

const JWT_SECRET: Secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

const JWT_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as StringValue | undefined) ?? '1h';

const REFRESH_TOKEN_SECRET: Secret = process.env.REFRESH_TOKEN_SECRET ?? 'dev-refresh-secret';

const REFRESH_TOKEN_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.REFRESH_TOKEN_EXPIRES_IN as StringValue | undefined) ?? '7d';

export interface TokenPayload {
  userId: UserId;
  email: string;
}

/**
 * Genera un access token JWT
 */
export function generateAccessToken(payload: TokenPayload): string {
  const plainPayload = {
    userId: payload.userId as string,
    email: payload.email,
  };

  return jwt.sign(plainPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Genera un refresh token JWT
 */
export function generateRefreshToken(payload: TokenPayload): string {
  const plainPayload = {
    userId: payload.userId as string,
    email: payload.email,
  };

  return jwt.sign(plainPayload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * Verifica y decodifica un access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
    };

    return {
      userId: decoded.userId as UserId,
      email: decoded.email,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verifica y decodifica un refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET) as {
      userId: string;
      email: string;
    };

    return {
      userId: decoded.userId as UserId,
      email: decoded.email,
    };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}
