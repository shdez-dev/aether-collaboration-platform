// apps/api/src/lib/db.ts

import { Pool, QueryResult, QueryResultRow } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 30, // Aumentado para manejar más conexiones concurrentes en tests
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Aumentado de 2s a 10s para tests e2e
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
