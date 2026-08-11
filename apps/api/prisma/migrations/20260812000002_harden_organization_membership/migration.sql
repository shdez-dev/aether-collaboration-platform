-- Harden existing account data without modifying the already-applied lifecycle
-- migration. This order is safe even when legacy workspace ownership produced
-- more than one organization OWNER.
UPDATE organization_members om
SET role = 'ADMIN'::"OrganizationMemberRole"
FROM organizations o
WHERE om.organization_id = o.id
  AND om.role = 'OWNER'::"OrganizationMemberRole"
  AND (o.owner_user_id IS NULL OR om.user_id <> o.owner_user_id);

INSERT INTO organization_members (id, organization_id, user_id, role)
SELECT uuid_generate_v4(), o.id, o.owner_user_id, 'OWNER'::"OrganizationMemberRole"
FROM organizations o
WHERE o.owner_user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO UPDATE
SET role = 'OWNER'::"OrganizationMemberRole";

-- The lifecycle migration installs deferred ownership constraint triggers.
-- Flush their pending events before DDL: PostgreSQL refuses CREATE INDEX on a
-- table with pending trigger events in the current transaction.
SET CONSTRAINTS organization_members_validate_owner, organizations_validate_owner IMMEDIATE;

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_single_owner_idx
  ON organization_members (organization_id)
  WHERE role = 'OWNER'::"OrganizationMemberRole";

-- This boundary guard covers all current and future paths that insert a
-- workspace member, including direct project/team operations.
CREATE OR REPLACE FUNCTION prevent_revoked_workspace_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM workspaces w
      JOIN organization_access_revocations r ON r.organization_id = w.organization_id
     WHERE w.id = NEW.workspace_id AND r.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Organization access has been revoked for this user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_members_prevent_revoked_access ON workspace_members;
CREATE TRIGGER workspace_members_prevent_revoked_access
BEFORE INSERT OR UPDATE OF workspace_id, user_id ON workspace_members
FOR EACH ROW EXECUTE FUNCTION prevent_revoked_workspace_membership();
