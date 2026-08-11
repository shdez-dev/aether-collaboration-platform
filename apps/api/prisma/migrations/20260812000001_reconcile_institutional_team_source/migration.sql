-- workspace_institutional_settings is the canonical home for institutional
-- configuration. Preserve values that only existed in the legacy column.
INSERT INTO workspace_institutional_settings (workspace_id, initiative_team_id, intake_enabled, created_at, updated_at)
SELECT w.id, w.initiative_team_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM workspaces w
WHERE w.initiative_team_id IS NOT NULL
ON CONFLICT (workspace_id) DO UPDATE
SET initiative_team_id = COALESCE(workspace_institutional_settings.initiative_team_id, EXCLUDED.initiative_team_id),
    updated_at = CURRENT_TIMESTAMP;
