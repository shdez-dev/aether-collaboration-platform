-- Workspace membership is scoped by an organization account. A workspace
-- invite may grant access only after the person has been admitted to the
-- organization through its explicit lifecycle.
CREATE OR REPLACE FUNCTION sync_workspace_member_organization()
RETURNS TRIGGER AS $$
DECLARE
  account_id UUID;
BEGIN
  SELECT organization_id INTO account_id FROM workspaces WHERE id = NEW.workspace_id;
  IF account_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = account_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Organization membership is required before workspace access'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
