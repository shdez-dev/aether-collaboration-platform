-- Account, workspace mode, institutional intake, portfolio and network.
-- This is additive and backfills every existing workspace into a personal
-- organization owned by its creator before making organization_id mandatory.

DO $$ BEGIN
  CREATE TYPE "OrganizationType" AS ENUM ('PERSONAL', 'COMPANY', 'INSTITUTION', 'NETWORK_OPERATOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'BILLING_ADMIN', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkspaceMode" AS ENUM ('PERSONAL', 'TEAM', 'INSTITUTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectOperationalRole" AS ENUM ('TRIAGE_COORDINATOR', 'MENTOR', 'PROJECT_LEAD', 'COLLABORATOR', 'REQUESTER', 'EVALUATOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InitiativeStage" AS ENUM ('SUBMITTED', 'TRIAGE', 'DIAGNOSIS', 'VALIDATION', 'APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InitiativeParticipantRole" AS ENUM ('REQUESTER', 'TRIAGE_COORDINATOR', 'MENTOR', 'EVALUATOR', 'SPONSOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NetworkOrganizationRole" AS ENUM ('HOST', 'PARTNER', 'SPONSOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NetworkMemberRole" AS ENUM ('ADMIN', 'MEMBER', 'MENTOR', 'EVALUATOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NetworkProgramStatus" AS ENUM ('DRAFT', 'OPEN', 'REVIEWING', 'CLOSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type "OrganizationType" NOT NULL DEFAULT 'PERSONAL',
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  billing_email VARCHAR(255),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_personal_owner_unique
  ON organizations(owner_user_id)
  WHERE type = 'PERSONAL'::"OrganizationType" AND owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS organizations_owner_user_id_idx ON organizations(owner_user_id);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role "OrganizationMemberRole" NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT organization_members_organization_user_key UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members(user_id);

-- Every existing user receives one personal account. It is also the safe
-- default account for subsequently created Personal or Team workspaces.
INSERT INTO organizations (id, name, type, owner_user_id, created_at, updated_at)
SELECT uuid_generate_v4(),
       COALESCE(NULLIF(TRIM(u.name), ''), 'Cuenta personal') || ' · Aether',
       'PERSONAL'::"OrganizationType", u.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o
  WHERE o.owner_user_id = u.id AND o.type = 'PERSONAL'::"OrganizationType"
);

INSERT INTO organization_members (id, organization_id, user_id, role)
SELECT uuid_generate_v4(), o.id, o.owner_user_id, 'OWNER'::"OrganizationMemberRole"
FROM organizations o
WHERE o.owner_user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'OWNER'::"OrganizationMemberRole";

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS operating_mode "WorkspaceMode" NOT NULL DEFAULT 'TEAM'::"WorkspaceMode";

UPDATE workspaces w
SET organization_id = o.id,
    operating_mode = CASE
      -- Project standards are available to every workspace today, so only the
      -- existing initiative-team signal is safe to infer as institutional.
      WHEN w.initiative_team_id IS NOT NULL THEN 'INSTITUTIONAL'::"WorkspaceMode"
      WHEN (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) <= 1
        THEN 'PERSONAL'::"WorkspaceMode"
      ELSE 'TEAM'::"WorkspaceMode"
    END
FROM organizations o
WHERE w.organization_id IS NULL
  AND o.owner_user_id = w.owner_id
  AND o.type = 'PERSONAL'::"OrganizationType";

-- Preserve any anomalous legacy workspace whose owner no longer exists.
INSERT INTO organizations (id, name, type, created_at, updated_at)
SELECT uuid_generate_v4(), 'Espacios recuperados · Aether', 'COMPANY'::"OrganizationType", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM workspaces WHERE organization_id IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE name = 'Espacios recuperados · Aether' AND owner_user_id IS NULL
  );

UPDATE workspaces
SET organization_id = (
  SELECT id FROM organizations
  WHERE name = 'Espacios recuperados · Aether' AND owner_user_id IS NULL
  ORDER BY created_at ASC LIMIT 1
)
WHERE organization_id IS NULL;

ALTER TABLE workspaces ALTER COLUMN organization_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE workspaces ADD CONSTRAINT workspaces_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS workspaces_organization_id_idx ON workspaces(organization_id);
CREATE INDEX IF NOT EXISTS workspaces_organization_mode_idx ON workspaces(organization_id, operating_mode);

INSERT INTO organization_members (id, organization_id, user_id, role)
SELECT uuid_generate_v4(), w.organization_id, wm.user_id, 'MEMBER'::"OrganizationMemberRole"
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- A person added to a workspace must also belong to its account. Keeping this
-- at the database boundary covers invitations, team flows and future APIs.
CREATE OR REPLACE FUNCTION sync_workspace_member_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_members (id, organization_id, user_id, role)
  SELECT uuid_generate_v4(), w.organization_id, NEW.user_id,
         CASE WHEN NEW.role = 'OWNER' THEN 'OWNER'::"OrganizationMemberRole"
              ELSE 'MEMBER'::"OrganizationMemberRole" END
  FROM workspaces w WHERE w.id = NEW.workspace_id
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_members_sync_organization ON workspace_members;
CREATE TRIGGER workspace_members_sync_organization
AFTER INSERT ON workspace_members
FOR EACH ROW EXECUTE FUNCTION sync_workspace_member_organization();

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code VARCHAR(100) NOT NULL,
  status "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
  provider VARCHAR(50),
  provider_customer_id VARCHAR(255),
  provider_subscription_id VARCHAR(255) UNIQUE,
  current_period_start TIMESTAMP(3),
  current_period_end TIMESTAMP(3),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subscriptions_organization_status_idx ON subscriptions(organization_id, status);

CREATE TABLE IF NOT EXISTS subscription_entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  capability VARCHAR(100) NOT NULL,
  limit_value INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT subscription_entitlements_subscription_capability_key UNIQUE (subscription_id, capability)
);

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS portfolios_organization_id_idx ON portfolios(organization_id);

