CREATE TABLE project_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deliverable_id UUID NOT NULL REFERENCES project_deliverables(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(1000),
  acceptance_criteria VARCHAR(2000) NOT NULL,
  requirement_type VARCHAR(24) NOT NULL DEFAULT 'FUNCTIONAL'
    CHECK (requirement_type IN ('FUNCTIONAL', 'NON_FUNCTIONAL', 'CONSTRAINT')),
  priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status VARCHAR(20) NOT NULL DEFAULT 'DEFINED'
    CHECK (status IN ('DEFINED', 'IN_PROGRESS', 'VERIFIED', 'BLOCKED')),
  verification_method VARCHAR(500),
  evidence VARCHAR(2000),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX project_requirements_project_deliverable_position_idx
  ON project_requirements (project_id, deliverable_id, position);

CREATE TABLE project_requirement_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES project_requirements(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_requirement_cards_requirement_card_key UNIQUE (requirement_id, card_id)
);

CREATE INDEX project_requirement_cards_project_card_idx
  ON project_requirement_cards (project_id, card_id);
