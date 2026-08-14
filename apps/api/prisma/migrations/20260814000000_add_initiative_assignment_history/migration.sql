-- Append-only operational audit for institutional responsibilities.
CREATE TABLE IF NOT EXISTS "initiative_assignment_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "initiative_id" UUID NOT NULL REFERENCES "initiatives"("id") ON DELETE CASCADE,
  "subject_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "role" "InitiativeParticipantRole" NOT NULL,
  "action" VARCHAR(20) NOT NULL CHECK ("action" IN ('ASSIGNED', 'REMOVED', 'REVOKED')),
  "actor_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "initiative_assignment_history_initiative_created_idx"
  ON "initiative_assignment_history"("initiative_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "initiative_assignment_history_subject_created_idx"
  ON "initiative_assignment_history"("subject_user_id", "created_at" DESC, "id" DESC);

CREATE OR REPLACE FUNCTION prevent_initiative_assignment_history_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'initiative assignment history is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS initiative_assignment_history_immutable ON "initiative_assignment_history";
CREATE TRIGGER initiative_assignment_history_immutable
  BEFORE UPDATE ON "initiative_assignment_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_initiative_assignment_history_mutation();

-- Supports the triage order with a deterministic tie breaker. This uses a
-- regular index because Prisma migrations run in a transaction.
CREATE INDEX IF NOT EXISTS "initiatives_triage_queue_idx"
  ON "initiatives"("workspace_id", ("priority" = 'URGENT') DESC, "next_review_at" ASC NULLS LAST, "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "initiative_participants_initiative_assigned_idx"
  ON "initiative_participants"("initiative_id", "assigned_at" ASC, "id" ASC);
