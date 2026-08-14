-- Hito 4: dated capacity planning and idempotent portfolio alerts.
-- These records are organization scoped. They do not grant project, workspace,
-- or portfolio access by themselves.

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

ALTER TABLE cards
  ADD CONSTRAINT cards_estimated_minutes_nonnegative_check
  CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0);

DO $$ BEGIN
  CREATE TYPE "PortfolioAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PortfolioAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organization_member_capacities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekly_available_minutes INTEGER NOT NULL,
  effective_from DATE NOT NULL,
  effective_until DATE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT organization_member_capacities_minutes_check
    CHECK (weekly_available_minutes >= 0 AND weekly_available_minutes <= 10080),
  CONSTRAINT organization_member_capacities_effective_range_check
    CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE IF NOT EXISTS project_capacity_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekly_minutes INTEGER NOT NULL,
  effective_from DATE NOT NULL,
  effective_until DATE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_capacity_allocations_minutes_check
    CHECK (weekly_minutes >= 0 AND weekly_minutes <= 10080),
  CONSTRAINT project_capacity_allocations_effective_range_check
    CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE IF NOT EXISTS portfolio_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  fingerprint VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  severity "PortfolioAlertSeverity" NOT NULL DEFAULT 'WARNING'::"PortfolioAlertSeverity",
  status "PortfolioAlertStatus" NOT NULL DEFAULT 'OPEN'::"PortfolioAlertStatus",
  title VARCHAR(500) NOT NULL,
  detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMP(3),
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP(3),
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portfolio_alerts_portfolio_fingerprint_key UNIQUE (portfolio_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS organization_member_capacities_organization_user_from_idx
  ON organization_member_capacities (organization_id, user_id, effective_from);
CREATE INDEX IF NOT EXISTS organization_member_capacities_organization_until_idx
  ON organization_member_capacities (organization_id, effective_until);
CREATE INDEX IF NOT EXISTS project_capacity_allocations_organization_user_from_idx
  ON project_capacity_allocations (organization_id, user_id, effective_from);
CREATE INDEX IF NOT EXISTS project_capacity_allocations_project_from_idx
  ON project_capacity_allocations (project_id, effective_from);
CREATE INDEX IF NOT EXISTS portfolio_alerts_portfolio_status_severity_idx
  ON portfolio_alerts (portfolio_id, status, severity);
CREATE INDEX IF NOT EXISTS portfolio_alerts_project_status_idx
  ON portfolio_alerts (project_id, status);

CREATE OR REPLACE FUNCTION set_portfolio_capacity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_member_capacities_set_updated_at ON organization_member_capacities;
CREATE TRIGGER organization_member_capacities_set_updated_at
BEFORE UPDATE ON organization_member_capacities
FOR EACH ROW EXECUTE FUNCTION set_portfolio_capacity_updated_at();

DROP TRIGGER IF EXISTS project_capacity_allocations_set_updated_at ON project_capacity_allocations;
CREATE TRIGGER project_capacity_allocations_set_updated_at
BEFORE UPDATE ON project_capacity_allocations
FOR EACH ROW EXECUTE FUNCTION set_portfolio_capacity_updated_at();

DROP TRIGGER IF EXISTS portfolio_alerts_set_updated_at ON portfolio_alerts;
CREATE TRIGGER portfolio_alerts_set_updated_at
BEFORE UPDATE ON portfolio_alerts
FOR EACH ROW EXECUTE FUNCTION set_portfolio_capacity_updated_at();

-- Keep membership checks in one function so both supply (availability) and
-- demand (allocation) use precisely the same active-member definition.
CREATE OR REPLACE FUNCTION assert_active_organization_member(
  target_organization_id UUID,
  target_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM 1
    FROM organization_members om
   WHERE om.organization_id = target_organization_id
     AND om.user_id = target_user_id
     AND NOT EXISTS (
       SELECT 1
         FROM organization_access_revocations r
        WHERE r.organization_id = om.organization_id
          AND r.user_id = om.user_id
     )
   FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'an active organization member is required for capacity data'
      USING ERRCODE = '42501';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_organization_member_capacity_scope()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM assert_active_organization_member(NEW.organization_id, NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_member_capacities_organization_access_check ON organization_member_capacities;
CREATE TRIGGER organization_member_capacities_organization_access_check
BEFORE INSERT OR UPDATE ON organization_member_capacities
FOR EACH ROW EXECUTE FUNCTION validate_organization_member_capacity_scope();

CREATE OR REPLACE FUNCTION validate_project_capacity_allocation_scope()
RETURNS TRIGGER AS $$
DECLARE
  project_organization_id UUID;
BEGIN
  SELECT w.organization_id
    INTO project_organization_id
    FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
   WHERE p.id = NEW.project_id
   FOR KEY SHARE OF p, w;

  IF project_organization_id IS NULL OR project_organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'capacity allocations must use the project organization'
      USING ERRCODE = '23514';
  END IF;

  PERFORM assert_active_organization_member(NEW.organization_id, NEW.user_id);
  PERFORM assert_active_organization_member(NEW.organization_id, NEW.assigned_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_capacity_allocations_organization_scope_check ON project_capacity_allocations;
CREATE TRIGGER project_capacity_allocations_organization_scope_check
BEFORE INSERT OR UPDATE ON project_capacity_allocations
FOR EACH ROW EXECUTE FUNCTION validate_project_capacity_allocation_scope();

CREATE OR REPLACE FUNCTION validate_portfolio_alert_integrity()
RETURNS TRIGGER AS $$
DECLARE
  portfolio_organization_id UUID;
BEGIN
  SELECT organization_id
    INTO portfolio_organization_id
    FROM portfolios
   WHERE id = NEW.portfolio_id
   FOR KEY SHARE;

  IF portfolio_organization_id IS NULL THEN
    RAISE EXCEPTION 'portfolio does not exist'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM portfolio_projects pp
     WHERE pp.portfolio_id = NEW.portfolio_id
       AND pp.project_id = NEW.project_id
     FOR KEY SHARE
  ) THEN
    RAISE EXCEPTION 'portfolio alerts can only reference projects in the portfolio'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'OPEN'::"PortfolioAlertStatus" THEN
    IF NEW.acknowledged_at IS NOT NULL OR NEW.acknowledged_by IS NOT NULL
       OR NEW.resolved_at IS NOT NULL OR NEW.resolved_by IS NOT NULL THEN
      RAISE EXCEPTION 'open portfolio alerts cannot have lifecycle actors or timestamps'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.status = 'ACKNOWLEDGED'::"PortfolioAlertStatus" THEN
    IF NEW.acknowledged_at IS NULL OR NEW.acknowledged_by IS NULL
       OR NEW.resolved_at IS NOT NULL OR NEW.resolved_by IS NOT NULL THEN
      RAISE EXCEPTION 'acknowledged portfolio alerts require acknowledgement only'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.status = 'RESOLVED'::"PortfolioAlertStatus" THEN
    IF NEW.resolved_at IS NULL OR NEW.resolved_by IS NULL THEN
      RAISE EXCEPTION 'resolved portfolio alerts require a resolver and timestamp'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM assert_active_organization_member(portfolio_organization_id, NEW.acknowledged_by);
  PERFORM assert_active_organization_member(portfolio_organization_id, NEW.resolved_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_alerts_integrity_check ON portfolio_alerts;
CREATE TRIGGER portfolio_alerts_integrity_check
BEFORE INSERT OR UPDATE ON portfolio_alerts
FOR EACH ROW EXECUTE FUNCTION validate_portfolio_alert_integrity();
