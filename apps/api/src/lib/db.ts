// apps/api/src/lib/db.ts

import { Pool, QueryResult, QueryResultRow, types } from 'pg';
import { getDatabaseSslConfig } from './databaseSsl';

// PostgreSQL TIMESTAMP columns in this schema contain UTC clock values. pg's
// default parser treats them as local server time, shifting them by the server
// timezone (three hours in America/Santiago) before they reach the client.
types.setTypeParser(types.builtins.TIMESTAMP, (value: string) =>
  new Date(`${value.replace(' ', 'T')}Z`)
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c timezone=UTC',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: getDatabaseSslConfig(),
});

// Test de conexión
pool.on('connect', () => {});

pool.on('error', (err) => {
  console.error('[database] idle client error:', err);
});

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
