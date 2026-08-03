ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS initiative_team_id UUID;

CREATE INDEX IF NOT EXISTS workspaces_initiative_team_id_idx
  ON workspaces(initiative_team_id);
