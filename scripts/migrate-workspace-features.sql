-- Migration: Workspace features (archive, visibility, invite token)
-- Run this on existing databases that were created before this migration.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS invite_token VARCHAR(100);

-- Unique constraint on invite_token (only if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_invite_token_key'
  ) THEN
    ALTER TABLE workspaces ADD CONSTRAINT workspaces_invite_token_key UNIQUE (invite_token);
  END IF;
END $$;

-- Index for filtering active (non-archived) workspaces
CREATE INDEX IF NOT EXISTS idx_workspaces_archived ON workspaces(archived);
CREATE INDEX IF NOT EXISTS idx_workspaces_visibility ON workspaces(visibility);
CREATE INDEX IF NOT EXISTS idx_workspaces_invite_token ON workspaces(invite_token);
