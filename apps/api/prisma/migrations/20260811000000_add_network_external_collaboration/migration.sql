-- Explicit, revocable access for collaborators outside a workspace.
DO $$ BEGIN CREATE TYPE "NetworkProgramType" AS ENUM ('CALL', 'INCUBATOR', 'CHALLENGE', 'FUND', 'MENTORSHIP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NetworkExternalRole" AS ENUM ('MENTOR', 'EVALUATOR', 'SPONSOR', 'PARTNER', 'REQUESTER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NetworkResourceType" AS ENUM ('INITIATIVE', 'DOCUMENT', 'PROJECT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE network_programs ADD COLUMN IF NOT EXISTS type "NetworkProgramType" NOT NULL DEFAULT 'CALL';

CREATE TABLE IF NOT EXISTS network_external_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  program_id UUID REFERENCES network_programs(id) ON DELETE SET NULL, email VARCHAR(255) NOT NULL,
  role "NetworkExternalRole" NOT NULL, resource_type "NetworkResourceType" NOT NULL, resource_id UUID NOT NULL,
  permission VARCHAR(20) NOT NULL DEFAULT 'VIEW', token VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL, expires_at TIMESTAMP(3), revoked_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS network_external_invitations_email_status_idx ON network_external_invitations(email, status);
CREATE INDEX IF NOT EXISTS network_external_invitations_network_status_idx ON network_external_invitations(network_id, status);

CREATE TABLE IF NOT EXISTS network_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  program_id UUID REFERENCES network_programs(id) ON DELETE SET NULL, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role "NetworkExternalRole" NOT NULL, resource_type "NetworkResourceType" NOT NULL, resource_id UUID NOT NULL,
  permission VARCHAR(20) NOT NULL DEFAULT 'VIEW', granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP(3), revoked_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT network_access_grants_scope_key UNIQUE(network_id, user_id, resource_type, resource_id)
);
CREATE INDEX IF NOT EXISTS network_access_grants_user_resource_idx ON network_access_grants(user_id, resource_type, resource_id);

CREATE TABLE IF NOT EXISTS network_evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), program_id UUID NOT NULL REFERENCES network_programs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, description TEXT, max_score INTEGER NOT NULL DEFAULT 5, position INTEGER NOT NULL DEFAULT 0, required BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS network_evaluation_criteria_program_position_idx ON network_evaluation_criteria(program_id, position);

CREATE TABLE IF NOT EXISTS initiative_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES network_programs(id) ON DELETE CASCADE, evaluator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation VARCHAR(30), comments TEXT, conflict_declared BOOLEAN NOT NULL DEFAULT false, conflict_details TEXT,
  submitted_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT initiative_evaluations_initiative_evaluator_key UNIQUE(initiative_id, evaluator_id)
);
CREATE INDEX IF NOT EXISTS initiative_evaluations_program_idx ON initiative_evaluations(program_id);
CREATE TABLE IF NOT EXISTS initiative_evaluation_scores (
  evaluation_id UUID NOT NULL REFERENCES initiative_evaluations(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES network_evaluation_criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL, comment TEXT, PRIMARY KEY(evaluation_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS network_access_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, resource_type "NetworkResourceType" NOT NULL, resource_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS network_access_audits_network_created_idx ON network_access_audits(network_id, created_at DESC);
CREATE INDEX IF NOT EXISTS network_access_audits_user_created_idx ON network_access_audits(user_id, created_at DESC);
