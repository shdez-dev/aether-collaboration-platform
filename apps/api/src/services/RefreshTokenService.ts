// apps/api/src/services/RefreshTokenService.ts
//
// Gestiona el ciclo de vida de los refresh tokens con rotación y revocación.
// La base de datos solo guarda el hash SHA-256 del token, nunca el token en claro,
// de modo que una fuga de lectura de la BD no permite reusar los tokens.

import crypto from 'crypto';
import { pool } from '../lib/db';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Calcula la fecha de expiración decodificando el `exp` del JWT (segundos). */
function expiryFromJwt(token: string): Date {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'));
    if (payload?.exp) return new Date(payload.exp * 1000);
  } catch {
    // ignore
  }
  // Fallback: 7 días
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export class RefreshTokenService {
  /** Registra un refresh token recién emitido (en login). */
  static async issue(userId: string, token: string): Promise<void> {
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO NOTHING`,
      [userId, hashToken(token), expiryFromJwt(token)]
    );
  }

  /**
   * Comprueba si un refresh token sigue siendo válido (existe, no revocado, no expirado).
   * Devuelve `'valid' | 'revoked' | 'unknown'`.
   *  - `revoked`: el token existe pero fue revocado → posible reuso de un token rotado.
   *  - `unknown`: el token no está en la allowlist (emitido antes de activar el store,
   *    o ya purgado) → se rechaza.
   */
  static async check(token: string): Promise<'valid' | 'revoked' | 'unknown'> {
    const r = await pool.query(
      `SELECT revoked, expires_at FROM refresh_tokens WHERE token_hash = $1`,
      [hashToken(token)]
    );
    if (r.rows.length === 0) return 'unknown';
    const row = r.rows[0];
    if (row.revoked) return 'revoked';
    if (new Date(row.expires_at) < new Date()) return 'unknown';
    return 'valid';
  }

  /**
   * Rota un token: marca el viejo como revocado y registra el nuevo.
   * Operación atómica para evitar condiciones de carrera.
   */
  static async rotate(userId: string, oldToken: string, newToken: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE refresh_tokens SET revoked = TRUE, replaced_by = $2 WHERE token_hash = $1`,
        [hashToken(oldToken), hashToken(newToken)]
      );
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (token_hash) DO NOTHING`,
        [userId, hashToken(newToken), expiryFromJwt(newToken)]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Revoca todos los refresh tokens activos de un usuario (logout / respuesta a reuso). */
  static async revokeAllForUser(userId: string): Promise<void> {
    await pool.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`,
      [userId]
    );
  }
}
