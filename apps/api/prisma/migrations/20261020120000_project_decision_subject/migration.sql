ALTER TABLE project_decisions
  ADD COLUMN subject_type VARCHAR(20) NOT NULL DEFAULT 'PROJECT',
  ADD COLUMN subject_id UUID,
  ADD CONSTRAINT project_decisions_subject_check CHECK (
    (subject_type IN ('PROJECT', 'OBJECTIVE') AND subject_id IS NULL)
    OR (subject_type IN ('DELIVERABLE', 'OUTCOME') AND subject_id IS NOT NULL)
  );

CREATE INDEX project_decisions_project_subject_idx
  ON project_decisions (project_id, subject_type, subject_id);
