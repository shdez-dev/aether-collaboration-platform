CREATE TABLE user_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'NEW',
  reviewed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_reports_different_users CHECK (reporter_user_id <> reported_user_id),
  CONSTRAINT user_reports_reason_check CHECK (reason IN ('HARASSMENT', 'SPAM', 'IMPERSONATION', 'INAPPROPRIATE_CONTENT', 'OTHER')),
  CONSTRAINT user_reports_status_check CHECK (status IN ('NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'))
);

CREATE INDEX user_reports_status_created_at_idx ON user_reports (status, created_at DESC);
CREATE INDEX user_reports_reporter_created_at_idx ON user_reports (reporter_user_id, created_at DESC);
CREATE INDEX user_reports_reported_created_at_idx ON user_reports (reported_user_id, created_at DESC);
CREATE UNIQUE INDEX user_reports_one_open_pair_idx ON user_reports (reporter_user_id, reported_user_id)
  WHERE status IN ('NEW', 'IN_REVIEW');
