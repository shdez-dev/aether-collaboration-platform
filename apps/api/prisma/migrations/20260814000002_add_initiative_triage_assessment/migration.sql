-- Each initiative snapshots the triage criteria that governed its intake so
-- later configuration changes cannot rewrite the basis of a decision.
ALTER TABLE "initiatives"
  ADD COLUMN IF NOT EXISTS "triage_criteria_snapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "triage_assessment" JSONB NOT NULL DEFAULT '[]'::jsonb;
