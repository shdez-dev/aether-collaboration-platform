-- Migration: Add created_by column to lists table
-- Date: 2026-03-05
-- Description: Adds created_by column to track who created each list

-- Add created_by column
ALTER TABLE lists 
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add foreign key constraint
ALTER TABLE lists 
ADD CONSTRAINT IF NOT EXISTS fk_lists_creator 
FOREIGN KEY (created_by) REFERENCES users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lists_created_by ON lists(created_by);
