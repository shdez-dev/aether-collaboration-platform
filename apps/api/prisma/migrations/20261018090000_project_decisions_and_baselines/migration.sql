CREATE TABLE project_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  context TEXT,
  outcome TEXT NOT NULL,
  rationale TEXT NOT NULL,
  decision_date DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255) NOT NULL,
  supersedes_id UUID REFERENCES project_decisions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_decisions_project_supersedes_key UNIQUE (project_id, supersedes_id)
);

CREATE INDEX project_decisions_project_decision_date_idx
  ON project_decisions (project_id, decision_date DESC, created_at DESC);

CREATE TABLE project_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  scope TEXT NOT NULL,
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,
  effort_value NUMERIC(12, 2) NOT NULL CHECK (effort_value > 0),
  effort_unit VARCHAR(20) NOT NULL CHECK (effort_unit IN ('HOURS', 'DAYS', 'STORY_POINTS')),
  change_reason TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_baselines_project_version_key UNIQUE (project_id, version),
  CONSTRAINT project_baselines_date_order_check CHECK (target_date >= start_date)
);

CREATE INDEX project_baselines_project_current_idx
  ON project_baselines (project_id, is_current, version DESC);

CREATE UNIQUE INDEX project_baselines_one_current_per_project_idx
  ON project_baselines (project_id)
  WHERE is_current = TRUE;
