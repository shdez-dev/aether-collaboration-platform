-- Operational data for the institutional initiative workflow.
ALTER TYPE "InitiativeParticipantRole" ADD VALUE IF NOT EXISTS 'PROJECT_LEAD';
ALTER TYPE "InitiativeParticipantRole" ADD VALUE IF NOT EXISTS 'COLLABORATOR';

ALTER TABLE "workspace_institutional_settings"
  ADD COLUMN IF NOT EXISTS "triage_criteria" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "review_cadence_days" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "required_initiative_fields" JSONB NOT NULL DEFAULT '["title", "problemStatement", "proposedNextStep"]'::jsonb;

ALTER TABLE "initiatives"
  ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "evidence" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "triage_owner_id" UUID,
  ADD COLUMN IF NOT EXISTS "mentor_id" UUID;

DO $$ BEGIN
  ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_triage_owner_id_fkey"
    FOREIGN KEY ("triage_owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_mentor_id_fkey"
    FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "initiatives_triage_owner_id_idx" ON "initiatives"("triage_owner_id");
CREATE INDEX IF NOT EXISTS "initiatives_mentor_id_idx" ON "initiatives"("mentor_id");

-- The history cannot be rewritten during an initiative lifecycle. Deletion is
-- intentionally left to the parent foreign-key cascade when a workspace is
-- removed, so an administrative workspace deletion cannot be blocked.
CREATE OR REPLACE FUNCTION prevent_initiative_workflow_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'initiative workflow history is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS initiative_workflow_history_immutable ON "initiative_workflow_history";
CREATE TRIGGER initiative_workflow_history_immutable
  BEFORE UPDATE ON "initiative_workflow_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_initiative_workflow_history_mutation();
