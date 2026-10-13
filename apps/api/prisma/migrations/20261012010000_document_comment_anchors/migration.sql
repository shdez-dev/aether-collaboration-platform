ALTER TABLE document_comments
  ADD COLUMN IF NOT EXISTS position JSONB NOT NULL DEFAULT '{"from":0,"to":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS parent_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'document_comments_parent_id_fkey'
      AND conrelid = 'document_comments'::regclass
  ) THEN
    ALTER TABLE document_comments
      ADD CONSTRAINT document_comments_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES document_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS document_comments_parent_id_idx
  ON document_comments(parent_id);
