// apps/api/src/migrations/run-migrations.ts
// Runs database migrations on startup

import { pool } from '../lib/db';
import fs from 'fs';
import path from 'path';

export async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    const client = await pool.connect();

    try {
      // Migration 001: Add email verification columns
      await client.query(`
        -- Add email_verified column (default FALSE for existing users)
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
        
        -- Add email_verification_token column
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
        
        -- Add email_verification_expires column
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;
        
        -- Create index for faster token lookups
        CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token);
      `);

      console.log('  ✓ Migration 001: Email verification columns');

      // Migration 002: Add created_by to lists table
      await client.query(`
        -- Add created_by column to lists
        ALTER TABLE lists 
        ADD COLUMN IF NOT EXISTS created_by UUID;
        
        -- Add foreign key constraint
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_lists_creator'
          ) THEN
            ALTER TABLE lists 
            ADD CONSTRAINT fk_lists_creator 
            FOREIGN KEY (created_by) REFERENCES users(id);
          END IF;
        END $$;
        
        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_lists_created_by ON lists(created_by);
      `);

      console.log('  ✓ Migration 002: Add created_by to lists');
      console.log('✅ All migrations completed successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
