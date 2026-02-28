-- Migration: Add start_date to cards table
-- Run this on existing databases to add card start date support

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_cards_start_date ON cards(start_date);
CREATE INDEX IF NOT EXISTS idx_cards_dates ON cards(start_date, due_date);
