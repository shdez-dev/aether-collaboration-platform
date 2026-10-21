ALTER TABLE direct_messages
  ALTER COLUMN body TYPE VARCHAR(8000);

ALTER TABLE direct_messages
  DROP CONSTRAINT IF EXISTS direct_messages_body_check,
  ADD CONSTRAINT direct_messages_body_check
    CHECK (length(trim(body)) BETWEEN 1 AND 8000);
