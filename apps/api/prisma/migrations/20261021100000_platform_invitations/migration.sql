CREATE TABLE platform_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMP(3) NOT NULL,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP(3),
  revoked_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX platform_invitations_email_created_idx
  ON platform_invitations (lower(email), created_at DESC);

CREATE UNIQUE INDEX platform_invitations_one_pending_email_idx
  ON platform_invitations (lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
