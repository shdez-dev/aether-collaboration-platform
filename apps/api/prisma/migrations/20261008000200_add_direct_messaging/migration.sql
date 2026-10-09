CREATE TABLE direct_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CONSTRAINT direct_connections_pair_order CHECK (user_a_id < user_b_id),
  CONSTRAINT direct_connections_requester CHECK (requested_by_id IN (user_a_id, user_b_id)),
  CONSTRAINT direct_connections_status CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  CONSTRAINT direct_connections_pair_key UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX direct_connections_user_b_status_idx ON direct_connections (user_b_id, status);

CREATE TABLE direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  CONSTRAINT direct_conversations_pair_order CHECK (user_a_id < user_b_id),
  CONSTRAINT direct_conversations_pair_key UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX direct_conversations_user_b_idx ON direct_conversations (user_b_id);

CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES direct_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body VARCHAR(4000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  read_at TIMESTAMPTZ,
  CONSTRAINT direct_messages_body_check CHECK (length(trim(body)) BETWEEN 1 AND 4000)
);
CREATE INDEX direct_messages_conversation_created_idx ON direct_messages (conversation_id, created_at DESC);
CREATE INDEX direct_messages_expires_idx ON direct_messages (expires_at);
