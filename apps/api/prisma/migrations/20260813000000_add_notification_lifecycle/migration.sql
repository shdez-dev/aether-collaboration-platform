-- Notification lifecycle is additive: existing clients continue to use `read`
-- while new clients receive precise timestamps and can archive or resolve items.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP(3);

-- We do not know the real historical read time, so use creation time only for
-- legacy rows that were already read before this capability existed.
UPDATE notifications
SET read_at = created_at
WHERE read = TRUE AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_active_created_idx
  ON notifications (user_id, created_at DESC)
  WHERE archived_at IS NULL AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_archived_created_idx
  ON notifications (user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
