// apps/api/src/lib/db.ts

import { Pool, QueryResult, QueryResultRow } from 'pg';

function getSslConfig(): object | undefined {
  const url = process.env.DATABASE_URL || '';
  const isProduction = process.env.NODE_ENV === 'production';
  const needsSsl = isProduction || url.includes('sslmode=require');

  if (!needsSsl) return undefined;

  // Si se provee el certificado CA del proveedor (PEM en DB_CA_CERT, o ruta en
  // DB_CA_CERT_PATH), se verifica la cadena TLS de forma estricta — esto evita
  // ataques MITM sobre la conexión a la base de datos.
  const caPem = process.env.DB_CA_CERT;
  const caPath = process.env.DB_CA_CERT_PATH;
  let ca: string | undefined = caPem;
  if (!ca && caPath) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ca = require('fs').readFileSync(caPath, 'utf-8');
    } catch {
      ca = undefined;
    }
  }

  if (ca) {
    return { ca, rejectUnauthorized: true };
  }

  // Permite forzar verificación estricta aun sin CA explícito (CA del sistema).
  if (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true') {
    return { rejectUnauthorized: true };
  }

  // Fallback compatible con Postgres gestionado (Render/Railway) que usa
  // certificados autofirmados. Define DB_CA_CERT para endurecer la verificación.
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: getSslConfig(),
});

// Test de conexión
pool.on('connect', () => {});

pool.on('error', (err) => {});

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

/**
 * Execute a query with parameterized values
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return await pool.query<T>(text, params);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  return await pool.connect();
}
