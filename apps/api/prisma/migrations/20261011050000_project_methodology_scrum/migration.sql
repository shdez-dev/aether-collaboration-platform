ALTER TABLE projects ADD COLUMN methodology VARCHAR(20) NOT NULL DEFAULT 'NONE';

CREATE TABLE project_methodology_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER')),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, user_id)
);

CREATE INDEX project_methodology_assignments_user_id_idx ON project_methodology_assignments(user_id);
