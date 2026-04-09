// apps/api/src/lib/db.ts

import { Pool, QueryResult, QueryResultRow } from 'pg';

function getSslConfig(): object | undefined {
  const url = process.env.DATABASE_URL || '';
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction || url.includes('sslmode=require')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
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
