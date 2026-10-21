CREATE TABLE project_document_profiles (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL DEFAULT 'GENERAL'
    CHECK (category IN ('GENERAL', 'DIRECTION', 'REQUIREMENTS', 'ARCHITECTURE', 'VERIFICATION', 'DELIVERY', 'OPERATIONS', 'METRICS')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX project_document_profiles_project_idx ON project_document_profiles(project_id, category);

CREATE TABLE project_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  document_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  document_title VARCHAR(500) NOT NULL,
  document_updated_at TIMESTAMPTZ NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id UUID,
  claim VARCHAR(1000) NOT NULL,
  excerpt VARCHAR(2000),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'VERIFIED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  CONSTRAINT project_evidence_target_check CHECK (
    (target_type IN ('PROJECT', 'OBJECTIVE') AND target_id IS NULL)
    OR (target_type IN ('DELIVERABLE', 'REQUIREMENT', 'OUTCOME', 'DECISION') AND target_id IS NOT NULL)
  )
);

CREATE INDEX project_evidence_links_project_target_idx
  ON project_evidence_links(project_id, target_type, target_id);
CREATE INDEX project_evidence_links_project_document_idx
  ON project_evidence_links(project_id, document_id);
