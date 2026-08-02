-- A notification key makes deadline alerts idempotent across cron runs,
-- restarts and horizontally scaled API instances.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255);

-- Keep the newest historical alert for each user/card/deadline/type.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, type, data->>'cardId', COALESCE(data->>'dueDate', '')
           ORDER BY created_at DESC, id DESC
         ) AS row_number
  FROM notifications
  WHERE type IN ('CARD_DUE_SOON', 'CARD_OVERDUE')
    AND data->>'cardId' IS NOT NULL
)
DELETE FROM notifications n
USING ranked r
WHERE n.id = r.id
  AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_dedupe_key_unique
  ON notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
