-- AI-crawler & AI-referral telemetry (day-aggregated).
-- One row per (day, bot, kind, surface); `count` is incremented by
-- POST /api/track/ai-bot (fed by the middleware's UA/referrer detection).
--
-- Apply with:
--   npx prisma db execute --file sql/create_ai_bot_hits.sql --schema prisma/schema.prisma
-- then:
--   npx prisma generate
--
-- Idempotent (IF NOT EXISTS everywhere) — safe to re-run.

CREATE TABLE IF NOT EXISTS ai_bot_hits (
  id          TEXT PRIMARY KEY,
  day         DATE NOT NULL,
  bot         TEXT NOT NULL,
  kind        TEXT NOT NULL,
  surface     TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  sample_path TEXT,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_bot_hits_day_bot_kind_surface_key
  ON ai_bot_hits (day, bot, kind, surface);

CREATE INDEX IF NOT EXISTS ai_bot_hits_day_idx ON ai_bot_hits (day);
CREATE INDEX IF NOT EXISTS ai_bot_hits_bot_idx ON ai_bot_hits (bot);

-- Match the RLS posture of the other app tables (service-role access via
-- pooler; no anon access needed — mirrors enable_rls.sql conventions).
ALTER TABLE ai_bot_hits ENABLE ROW LEVEL SECURITY;
