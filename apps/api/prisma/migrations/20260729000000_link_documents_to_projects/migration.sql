-- Project-owned operational documents. Workspace-level documents remain valid
-- with a NULL project_id (templates, policies and shared reference material).
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "project_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_project_id_fkey'
  ) THEN
    ALTER TABLE "documents"
      ADD CONSTRAINT "documents_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "documents_project_id_idx" ON "documents"("project_id");
