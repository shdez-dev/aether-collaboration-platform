/*
 * Railway's original database was created by the legacy SQL runner, before
 * Prisma migrations were introduced. On that existing schema, Prisma needs a
 * one-time baseline before it can apply later migrations safely.
 */
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const schema = 'apps/api/prisma/schema.prisma';
const legacyMigrations = [
  '20260409185347_init',
  '20260422000000_add_projects',
  '20260422000001_refactor_projects',
  '20260625000000_add_milestone_to_cards',
  '20260625000001_add_buffer_days_to_cards',
  '20260625000002_add_project_members',
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to migrate the database');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        to_regclass('public._prisma_migrations') IS NOT NULL AS has_migration_history,
        to_regclass('public.workspaces') IS NOT NULL AS has_legacy_schema
    `);
    const { has_migration_history: hasHistory, has_legacy_schema: hasLegacySchema } = result.rows[0];
    if (hasHistory || !hasLegacySchema) return;

    console.log('Baselining legacy Railway schema for Prisma migrations...');
    for (const migration of legacyMigrations) {
      const command = spawnSync(
        './apps/api/node_modules/.bin/prisma',
        ['migrate', 'resolve', '--applied', migration, '--schema', schema],
        { env: process.env, stdio: 'inherit' },
      );
      if (command.status !== 0) process.exit(command.status ?? 1);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Unable to baseline Prisma migrations:', error);
  process.exit(1);
});
