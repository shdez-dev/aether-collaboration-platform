-- Project-level risk register with inherent and residual 5x5 assessments.
DO $$ BEGIN
  CREATE TYPE "ProjectRiskStatus" AS ENUM ('OPEN', 'MITIGATING', 'ACCEPTED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE project_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  probability INTEGER NOT NULL,
  impact INTEGER NOT NULL,
  residual_probability INTEGER,
  residual_impact INTEGER,
  mitigation_plan TEXT NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status "ProjectRiskStatus" NOT NULL DEFAULT 'OPEN'::"ProjectRiskStatus",
  next_review_at DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_risks_probability_range_check CHECK (probability BETWEEN 1 AND 5),
  CONSTRAINT project_risks_impact_range_check CHECK (impact BETWEEN 1 AND 5),
  CONSTRAINT project_risks_residual_probability_range_check CHECK (residual_probability IS NULL OR residual_probability BETWEEN 1 AND 5),
  CONSTRAINT project_risks_residual_impact_range_check CHECK (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 5),
  CONSTRAINT project_risks_title_not_empty_check CHECK (length(btrim(title)) > 0),
  CONSTRAINT project_risks_mitigation_not_empty_check CHECK (length(btrim(mitigation_plan)) > 0)
);

CREATE INDEX project_risks_project_status_updated_idx
  ON project_risks(project_id, status, updated_at DESC);
CREATE INDEX project_risks_owner_status_idx
  ON project_risks(owner_id, status);

CREATE OR REPLACE FUNCTION set_project_risk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_risks_set_updated_at
BEFORE UPDATE ON project_risks
FOR EACH ROW EXECUTE FUNCTION set_project_risk_updated_at();
