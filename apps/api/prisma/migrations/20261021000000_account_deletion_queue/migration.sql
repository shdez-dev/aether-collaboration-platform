ALTER TABLE users ADD COLUMN deletion_requested_at TIMESTAMP(3);

CREATE TABLE account_deletion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  requested_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP(3),
  next_run_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  step INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  CONSTRAINT account_deletion_jobs_status_check CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'))
);

CREATE INDEX account_deletion_jobs_next_run_at_requested_at_idx
  ON account_deletion_jobs (next_run_at, requested_at);
