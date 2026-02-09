-- AETHER Database Schema
-- Manual migration equivalent to Prisma schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Event Store
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  user_id UUID NOT NULL,
  timestamp BIGINT NOT NULL,
  version INTEGER NOT NULL,
  vector_clock JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  icon VARCHAR(500),
  color VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_workspace_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_workspace_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_workspace_user UNIQUE(workspace_id, user_id)
);

-- Boards
CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  archived BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_boards_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_boards_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Lists
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lists_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  priority VARCHAR(20),
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cards_list FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_cards_creator FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
CREATE INDEX IF NOT EXISTS idx_cards_completed ON cards(completed);
CREATE INDEX IF NOT EXISTS idx_cards_completed_list ON cards(list_id, completed);

-- Labels
CREATE TABLE IF NOT EXISTS labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_labels_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_boards_workspace ON boards(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
CREATE INDEX IF NOT EXISTS idx_labels_workspace ON labels(workspace_id);

-- Card Members (relación many-to-many entre cards y users)
CREATE TABLE IF NOT EXISTS card_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL,
  user_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_card_members_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_card_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_card_member UNIQUE(card_id, user_id)
);

-- Card Labels (relación many-to-many entre cards y labels)
CREATE TABLE IF NOT EXISTS card_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL,
  label_id UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_card_labels_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_card_labels_label FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE,
  CONSTRAINT unique_card_label UNIQUE(card_id, label_id)
);

-- Indexes for card relations
CREATE INDEX IF NOT EXISTS idx_card_members_card ON card_members(card_id);
CREATE INDEX IF NOT EXISTS idx_card_members_user ON card_members(user_id);
CREATE INDEX IF NOT EXISTS idx_card_labels_card ON card_labels(card_id);
CREATE INDEX IF NOT EXISTS idx_card_labels_label ON card_labels(label_id);

-- MILESTONE 5: Sistema de Presencia y Tiempo Real
-- La mayoría de la presencia se maneja en Redis (ephemeral), 
-- pero guardamos logs para analytics

-- User Activity Log (para analytics y debugging)
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  board_id UUID,
  workspace_id UUID,
  activity_type VARCHAR(50) NOT NULL, -- 'joined', 'left', 'typing', 'moved_card', etc.
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- Indexes para queries de analytics
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_board ON user_activity_log(board_id);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON user_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity_log(activity_type);

-- User Sessions (para tracking de sesiones WebSocket)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  socket_id VARCHAR(255) NOT NULL UNIQUE,
  board_id UUID,
  workspace_id UUID,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_board ON user_sessions(board_id);
CREATE INDEX IF NOT EXISTS idx_sessions_socket ON user_sessions(socket_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(disconnected_at) WHERE disconnected_at IS NULL;

-- Update last_ping function (opcional - para mantener sessions actualizadas)
CREATE OR REPLACE FUNCTION update_session_ping()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_ping = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-actualizar last_ping en updates
CREATE TRIGGER trigger_update_session_ping
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_ping();

  -- MILESTONE 6: Sistema de Comentarios

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentions UUID[], -- Array de user IDs mencionados
  edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_card FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_comments_card ON comments(card_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);

-- Function para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  NEW.edited = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-actualizar updated_at en updates
CREATE TRIGGER trigger_update_comment_timestamp
  BEFORE UPDATE ON comments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_comment_updated_at();

  -- MILESTONE 6: Sistema de Notificaciones para Menciones

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'COMMENT_MENTION', 'CARD_ASSIGNED', 'CARD_DUE_SOON'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL, -- { cardId, commentId, authorName, etc. }
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;


-- Tabla principal de documentos
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '', -- Texto plano extraído para búsqueda
  yjs_state BYTEA, -- Estado binario serializado de Yjs
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_title_search ON documents USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING gin(to_tsvector('english', content));

-- Tabla de versiones del documento (snapshots para historial)
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL,
  yjs_state BYTEA NOT NULL, -- Snapshot del estado Yjs en ese momento
  metadata JSONB, -- { operationCount: number, author: string, timestamp: number, description?: string }
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_versions_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_versions_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para versiones
CREATE INDEX IF NOT EXISTS idx_document_versions_document ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(created_at DESC);

-- Tabla de comentarios en documentos
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL,
  content TEXT NOT NULL,
  position JSONB NOT NULL, -- { from: number, to: number } - rango de caracteres en el documento
  resolved BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL,
  parent_id UUID, -- Para threading (respuestas a comentarios)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_comments_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_comments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_comments_parent FOREIGN KEY (parent_id) REFERENCES document_comments(id) ON DELETE CASCADE
);

-- Índices para comentarios
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_created_by ON document_comments(created_by);
CREATE INDEX IF NOT EXISTS idx_document_comments_parent ON document_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_resolved ON document_comments(resolved);

-- Tabla de permisos específicos de documentos (opcional, por ahora heredan del workspace)
CREATE TABLE IF NOT EXISTS document_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL,
  user_id UUID,
  permission VARCHAR(20) NOT NULL CHECK (permission IN ('VIEW', 'COMMENT', 'EDIT')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_permissions_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_document_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_document_user_permission UNIQUE(document_id, user_id)
);

-- Índices para permisos
CREATE INDEX IF NOT EXISTS idx_document_permissions_document ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_permissions_user ON document_permissions(user_id);

-- Trigger para auto-actualizar updated_at en documents
CREATE OR REPLACE FUNCTION update_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_timestamp
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_document_updated_at();

-- Trigger para auto-actualizar updated_at en document_comments
CREATE TRIGGER trigger_update_document_comment_timestamp
  BEFORE UPDATE ON document_comments
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_document_updated_at();

-- Success message
SELECT 'Database schema created successfully!' as message;

