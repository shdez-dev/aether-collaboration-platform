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

      // Migration 003: Default language to Spanish
      await client.query(`
        ALTER TABLE users ALTER COLUMN language SET DEFAULT 'es';
        UPDATE users SET language = 'es' WHERE language = 'en' OR language IS NULL;
      `);

      console.log('  ✓ Migration 003: Default language set to Spanish');

      // Migration 004: Add start_date column to cards
      await client.query(`
        ALTER TABLE cards
        ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;
      `);

      console.log('  ✓ Migration 004: Add start_date to cards');

      // Migration 005: Create card_checklist_items table
      await client.query(`
        CREATE TABLE IF NOT EXISTS card_checklist_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          card_id UUID NOT NULL,
          title VARCHAR(500) NOT NULL,
          completed BOOLEAN DEFAULT FALSE NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          created_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_checklist_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_checklist_card ON card_checklist_items(card_id);
        CREATE INDEX IF NOT EXISTS idx_checklist_card_position ON card_checklist_items(card_id, position);
      `);

      console.log('  ✓ Migration 005: Create card_checklist_items table');

      // Migration 006: Create card_dependencies table
      await client.query(`
        CREATE TABLE IF NOT EXISTS card_dependencies (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          blocking_card_id UUID NOT NULL,
          blocked_card_id UUID NOT NULL,
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_dep_blocking FOREIGN KEY (blocking_card_id) REFERENCES cards(id) ON DELETE CASCADE,
          CONSTRAINT fk_dep_blocked FOREIGN KEY (blocked_card_id) REFERENCES cards(id) ON DELETE CASCADE,
          CONSTRAINT no_self_dep CHECK (blocking_card_id <> blocked_card_id),
          CONSTRAINT unique_dep UNIQUE (blocking_card_id, blocked_card_id)
        );
        CREATE INDEX IF NOT EXISTS idx_dep_blocking ON card_dependencies(blocking_card_id);
        CREATE INDEX IF NOT EXISTS idx_dep_blocked ON card_dependencies(blocked_card_id);
      `);

      console.log('  ✓ Migration 006: Create card_dependencies table');

      // Migration 007: Add archived columns to workspaces and boards
      await client.query(`
        ALTER TABLE workspaces
        ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

        ALTER TABLE workspaces
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

        ALTER TABLE boards
        ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
      `);

      console.log('  ✓ Migration 007: Add archived columns to workspaces and boards');
      console.log('✅ All migrations completed successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
