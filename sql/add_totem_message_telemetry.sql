-- Totem assistant telemetry and trusted history (Totem Trainer, 2026-11).
--
--   uncached_input_tokens / cache_write_input_tokens
--       Split of input_tokens, which holds the AI SDK 6 TOTAL (uncached +
--       cache reads + cache writes). The three parts are billed at 1×, 0.1×
--       and 1.25×; cache reads were already in cached_input_tokens.
--   routing_reason   why the turn ran on model_used (model-router reason).
--   finish_reason    how the turn ended: stop, tool-calls, length, aborted,
--                    client_disconnected, error…  (aborted and failed turns
--                    are now logged instead of vanishing). On a USER row,
--                    "regenerate" marks a « Réessayer » re-send.
--   model_messages   the turn's response messages (assistant + tool, every
--                    step). The chat route rebuilds the conversation history
--                    from these rows instead of trusting the browser's copy.
--
-- All columns are nullable and additive: old code keeps working against the
-- new table. The reverse is not true — APPLY THIS BEFORE DEPLOYING the code
-- that reads and writes them:
--   npx prisma db execute --file sql/add_totem_message_telemetry.sql --schema prisma/schema.prisma
-- Idempotent (IF NOT EXISTS), safe to re-run. No data is rewritten.

ALTER TABLE totem_messages
  ADD COLUMN IF NOT EXISTS uncached_input_tokens integer,
  ADD COLUMN IF NOT EXISTS cache_write_input_tokens integer,
  ADD COLUMN IF NOT EXISTS routing_reason text,
  ADD COLUMN IF NOT EXISTS finish_reason text,
  ADD COLUMN IF NOT EXISTS model_messages jsonb;
