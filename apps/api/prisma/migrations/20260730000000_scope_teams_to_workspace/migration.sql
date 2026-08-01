-- Teams are operational workspace resources, not global user resources.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Preserve existing records: prefer a workspace already reached through a
-- project assignment, then a workspace owned by the team creator.
UPDATE teams t
SET workspace_id = COALESCE(
  (SELECT p.workspace_id FROM project_teams pt JOIN projects p ON p.id = pt.project_id WHERE pt.team_id = t.id LIMIT 1),
  (SELECT w.id FROM workspaces w WHERE w.owner_id = t.created_by ORDER BY w.created_at LIMIT 1)
)
WHERE t.workspace_id IS NULL;

-- Teams without an inferable workspace cannot safely be kept global.
DELETE FROM teams WHERE workspace_id IS NULL;

ALTER TABLE teams ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE teams ADD CONSTRAINT teams_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS teams_workspace_id_idx ON teams(workspace_id);
