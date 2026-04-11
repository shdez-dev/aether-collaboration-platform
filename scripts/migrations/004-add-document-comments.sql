-- Migration 004: Add document_comments table
-- Run this against the production Railway Postgres if the table is missing

CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL,
  content TEXT NOT NULL,
  position JSONB NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL,
  parent_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_comments_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_comments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_comments_parent FOREIGN KEY (parent_id) REFERENCES document_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_created_by ON document_comments(created_by);
CREATE INDEX IF NOT EXISTS idx_document_comments_parent ON document_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_document_comments_document_open
  ON document_comments(document_id, created_at ASC)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_document_comments_roots
  ON document_comments(document_id, created_at ASC)
  WHERE parent_id IS NULL;

CREATE OR REPLACE FUNCTION update_document_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_document_comment_timestamp ON document_comments;

CREATE TRIGGER trigger_update_document_comment_timestamp
  BEFORE UPDATE ON document_comments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_document_comment_updated_at();
