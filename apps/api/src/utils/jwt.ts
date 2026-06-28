import jwt, { type Secret, type SignOptions, type Algorithm } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import type { UserId } from '@aether/types';

// Algoritmo fijo. Verificar con una allowlist explícita evita ataques de
// confusión de algoritmo (p. ej. forzar `none` o RS256 con la clave pública).
const JWT_ALGORITHM: Algorithm = 'HS256';

/**
 * Obtiene un secreto de forma perezosa (en tiempo de llamada, no de import) para
 * garantizar que las variables de entorno ya estén cargadas. Lanza si falta el
 * secreto en cualquier entorno que no sea de tests — nunca firma con un valor por
 * defecto inseguro.
 */
function getSecret(envName: 'JWT_SECRET' | 'REFRESH_TOKEN_SECRET', testFallback: string): Secret {
  const value = process.env[envName];
  if (value) return value;
  if (process.env.NODE_ENV === 'test') return testFallback;
  throw new Error(`${envName} no está configurado — se rechaza firmar/verificar tokens`);
}

const getAccessSecret = (): Secret =>
  getSecret('JWT_SECRET', 'test-secret-key-for-testing-only-min-32-chars');

const getRefreshSecret = (): Secret =>
  getSecret('REFRESH_TOKEN_SECRET', 'test-refresh-secret-key-for-testing-only-min-32-chars');

const JWT_EXPIRES_IN: SignOptions['expiresIn'] =
  (process.env.JWT_EXPIRES_IN as StringValue | undefined) ?? '1h';

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

  return jwt.sign(plainPayload, getAccessSecret(), {
    algorithm: JWT_ALGORITHM,
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

  return jwt.sign(plainPayload, getRefreshSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

/**
 * Verifica y decodifica un access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, getAccessSecret(), {
      algorithms: [JWT_ALGORITHM],
    }) as {
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
    const decoded = jwt.verify(token, getRefreshSecret(), {
      algorithms: [JWT_ALGORITHM],
    }) as {
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
