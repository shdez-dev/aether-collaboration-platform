-- Histories are append-only for application callers. Foreign-key cascades and
-- SET NULL actions execute through nested triggers, so they remain available
-- for controlled parent/user deletion and data-retention operations.
CREATE OR REPLACE FUNCTION prevent_initiative_workflow_history_mutation()
RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'initiative workflow history is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS initiative_workflow_history_immutable ON "initiative_workflow_history";
CREATE TRIGGER initiative_workflow_history_immutable
  BEFORE UPDATE OR DELETE ON "initiative_workflow_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_initiative_workflow_history_mutation();

CREATE OR REPLACE FUNCTION prevent_initiative_assignment_history_mutation()
RETURNS trigger AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'initiative assignment history is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS initiative_assignment_history_immutable ON "initiative_assignment_history";
CREATE TRIGGER initiative_assignment_history_immutable
  BEFORE UPDATE OR DELETE ON "initiative_assignment_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_initiative_assignment_history_mutation();
