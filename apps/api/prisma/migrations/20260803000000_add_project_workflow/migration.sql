ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(30) NOT NULL DEFAULT 'INTAKE',
  ADD COLUMN IF NOT EXISTS intake_received_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS triage_owner_id UUID,
  ADD COLUMN IF NOT EXISTS mentor_id UUID,
  ADD COLUMN IF NOT EXISTS workflow_decision VARCHAR(30),
  ADD COLUMN IF NOT EXISTS workflow_decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS paused_reason TEXT;

UPDATE projects
SET workflow_stage = CASE
  WHEN status = 'ON_HOLD' OR maturity_stage = 'ON_HOLD' THEN 'PAUSED'
  WHEN status = 'COMPLETED' OR maturity_stage = 'COMPLETED' THEN 'CLOSURE'
  WHEN maturity_stage = 'ACTIVE' OR status = 'ACTIVE' THEN 'EXECUTION'
  WHEN maturity_stage = 'PLANNED' THEN 'PREPARATION'
  WHEN maturity_stage = 'FORMALIZED' THEN 'VALIDATION'
  WHEN maturity_stage = 'DRAFT' THEN 'DIAGNOSIS'
  ELSE 'INTAKE'
END
WHERE workflow_stage = 'INTAKE';

UPDATE projects
SET intake_received_at = created_at
WHERE intake_received_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_workspace_workflow_stage_idx
  ON projects(workspace_id, workflow_stage);
CREATE INDEX IF NOT EXISTS projects_next_review_at_idx
  ON projects(next_review_at);

CREATE TABLE IF NOT EXISTS project_workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage VARCHAR(30),
  to_stage VARCHAR(30) NOT NULL,
  decision VARCHAR(30),
  reason TEXT,
  actor_id UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS project_workflow_history_project_created_idx
  ON project_workflow_history(project_id, created_at DESC);
