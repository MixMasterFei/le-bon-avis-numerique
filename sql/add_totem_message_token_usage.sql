-- Token usage per Totem assistant message, for cost tracking in the admin
-- Control Tower, plus an index for the daily-cap counts.
--
-- Apply BEFORE deploying the code that writes these columns (they are
-- nullable, so old code + new columns is safe; the reverse is not):
--   npx prisma db execute --file sql/add_totem_message_token_usage.sql --schema prisma/schema.prisma

ALTER TABLE totem_messages
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS cached_input_tokens integer;

-- Daily caps count user messages since UTC midnight across all conversations.
CREATE INDEX IF NOT EXISTS totem_messages_role_created_at_idx
  ON totem_messages (role, created_at);
