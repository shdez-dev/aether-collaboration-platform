ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "impacted_people" TEXT,
  ADD COLUMN IF NOT EXISTS "problem_impact" TEXT,
  ADD COLUMN IF NOT EXISTS "impacted_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "expected_outcome" TEXT,
  ADD COLUMN IF NOT EXISTS "proposed_solution" TEXT,
  ADD COLUMN IF NOT EXISTS "differentiation" TEXT;

ALTER TABLE "initiatives"
  ADD COLUMN IF NOT EXISTS "impacted_people" TEXT,
  ADD COLUMN IF NOT EXISTS "problem_impact" TEXT,
  ADD COLUMN IF NOT EXISTS "impacted_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "expected_outcome" TEXT,
  ADD COLUMN IF NOT EXISTS "proposed_solution" TEXT,
  ADD COLUMN IF NOT EXISTS "differentiation" TEXT;

ALTER TABLE "workspace_institutional_settings"
  ALTER COLUMN "required_initiative_fields" SET DEFAULT '["title", "description", "problemStatement", "impactedPeople", "problemImpact", "impactedCount", "expectedOutcome", "proposedSolution", "differentiation"]'::jsonb;

UPDATE "workspace_institutional_settings"
SET "required_initiative_fields" = '["title", "description", "problemStatement", "impactedPeople", "problemImpact", "impactedCount", "expectedOutcome", "proposedSolution", "differentiation"]'::jsonb
WHERE "required_initiative_fields" = '["title", "problemStatement", "proposedNextStep"]'::jsonb;
