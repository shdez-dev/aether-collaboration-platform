-- Preserve the one-alert policy for deadlines that were notified before the
-- shared key was introduced. Keep history intact; only re-key one row per
-- user/card/UTC deadline day so subsequent cron runs conflict atomically.
WITH ranked AS (
  SELECT id, user_id,
         'card-deadline:' || (data->>'cardId') || ':' || LEFT(data->>'dueDate', 10) AS next_key,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, data->>'cardId', LEFT(data->>'dueDate', 10)
           ORDER BY created_at DESC, id DESC
         ) AS row_number
  FROM notifications
  WHERE type IN ('CARD_DUE_SOON', 'CARD_OVERDUE')
    AND data->>'cardId' IS NOT NULL
    AND data->>'dueDate' IS NOT NULL
), preferred AS (
  SELECT id, user_id, next_key FROM ranked WHERE row_number = 1
)
UPDATE notifications AS n
SET dedupe_key = preferred.next_key
FROM preferred
WHERE n.id = preferred.id
  AND NOT EXISTS (
    SELECT 1 FROM notifications AS existing
    WHERE existing.user_id = preferred.user_id
      AND existing.dedupe_key = preferred.next_key
  );
