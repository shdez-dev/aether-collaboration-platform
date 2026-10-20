CREATE TABLE project_origin_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  origin_type VARCHAR(20) NOT NULL CHECK (origin_type IN ('DIRECT', 'INITIATIVE', 'LEGACY')),
  source_initiative_id UUID,
  source_title VARCHAR(500) NOT NULL,
  source_description TEXT,
  problem_statement TEXT,
  impacted_people TEXT,
  problem_impact TEXT,
  impacted_count INTEGER,
  expected_outcome TEXT,
  proposed_solution TEXT,
  differentiation TEXT,
  captured_by UUID REFERENCES users(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_reconstructed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX project_origin_snapshots_initiative_idx
  ON project_origin_snapshots (source_initiative_id);

-- Older projects did not keep a frozen origin record. Preserve their current
-- context as a reconstructed legacy reference instead of presenting it as a
-- contemporaneous snapshot.
INSERT INTO project_origin_snapshots (
  project_id, origin_type, source_initiative_id, source_title, source_description,
  problem_statement, impacted_people, problem_impact, impacted_count,
  expected_outcome, proposed_solution, differentiation, captured_by, captured_at, is_reconstructed
)
SELECT p.id,
       CASE WHEN p.source_initiative_id IS NULL THEN 'LEGACY' ELSE 'INITIATIVE' END,
       p.source_initiative_id,
       COALESCE(i.title, p.name),
       COALESCE(i.description, p.description),
       COALESCE(i.problem_statement, p.problem_statement),
       COALESCE(i.impacted_people, p.impacted_people),
       COALESCE(i.problem_impact, p.problem_impact),
       COALESCE(i.impacted_count, p.impacted_count),
       COALESCE(i.expected_outcome, p.expected_outcome),
       COALESCE(i.proposed_solution, p.proposed_solution),
       COALESCE(i.differentiation, p.differentiation),
       NULL,
       CURRENT_TIMESTAMP,
       TRUE
  FROM projects p
  LEFT JOIN initiatives i ON i.id = p.source_initiative_id;

CREATE TABLE project_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  origin_snapshot_id UUID NOT NULL REFERENCES project_origin_snapshots(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  statement VARCHAR(2000) NOT NULL,
  success_metric VARCHAR(160),
  target_value NUMERIC(12, 2),
  unit VARCHAR(40),
  change_reason VARCHAR(1500),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_objectives_project_version_key UNIQUE (project_id, version)
);

CREATE INDEX project_objectives_project_current_idx
  ON project_objectives (project_id, is_current, version DESC);
CREATE UNIQUE INDEX project_objectives_one_current_per_project_idx
  ON project_objectives (project_id) WHERE is_current = TRUE;

-- Start from the project's stated expected outcome. Teams can refine it into
-- a measurable objective from the traceability screen.
INSERT INTO project_objectives (project_id, origin_snapshot_id, statement, created_by)
SELECT p.id, os.id,
       LEFT(COALESCE(NULLIF(BTRIM(p.product_goal), ''), NULLIF(BTRIM(p.expected_outcome), ''), p.name), 2000), NULL
  FROM projects p JOIN project_origin_snapshots os ON os.project_id = p.id;

CREATE TABLE project_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES project_objectives(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(1000),
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'DONE', 'AT_RISK')),
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_deliverables_project_name_key UNIQUE (project_id, name)
);

CREATE INDEX project_deliverables_project_position_idx
  ON project_deliverables (project_id, position);

-- Existing Scrum epics already represent deliverable-sized outcomes. Carry
-- them into the shared traceability chain so their linked cards remain visible.
INSERT INTO project_deliverables (project_id, objective_id, name, description, status, position, created_by)
SELECT e.project_id, o.id, LEFT(e.name, 160), LEFT(e.description, 1000), 'PLANNED', e.position, e.created_by
  FROM project_epics e
  JOIN project_objectives o ON o.project_id = e.project_id;

CREATE TABLE project_deliverable_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deliverable_id UUID NOT NULL REFERENCES project_deliverables(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_deliverable_cards_deliverable_card_key UNIQUE (deliverable_id, card_id)
);

CREATE INDEX project_deliverable_cards_project_card_idx
  ON project_deliverable_cards (project_id, card_id);

INSERT INTO project_deliverable_cards (project_id, deliverable_id, card_id)
SELECT e.project_id, d.id, ec.card_id
  FROM project_epic_cards ec
  JOIN project_epics e ON e.id = ec.epic_id AND e.project_id = ec.project_id
  JOIN project_deliverables d ON d.project_id = e.project_id AND d.name = LEFT(e.name, 160)
ON CONFLICT (deliverable_id, card_id) DO NOTHING;

ALTER TABLE project_milestones
  ADD COLUMN deliverable_id UUID REFERENCES project_deliverables(id) ON DELETE SET NULL;

CREATE INDEX project_milestones_deliverable_idx
  ON project_milestones (deliverable_id);

CREATE TABLE project_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES project_objectives(id) ON DELETE CASCADE,
  deliverable_id UUID REFERENCES project_deliverables(id) ON DELETE SET NULL,
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  metric_name VARCHAR(160) NOT NULL,
  target_value NUMERIC(12, 2),
  actual_value NUMERIC(12, 2) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  evidence VARCHAR(2000),
  measured_at DATE NOT NULL,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_by_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX project_outcomes_project_measured_idx
  ON project_outcomes (project_id, measured_at DESC, created_at DESC);
CREATE INDEX project_outcomes_objective_measured_idx
  ON project_outcomes (objective_id, measured_at DESC);
