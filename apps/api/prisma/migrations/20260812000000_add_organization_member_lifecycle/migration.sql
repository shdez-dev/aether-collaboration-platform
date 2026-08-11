-- Organization membership lifecycle. A workspace owner is not automatically
-- the owner of the account that contains it.

-- Normalize historic organizations before enforcing a single account owner.
INSERT INTO organization_members (id, organization_id, user_id, role)
SELECT uuid_generate_v4(), o.id, o.owner_user_id, 'OWNER'::"OrganizationMemberRole"
FROM organizations o
WHERE o.owner_user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'OWNER'::"OrganizationMemberRole";

UPDATE organization_members om
SET role = 'ADMIN'::"OrganizationMemberRole"
FROM organizations o
WHERE om.organization_id = o.id
  AND om.role = 'OWNER'::"OrganizationMemberRole"
  AND (o.owner_user_id IS NULL OR om.user_id <> o.owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_single_owner_idx
  ON organization_members (organization_id)
  WHERE role = 'OWNER'::"OrganizationMemberRole";

CREATE OR REPLACE FUNCTION sync_workspace_member_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_members (id, organization_id, user_id, role)
  SELECT uuid_generate_v4(), w.organization_id, NEW.user_id,
         'MEMBER'::"OrganizationMemberRole"
  FROM workspaces w WHERE w.id = NEW.workspace_id
  ON CONFLICT (organization_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_organization_member_owner_membership()
RETURNS TRIGGER AS $$
DECLARE
  checked_organization_id UUID;
  owner_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    checked_organization_id := OLD.organization_id;
  ELSE
    checked_organization_id := NEW.organization_id;
  END IF;
  SELECT owner_user_id INTO owner_id FROM organizations WHERE id = checked_organization_id;
  IF owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = checked_organization_id
      AND user_id = owner_id
      AND role = 'OWNER'::"OrganizationMemberRole"
  ) THEN
    RAISE EXCEPTION 'Organization owner must remain an OWNER member';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_members_validate_owner ON organization_members;
CREATE CONSTRAINT TRIGGER organization_members_validate_owner
AFTER INSERT OR UPDATE OR DELETE ON organization_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_organization_member_owner_membership();

CREATE OR REPLACE FUNCTION validate_organization_owner_reference()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  SELECT owner_user_id INTO owner_id FROM organizations WHERE id = NEW.id;
  IF owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = NEW.id
      AND user_id = owner_id
      AND role = 'OWNER'::"OrganizationMemberRole"
  ) THEN
    RAISE EXCEPTION 'Organization owner must remain an OWNER member';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_validate_owner ON organizations;
CREATE CONSTRAINT TRIGGER organizations_validate_owner
AFTER INSERT OR UPDATE OF owner_user_id ON organizations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_organization_owner_reference();

CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role "OrganizationMemberRole" NOT NULL DEFAULT 'MEMBER'::"OrganizationMemberRole",
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMP(3) NOT NULL,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP(3),
  revoked_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT organization_invitations_role_not_owner CHECK (role <> 'OWNER'::"OrganizationMemberRole")
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_status_idx
  ON organization_invitations (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS organization_invitations_email_status_idx
  ON organization_invitations (lower(email), created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_one_pending_email_idx
  ON organization_invitations (organization_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS organization_access_revocations (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS organization_access_revocations_user_idx
  ON organization_access_revocations (user_id);