CREATE TABLE IF NOT EXISTS workspace_institutional_settings (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  initiative_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  active_standard_id UUID REFERENCES workspace_project_standards(id) ON DELETE SET NULL,
  intake_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS workspace_institutional_settings_team_idx ON workspace_institutional_settings(initiative_team_id);
CREATE INDEX IF NOT EXISTS workspace_institutional_settings_standard_idx ON workspace_institutional_settings(active_standard_id);

INSERT INTO workspace_institutional_settings (workspace_id, initiative_team_id, active_standard_id, intake_enabled)
SELECT w.id,
       CASE WHEN EXISTS (SELECT 1 FROM teams t WHERE t.id = w.initiative_team_id AND t.workspace_id = w.id)
            THEN w.initiative_team_id ELSE NULL END,
       (
         SELECT s.id FROM workspace_project_standards s
         WHERE s.workspace_id = w.id AND s.is_active = true
         ORDER BY s.version DESC, s.updated_at DESC LIMIT 1
       ),
       true
FROM workspaces w
WHERE w.operating_mode = 'INSTITUTIONAL'::"WorkspaceMode"
ON CONFLICT (workspace_id) DO NOTHING;

-- PostgreSQL cannot express these same-workspace rules with simple foreign
-- keys. They prevent selecting a team or standard from another workspace.
CREATE OR REPLACE FUNCTION validate_workspace_institutional_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.initiative_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM teams t WHERE t.id = NEW.initiative_team_id AND t.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'initiative team must belong to the same workspace';
  END IF;

  IF NEW.active_standard_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM workspace_project_standards s WHERE s.id = NEW.active_standard_id AND s.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'active project standard must belong to the same workspace';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_institutional_settings_scope_check ON workspace_institutional_settings;
CREATE TRIGGER workspace_institutional_settings_scope_check
BEFORE INSERT OR UPDATE OF workspace_id, initiative_team_id, active_standard_id
ON workspace_institutional_settings
FOR EACH ROW EXECUTE FUNCTION validate_workspace_institutional_settings();

CREATE TABLE IF NOT EXISTS networks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS networks_owner_organization_id_idx ON networks(owner_organization_id);

CREATE TABLE IF NOT EXISTS network_organizations (
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role "NetworkOrganizationRole" NOT NULL DEFAULT 'PARTNER',
  joined_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (network_id, organization_id)
);
CREATE INDEX IF NOT EXISTS network_organizations_organization_id_idx ON network_organizations(organization_id);

CREATE TABLE IF NOT EXISTS network_members (
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role "NetworkMemberRole" NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (network_id, user_id)
);
CREATE INDEX IF NOT EXISTS network_members_user_id_idx ON network_members(user_id);

CREATE TABLE IF NOT EXISTS network_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  host_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status "NetworkProgramStatus" NOT NULL DEFAULT 'DRAFT',
  starts_at TIMESTAMP(3),
  ends_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS network_programs_network_status_idx ON network_programs(network_id, status);
CREATE INDEX IF NOT EXISTS network_programs_host_workspace_id_idx ON network_programs(host_workspace_id);

CREATE TABLE IF NOT EXISTS initiatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  network_program_id UUID REFERENCES network_programs(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  problem_statement TEXT,
  proposed_next_step TEXT,
  stage "InitiativeStage" NOT NULL DEFAULT 'SUBMITTED',
  decision VARCHAR(30),
  decision_reason TEXT,
  received_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_review_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS initiatives_workspace_stage_idx ON initiatives(workspace_id, stage);
CREATE INDEX IF NOT EXISTS initiatives_network_program_id_idx ON initiatives(network_program_id);
CREATE INDEX IF NOT EXISTS initiatives_submitted_by_idx ON initiatives(submitted_by);

CREATE TABLE IF NOT EXISTS initiative_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role "InitiativeParticipantRole" NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT initiative_participants_initiative_user_role_key UNIQUE (initiative_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS initiative_participants_user_id_idx ON initiative_participants(user_id);

CREATE TABLE IF NOT EXISTS initiative_workflow_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  from_stage "InitiativeStage",
  to_stage "InitiativeStage" NOT NULL,
  decision VARCHAR(30),
  reason TEXT,
  actor_id UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS initiative_workflow_history_initiative_created_idx
  ON initiative_workflow_history(initiative_id, created_at DESC);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_initiative_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS projects_source_initiative_id_key
  ON projects(source_initiative_id) WHERE source_initiative_id IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE projects ADD CONSTRAINT projects_source_initiative_id_fkey
    FOREIGN KEY (source_initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS project_role_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role "ProjectOperationalRole" NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID,
  assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP(3),
  CONSTRAINT project_role_assignments_project_user_role_key UNIQUE (project_id, user_id, role)
);
CREATE INDEX IF NOT EXISTS project_role_assignments_user_id_idx ON project_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS project_role_assignments_project_role_idx ON project_role_assignments(project_id, role);

-- Preserve the current single-owner fields while moving their responsibility
-- into the canonical multi-role table. The application will stop writing the
-- legacy columns in a later compatibility-removal release.
INSERT INTO project_role_assignments (id, project_id, user_id, role, is_primary, assigned_at)
SELECT uuid_generate_v4(), p.id, p.triage_owner_id, 'TRIAGE_COORDINATOR'::"ProjectOperationalRole", true, CURRENT_TIMESTAMP
FROM projects p
WHERE p.triage_owner_id IS NOT NULL
ON CONFLICT (project_id, user_id, role) DO NOTHING;

INSERT INTO project_role_assignments (id, project_id, user_id, role, is_primary, assigned_at)
SELECT uuid_generate_v4(), p.id, p.mentor_id, 'MENTOR'::"ProjectOperationalRole", true, CURRENT_TIMESTAMP
FROM projects p
WHERE p.mentor_id IS NOT NULL
ON CONFLICT (project_id, user_id, role) DO NOTHING;

CREATE TABLE IF NOT EXISTS portfolio_projects (
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  added_by UUID,
  added_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (portfolio_id, project_id)
);
CREATE INDEX IF NOT EXISTS portfolio_projects_project_id_idx ON portfolio_projects(project_id);

-- A formalized initiative cannot create a project in another workspace.
CREATE OR REPLACE FUNCTION validate_project_source_initiative()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source_initiative_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM initiatives i
    WHERE i.id = NEW.source_initiative_id AND i.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'source initiative must belong to the same workspace as its project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_source_initiative_scope_check ON projects;
CREATE TRIGGER projects_source_initiative_scope_check
BEFORE INSERT OR UPDATE OF source_initiative_id, workspace_id ON projects
FOR EACH ROW EXECUTE FUNCTION validate_project_source_initiative();
