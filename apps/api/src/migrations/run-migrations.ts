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
      // Migration 000: Base schema (idempotent - safe to run on existing DBs)
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          event_type VARCHAR(100) NOT NULL,
          payload JSONB NOT NULL,
          user_id UUID NOT NULL,
          timestamp BIGINT NOT NULL,
          version INTEGER NOT NULL,
          vector_clock JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
        CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          avatar VARCHAR(500),
          bio TEXT,
          position VARCHAR(255),
          timezone VARCHAR(100) DEFAULT 'UTC',
          language VARCHAR(10) DEFAULT 'es',
          phone VARCHAR(50),
          location VARCHAR(255),
          email_verified BOOLEAN NOT NULL DEFAULT FALSE,
          email_verification_token VARCHAR(255),
          email_verification_expires TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token);

        CREATE TABLE IF NOT EXISTS user_preferences (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID UNIQUE NOT NULL,
          theme VARCHAR(20) DEFAULT 'dark',
          email_notifications BOOLEAN DEFAULT TRUE,
          push_notifications BOOLEAN DEFAULT TRUE,
          in_app_notifications BOOLEAN DEFAULT TRUE,
          notification_frequency VARCHAR(20) DEFAULT 'realtime',
          compact_mode BOOLEAN DEFAULT FALSE,
          show_archived BOOLEAN DEFAULT FALSE,
          default_board_view VARCHAR(20) DEFAULT 'kanban',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

        CREATE TABLE IF NOT EXISTS workspaces (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          owner_id UUID NOT NULL,
          icon VARCHAR(500),
          color VARCHAR(50),
          archived BOOLEAN NOT NULL DEFAULT FALSE,
          archived_at TIMESTAMP WITH TIME ZONE,
          visibility VARCHAR(20) NOT NULL DEFAULT 'private',
          invite_token VARCHAR(100) UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS workspace_members (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID NOT NULL,
          user_id UUID NOT NULL,
          role VARCHAR(20) NOT NULL,
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_workspace_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          CONSTRAINT fk_workspace_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT unique_workspace_user UNIQUE(workspace_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS boards (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          position INTEGER NOT NULL,
          archived BOOLEAN DEFAULT FALSE,
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_boards_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          CONSTRAINT fk_boards_creator FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS lists (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          board_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          position INTEGER NOT NULL,
          created_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_lists_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          CONSTRAINT fk_lists_creator FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS cards (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          list_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          position INTEGER NOT NULL,
          start_date TIMESTAMP WITH TIME ZONE,
          due_date TIMESTAMP WITH TIME ZONE,
          priority VARCHAR(20),
          completed BOOLEAN DEFAULT FALSE NOT NULL,
          completed_at TIMESTAMP WITH TIME ZONE,
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_cards_list FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
          CONSTRAINT fk_cards_creator FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS labels (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          color VARCHAR(50) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_labels_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL,
          socket_id VARCHAR(255) NOT NULL UNIQUE,
          board_id UUID,
          workspace_id UUID,
          connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          disconnected_at TIMESTAMP WITH TIME ZONE,
          CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_session_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL,
          CONSTRAINT fk_session_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS board_sprints (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          board_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          goal TEXT,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')),
          position INTEGER NOT NULL DEFAULT 0,
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_board_sprints_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          CONSTRAINT fk_board_sprints_created_by FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS board_milestones (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          board_id UUID NOT NULL,
          sprint_id UUID,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          date DATE NOT NULL,
          color VARCHAR(7) NOT NULL DEFAULT '#f59e0b',
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_board_milestones_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          CONSTRAINT fk_board_milestones_sprint FOREIGN KEY (sprint_id) REFERENCES board_sprints(id) ON DELETE SET NULL,
          CONSTRAINT fk_board_milestones_created_by FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sprint_cards (
          sprint_id UUID NOT NULL,
          card_id UUID NOT NULL,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          added_by UUID NOT NULL,
          CONSTRAINT pk_sprint_cards PRIMARY KEY (sprint_id, card_id),
          CONSTRAINT fk_sprint_cards_sprint FOREIGN KEY (sprint_id) REFERENCES board_sprints(id) ON DELETE CASCADE,
          CONSTRAINT fk_sprint_cards_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
          CONSTRAINT fk_sprint_cards_added_by FOREIGN KEY (added_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS user_favorite_contacts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          favorite_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, favorite_user_id),
          CHECK (user_id != favorite_user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_boards_workspace ON boards(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id);
        CREATE INDEX IF NOT EXISTS idx_lists_created_by ON lists(created_by);
        CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
        CREATE INDEX IF NOT EXISTS idx_cards_completed ON cards(completed);
        CREATE INDEX IF NOT EXISTS idx_labels_workspace ON labels(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_board ON user_sessions(board_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_socket ON user_sessions(socket_id);
        CREATE INDEX IF NOT EXISTS idx_board_sprints_board ON board_sprints(board_id);
        CREATE INDEX IF NOT EXISTS idx_board_milestones_board ON board_milestones(board_id);
        CREATE INDEX IF NOT EXISTS idx_sprint_cards_sprint ON sprint_cards(sprint_id);
        CREATE INDEX IF NOT EXISTS idx_sprint_cards_card ON sprint_cards(card_id);
        CREATE INDEX IF NOT EXISTS idx_user_favorite_contacts_user_id ON user_favorite_contacts(user_id);

        CREATE OR REPLACE FUNCTION update_users_updated_at()
        RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_update_users_timestamp ON users;
        CREATE TRIGGER trigger_update_users_timestamp
          BEFORE UPDATE ON users FOR EACH ROW
          WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION update_users_updated_at();

        CREATE OR REPLACE FUNCTION create_default_user_preferences()
        RETURNS TRIGGER AS $$ BEGIN INSERT INTO user_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING; RETURN NEW; END; $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS trigger_create_user_preferences ON users;
        CREATE TRIGGER trigger_create_user_preferences
          AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_default_user_preferences();
      `);

      console.log('  ✓ Migration 000: Base schema');

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

      // Migration 008: Add completed fields to cards and create card_members / card_labels tables
      await client.query(`
        ALTER TABLE cards
        ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;

        ALTER TABLE cards
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

        CREATE TABLE IF NOT EXISTS card_members (
          card_id UUID NOT NULL,
          user_id UUID NOT NULL,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (card_id, user_id),
          CONSTRAINT fk_cm_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
          CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS card_labels (
          card_id UUID NOT NULL,
          label_id UUID NOT NULL,
          PRIMARY KEY (card_id, label_id),
          CONSTRAINT fk_cl_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
          CONSTRAINT fk_cl_label FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
        );
      `);

      console.log('  ✓ Migration 008: Add completed to cards, create card_members and card_labels');

      // Migration 009: Create notifications table
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL,
          type VARCHAR(100) NOT NULL,
          title VARCHAR(500) NOT NULL,
          message TEXT NOT NULL,
          data JSONB NOT NULL DEFAULT '{}',
          read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
      `);

      console.log('  ✓ Migration 009: Create notifications table');

      // Migration 010: Create documents, document_permissions and document_comments tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          workspace_id UUID NOT NULL,
          title VARCHAR(500) NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          yjs_state BYTEA,
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_doc_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          CONSTRAINT fk_doc_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);

        CREATE TABLE IF NOT EXISTS document_permissions (
          document_id UUID NOT NULL,
          user_id UUID NOT NULL,
          permission VARCHAR(20) NOT NULL DEFAULT 'VIEW',
          PRIMARY KEY (document_id, user_id),
          CONSTRAINT fk_dp_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
          CONSTRAINT fk_dp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS document_comments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          document_id UUID NOT NULL,
          user_id UUID NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_dc_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
          CONSTRAINT fk_dc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_doc_comments_document ON document_comments(document_id);

        CREATE TABLE IF NOT EXISTS document_versions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          document_id UUID NOT NULL,
          yjs_state BYTEA,
          metadata JSONB NOT NULL DEFAULT '{}',
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_dv_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
          CONSTRAINT fk_dv_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_doc_versions_document ON document_versions(document_id);
      `);

      console.log('  ✓ Migration 010: Create documents, document_permissions and document_comments tables');

      // Migration 011: Create remaining tables (comments, sprints, milestones, activity, favorites)
      await client.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          card_id UUID NOT NULL,
          user_id UUID NOT NULL,
          content TEXT NOT NULL,
          mentions UUID[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_comment_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
          CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id);

        CREATE TABLE IF NOT EXISTS board_sprints (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          board_id UUID NOT NULL,
          name VARCHAR(255) NOT NULL,
          goal TEXT,
          start_date TIMESTAMP WITH TIME ZONE,
          end_date TIMESTAMP WITH TIME ZONE,
          status VARCHAR(50) NOT NULL DEFAULT 'planning',
          position INTEGER NOT NULL DEFAULT 0,
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_sprint_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          CONSTRAINT fk_sprint_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_sprints_board ON board_sprints(board_id);

        CREATE TABLE IF NOT EXISTS sprint_cards (
          sprint_id UUID NOT NULL,
          card_id UUID NOT NULL,
          added_by UUID NOT NULL,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (sprint_id, card_id),
          CONSTRAINT fk_sc_sprint FOREIGN KEY (sprint_id) REFERENCES board_sprints(id) ON DELETE CASCADE,
          CONSTRAINT fk_sc_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS board_milestones (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          board_id UUID NOT NULL,
          sprint_id UUID,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          date TIMESTAMP WITH TIME ZONE NOT NULL,
          color VARCHAR(50),
          created_by UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_milestone_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          CONSTRAINT fk_milestone_sprint FOREIGN KEY (sprint_id) REFERENCES board_sprints(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_milestones_board ON board_milestones(board_id);

        CREATE TABLE IF NOT EXISTS user_activity_log (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL,
          activity_type VARCHAR(100) NOT NULL,
          metadata JSONB NOT NULL DEFAULT '{}',
          board_id UUID,
          workspace_id UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_ual_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ual_user ON user_activity_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_ual_workspace ON user_activity_log(workspace_id);

        CREATE TABLE IF NOT EXISTS user_favorite_contacts (
          user_id UUID NOT NULL,
          favorite_user_id UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, favorite_user_id),
          CONSTRAINT fk_ufc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT fk_ufc_favorite FOREIGN KEY (favorite_user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);

      console.log('  ✓ Migration 011: Create comments, sprints, milestones, activity log and favorite contacts tables');

      // Migration 012: Add password reset columns to users
      await client.query(`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
          ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;
      `);
      console.log('  ✓ Migration 012: Add password_reset_token and password_reset_expires to users');

      console.log('✅ All migrations completed successfully');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
