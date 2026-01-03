import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost', // Cambiado de 127.0.0.1 a localhost
  port: 5432,
  database: 'aether_dev',
  user: 'aether',
  password: 'aether_dev_password',
});

async function test() {
  try {
    const client = await pool.connect();
    console.log('✓ Connected');

    const result = await client.query('SELECT * FROM users LIMIT 1');
    console.log('✓ Query OK, rows:', result.rows.length);

    client.release();
    await pool.end();
  } catch (err) {
    console.error('✗ Error:', err);
  }
}

test();
