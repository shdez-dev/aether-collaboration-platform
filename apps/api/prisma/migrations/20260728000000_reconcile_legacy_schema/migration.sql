-- Reconcile the pre-Prisma SQL schema with the tables used by the current API.
--
-- The first Prisma migrations were generated from only a subset of the legacy
-- runner. This migration is intentionally idempotent: on Railway every table
-- already exists and is left intact; on a clean database it supplies the
-- legacy tables before the later incremental migrations run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Columns that existed in the legacy tables but were not represented by the
-- original Prisma migration snapshots.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_planner_credits INTEGER NOT NULL DEFAULT 3;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS invite_token VARCHAR(100);

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT '#3b82f6';

ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP(3);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS maturity_stage VARCHAR(20) NOT NULL DEFAULT 'IDEA',
  ADD COLUMN IF NOT EXISTS problem_statement TEXT,
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS formalized_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS applied_standard_id UUID,
  ADD COLUMN IF NOT EXISTS applied_standard_version INTEGER,
  ADD COLUMN IF NOT EXISTS standard_applied_at TIMESTAMP(3);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS actor_id TEXT,
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS subject_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS subject_id UUID,
  ADD COLUMN IF NOT EXISTS subject_name TEXT,
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS board_id UUID,
  ADD COLUMN IF NOT EXISTS list_id UUID,
  ADD COLUMN IF NOT EXISTS card_id UUID,
  ADD COLUMN IF NOT EXISTS document_id UUID,
  ADD COLUMN IF NOT EXISTS delta JSONB,
  ADD COLUMN IF NOT EXISTS correlation_id UUID;

-- Identity and workspace support tables.
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  socket_id VARCHAR(255) NOT NULL UNIQUE,
  board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  connected_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_ping TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_board_id_idx ON user_sessions(board_id);
CREATE INDEX IF NOT EXISTS user_sessions_socket_id_idx ON user_sessions(socket_id);

CREATE TABLE IF NOT EXISTS user_favorite_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  favorite_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT user_favorite_contacts_user_favorite_key UNIQUE (user_id, favorite_user_id)
);
CREATE INDEX IF NOT EXISTS user_favorite_contacts_user_id_idx ON user_favorite_contacts(user_id);

CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  board_id UUID,
  workspace_id UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS user_activity_log_user_id_idx ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS user_activity_log_workspace_id_idx ON user_activity_log(workspace_id);

CREATE TABLE IF NOT EXISTS workspace_project_standards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  definition_json JSONB NOT NULL,
  created_by UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS workspace_project_standards_workspace_id_idx ON workspace_project_standards(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_project_standards_workspace_active_idx ON workspace_project_standards(workspace_id, is_active);

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT workspace_invitations_workspace_user_key UNIQUE (workspace_id, invited_user_id)
);
CREATE INDEX IF NOT EXISTS workspace_invitations_invited_user_idx ON workspace_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS workspace_invitations_workspace_idx ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invitations_status_idx ON workspace_invitations(status);

CREATE TABLE IF NOT EXISTS workspace_github_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  github_token TEXT NOT NULL,
  repos TEXT[] NOT NULL DEFAULT '{}',
  webhook_secret TEXT NOT NULL,
  github_login VARCHAR(255),
  connected_by UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Card collaboration and notification tables.
