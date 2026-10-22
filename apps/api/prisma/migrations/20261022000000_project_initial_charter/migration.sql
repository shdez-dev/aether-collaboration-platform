ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "expected_deliverables" TEXT,
  ADD COLUMN IF NOT EXISTS "scope_inclusions" TEXT,
  ADD COLUMN IF NOT EXISTS "scope_exclusions" TEXT,
  ADD COLUMN IF NOT EXISTS "project_constraints" TEXT;
