CREATE TABLE "initiative_content_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "initiative_id" UUID NOT NULL,
  "actor_id" UUID,
  "changes" JSONB NOT NULL CHECK (jsonb_typeof("changes") = 'object'),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "initiative_content_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "initiative_content_history_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("id") ON DELETE CASCADE,
  CONSTRAINT "initiative_content_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "initiative_content_history_initiative_created_idx"
  ON "initiative_content_history"("initiative_id", "created_at" DESC, "id" DESC);

CREATE FUNCTION prevent_initiative_content_history_mutation()
RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'initiative content history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initiative_content_history_immutable
  BEFORE UPDATE OR DELETE ON "initiative_content_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_initiative_content_history_mutation();

ALTER TABLE "initiative_workflow_history"
  ADD COLUMN "triage_assessment" JSONB,
  ADD COLUMN "next_review_at" TIMESTAMP(3);