CREATE TABLE IF NOT EXISTS card_members (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS card_labels (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

CREATE TABLE IF NOT EXISTS card_checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS card_checklist_items_card_idx ON card_checklist_items(card_id);
CREATE INDEX IF NOT EXISTS card_checklist_items_card_position_idx ON card_checklist_items(card_id, position);

CREATE TABLE IF NOT EXISTS card_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocking_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  blocked_card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT card_dependencies_pair_key UNIQUE (blocking_card_id, blocked_card_id)
);
CREATE INDEX IF NOT EXISTS card_dependencies_blocking_idx ON card_dependencies(blocking_card_id);
CREATE INDEX IF NOT EXISTS card_dependencies_blocked_idx ON card_dependencies(blocked_card_id);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS comments_card_id_idx ON comments(card_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read);

-- Documents are created here without project_id; the next migration owns that
-- column and its foreign key so both old and clean databases follow the same
-- ordered history.
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  yjs_state BYTEA,
  created_by UUID NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS documents_workspace_id_idx ON documents(workspace_id);

CREATE TABLE IF NOT EXISTS document_permissions (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  permission VARCHAR(20) NOT NULL DEFAULT 'VIEW',
  PRIMARY KEY (document_id, user_id)
);

CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS document_comments_document_id_idx ON document_comments(document_id);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  yjs_state BYTEA,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS document_versions_document_id_idx ON document_versions(document_id);

-- Planning and cadence.
CREATE TABLE IF NOT EXISTS board_sprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS board_sprints_board_id_idx ON board_sprints(board_id);

CREATE TABLE IF NOT EXISTS sprint_cards (
  sprint_id UUID NOT NULL REFERENCES board_sprints(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  added_by UUID NOT NULL,
  added_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (sprint_id, card_id)
);

CREATE TABLE IF NOT EXISTS board_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES board_sprints(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  color VARCHAR(7) DEFAULT '#f59e0b',
  created_by UUID NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS board_milestones_board_id_idx ON board_milestones(board_id);

CREATE TABLE IF NOT EXISTS standups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  yesterday_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  today_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT standups_user_workspace_date_key UNIQUE (user_id, workspace_id, date)
);
CREATE INDEX IF NOT EXISTS standups_user_id_idx ON standups(user_id);
CREATE INDEX IF NOT EXISTS standups_workspace_date_idx ON standups(workspace_id, date);

-- Teams are deliberately created without workspace_id constraints here; the
-- next migration scopes legacy teams and preserves unresolved records.
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50) DEFAULT '#3b82f6',
  icon TEXT,
  lead_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS teams_created_by_idx ON teams(created_by);
CREATE INDEX IF NOT EXISTS teams_lead_id_idx ON teams(lead_id);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT team_members_team_user_key UNIQUE (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members(team_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON team_members(user_id);

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT team_invitations_team_user_key UNIQUE (team_id, invited_user_id)
);
CREATE INDEX IF NOT EXISTS team_invitations_invited_user_idx ON team_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS team_invitations_team_id_idx ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS team_invitations_status_idx ON team_invitations(status);

-- Project relations that are referenced by the current controllers.
CREATE TABLE IF NOT EXISTS project_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID,
  CONSTRAINT project_teams_project_team_key UNIQUE (project_id, team_id)
);
CREATE INDEX IF NOT EXISTS project_teams_project_id_idx ON project_teams(project_id);
CREATE INDEX IF NOT EXISTS project_teams_team_id_idx ON project_teams(team_id);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color VARCHAR(50) NOT NULL DEFAULT '#5ec5ff',
  type VARCHAR(20) NOT NULL DEFAULT 'personal',
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS calendar_events_created_by_idx ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS calendar_events_start_time_idx ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS calendar_events_workspace_idx ON calendar_events(workspace_id);
CREATE INDEX IF NOT EXISTS calendar_events_team_idx ON calendar_events(team_id);

CREATE TABLE IF NOT EXISTS calendar_event_attendees (
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS calendar_event_attendees_user_id_idx ON calendar_event_attendees(user_id);

CREATE TABLE IF NOT EXISTS ai_builder_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Plan',
  content TEXT NOT NULL DEFAULT '',
  used_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ai_builder_documents_user_id_idx ON ai_builder_documents(user_id);

-- Keep old event rows usable by the current event store naming without
-- assuming that every legacy deployment still has event_type.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'event_type'
  ) THEN
    UPDATE events SET type = COALESCE(type, event_type) WHERE type IS NULL;
  END IF;
END $$;
