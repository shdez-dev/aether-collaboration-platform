import { Pool } from 'pg';

// Debug: Ver qué valores se están leyendo
console.log('[DB] Config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? '***' : undefined,
});

// Todas las configuraciones vienen del .env
export const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'aether_dev',
  user: process.env.DB_USER || 'aether',
  password: process.env.DB_PASSWORD || 'aether_dev_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test de conexión
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  console.log('[DB] Pool has ended');
  process.exit(0);
});
