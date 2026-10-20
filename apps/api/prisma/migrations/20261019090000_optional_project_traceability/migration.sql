ALTER TABLE projects
  ADD COLUMN advanced_traceability BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing projects already use the traceability views. Preserve their current
-- experience while making the add-on opt-in for projects created from now on.
UPDATE projects SET advanced_traceability = TRUE;
