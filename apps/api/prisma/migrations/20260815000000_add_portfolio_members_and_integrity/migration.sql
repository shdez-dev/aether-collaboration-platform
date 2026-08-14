-- Hito 4: organization-scoped portfolios require explicit membership and may
-- only aggregate projects from workspaces owned by the same organization.

DO $$ BEGIN
  CREATE TYPE "PortfolioMemberRole" AS ENUM ('ADMIN', 'MANAGER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE portfolios
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS portfolio_members (
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role "PortfolioMemberRole" NOT NULL DEFAULT 'VIEWER'::"PortfolioMemberRole",
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (portfolio_id, user_id)
);

CREATE INDEX IF NOT EXISTS portfolios_organization_id_archived_at_idx
  ON portfolios (organization_id, archived_at);
CREATE INDEX IF NOT EXISTS portfolio_members_user_id_role_idx
  ON portfolio_members (user_id, role);
CREATE INDEX IF NOT EXISTS portfolio_projects_portfolio_id_added_at_idx
  ON portfolio_projects (portfolio_id, added_at DESC);

CREATE OR REPLACE FUNCTION set_portfolio_member_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_members_set_updated_at ON portfolio_members;
CREATE TRIGGER portfolio_members_set_updated_at
BEFORE UPDATE ON portfolio_members
FOR EACH ROW EXECUTE FUNCTION set_portfolio_member_updated_at();

-- A project is eligible only when its workspace and the portfolio share an
-- organization. Row locks make the check stable if a workspace is being moved
-- between organizations concurrently.
CREATE OR REPLACE FUNCTION validate_portfolio_project_organization()
RETURNS TRIGGER AS $$
DECLARE
  portfolio_organization_id UUID;
  project_organization_id UUID;
BEGIN
  SELECT p.organization_id
    INTO portfolio_organization_id
    FROM portfolios p
   WHERE p.id = NEW.portfolio_id
   FOR SHARE;

  SELECT w.organization_id
    INTO project_organization_id
    FROM projects p
    JOIN workspaces w ON w.id = p.workspace_id
   WHERE p.id = NEW.project_id
   FOR SHARE OF p, w;

  IF portfolio_organization_id IS NULL
     OR project_organization_id IS NULL
     OR portfolio_organization_id <> project_organization_id THEN
    RAISE EXCEPTION 'portfolio projects must belong to the portfolio organization'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_projects_organization_scope_check ON portfolio_projects;
CREATE TRIGGER portfolio_projects_organization_scope_check
BEFORE INSERT OR UPDATE OF portfolio_id, project_id ON portfolio_projects
FOR EACH ROW EXECUTE FUNCTION validate_portfolio_project_organization();

-- Portfolio membership is a narrower grant than organization membership. A
-- revoked account must never receive a new or changed portfolio role.
CREATE OR REPLACE FUNCTION validate_portfolio_member_organization_access()
RETURNS TRIGGER AS $$
DECLARE
  portfolio_organization_id UUID;
BEGIN
  SELECT p.organization_id
    INTO portfolio_organization_id
    FROM portfolios p
   WHERE p.id = NEW.portfolio_id
   FOR SHARE;

  IF portfolio_organization_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM organization_members om
     WHERE om.organization_id = portfolio_organization_id
       AND om.user_id = NEW.user_id
       AND NOT EXISTS (
         SELECT 1
           FROM organization_access_revocations r
          WHERE r.organization_id = om.organization_id
            AND r.user_id = om.user_id
       )
     FOR SHARE
  ) THEN
    RAISE EXCEPTION 'an active organization member is required for portfolio access'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_members_organization_access_check ON portfolio_members;
CREATE TRIGGER portfolio_members_organization_access_check
BEFORE INSERT OR UPDATE OF portfolio_id, user_id, role ON portfolio_members
FOR EACH ROW EXECUTE FUNCTION validate_portfolio_member_organization_access();
