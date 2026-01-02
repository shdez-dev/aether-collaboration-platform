-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create event_store schema
CREATE SCHEMA IF NOT EXISTS event_store;

-- Set search path
SET search_path TO public, event_store;
