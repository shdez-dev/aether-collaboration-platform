-- Migration: Add email verification columns to users table
-- Date: 2026-03-05
-- Description: Adds email_verified, email_verification_token, and email_verification_expires columns

-- Add email_verified column (default FALSE for existing users)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Add email_verification_token column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);

-- Add email_verification_expires column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token);

-- Optional: Set existing users as verified (uncomment if needed)
-- UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;
