-- Migration: Add Email Verification and Password Reset functionality
-- Date: 2026-02-24
-- Description: Adds email verification and password reset token fields to users table

-- Add email verification fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;

-- Add password reset fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

-- Comment on columns
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Token for email verification (expires in 24 hours)';
COMMENT ON COLUMN users.email_verification_expires IS 'Expiration timestamp for email verification token';
COMMENT ON COLUMN users.password_reset_token IS 'Token for password reset (expires in 1 hour)';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiration timestamp for password reset token';

-- For existing users, mark them as verified (they registered before this feature)
UPDATE users
SET email_verified = TRUE
WHERE email_verified = FALSE;

COMMIT;
