ALTER TABLE users ADD COLUMN presence_status VARCHAR(12) NOT NULL DEFAULT 'ONLINE';
ALTER TABLE users ADD CONSTRAINT users_presence_status_check
  CHECK (presence_status IN ('ONLINE', 'AWAY', 'DND', 'OFFLINE'));
