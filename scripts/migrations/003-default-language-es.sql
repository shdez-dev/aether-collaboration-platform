-- Migration: Change default language from 'en' to 'es'
-- Date: 2026-03-24
-- Description: Sets Spanish as the default language for new users and updates existing ones

ALTER TABLE users ALTER COLUMN language SET DEFAULT 'es';

UPDATE users SET language = 'es' WHERE language = 'en' OR language IS NULL;
