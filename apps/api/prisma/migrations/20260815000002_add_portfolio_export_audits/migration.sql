-- Hito 4: keep an immutable, minimal audit trail for directional exports.
-- The actual CSV is intentionally not persisted because it can contain live
-- project information and can be regenerated from the recorded filters.

CREATE TABLE IF NOT EXISTS portfolio_export_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portfolio_export_audits_row_count_check CHECK (row_count >= 0)
);

CREATE INDEX IF NOT EXISTS portfolio_export_audits_portfolio_created_at_idx
  ON portfolio_export_audits (portfolio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portfolio_export_audits_organization_created_at_idx
  ON portfolio_export_audits (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS portfolio_export_audits_exported_by_created_at_idx
  ON portfolio_export_audits (exported_by, created_at DESC);

CREATE OR REPLACE FUNCTION validate_portfolio_export_audit()
RETURNS TRIGGER AS $$
DECLARE
  portfolio_organization_id UUID;
BEGIN
  SELECT organization_id INTO portfolio_organization_id
    FROM portfolios WHERE id = NEW.portfolio_id FOR KEY SHARE;

  IF portfolio_organization_id IS NULL OR portfolio_organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'portfolio export audit organization must match the portfolio'
      USING ERRCODE = '23514';
  END IF;

  PERFORM assert_active_organization_member(NEW.organization_id, NEW.exported_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_export_audits_scope_check ON portfolio_export_audits;
CREATE TRIGGER portfolio_export_audits_scope_check
BEFORE INSERT ON portfolio_export_audits
FOR EACH ROW EXECUTE FUNCTION validate_portfolio_export_audit();

CREATE OR REPLACE FUNCTION prevent_portfolio_export_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Foreign-key cascades are legitimate lifecycle operations. Direct updates
  -- and deletes would compromise the audit trail and are rejected.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'portfolio export audits are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_export_audits_immutable ON portfolio_export_audits;
CREATE TRIGGER portfolio_export_audits_immutable
BEFORE UPDATE OR DELETE ON portfolio_export_audits
FOR EACH ROW EXECUTE FUNCTION prevent_portfolio_export_audit_mutation();
