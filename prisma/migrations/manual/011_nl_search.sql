-- Migration 011: Recherche magique (natural-language search)
-- Table: nl_search_queries
-- Apply with: prisma db execute --file prisma/migrations/manual/011_nl_search.sql --schema prisma/schema.prisma
--
-- One row per /decouverte resolution. Serves THREE purposes at once, which is
-- why it exists as its own table rather than riding on totem_messages:
--   1. cost telemetry (tokens + latency + model, per parse)
--   2. the daily-cap counter  (rows WHERE status = 'llm')
--   3. the parse CACHE       (query_hash → intent, so a repeated question
--                             never pays for a second interpretation)
--
-- status values:
--   'llm'        a real interpretation call was made (the only billable one)
--   'cache'      served from a previous parse of the same normalized query
--   'params'     rendered from structured URL params (chip edit / shared link)
--   'fallback'   interpretation failed → keyword search
--   'hors_sujet' interpreted as off-topic; no catalogue query run
--   'blocked'    rate limit or daily cap hit → degraded to keyword search

CREATE TABLE IF NOT EXISTS "nl_search_queries" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "query" TEXT NOT NULL,
  "query_hash" TEXT NOT NULL,
  "intent" JSONB,
  "status" TEXT NOT NULL,
  "model" TEXT,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "latency_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "nl_search_queries_pkey" PRIMARY KEY ("id")
);

-- Parse-cache lookup: newest successful interpretation for a given query.
CREATE INDEX IF NOT EXISTS "nl_search_queries_query_hash_created_at_idx"
  ON "nl_search_queries"("query_hash", "created_at");

-- Daily-cap counting filters on (status, created_at).
CREATE INDEX IF NOT EXISTS "nl_search_queries_status_created_at_idx"
  ON "nl_search_queries"("status", "created_at");

-- Per-user daily cap.
CREATE INDEX IF NOT EXISTS "nl_search_queries_user_id_created_at_idx"
  ON "nl_search_queries"("user_id", "created_at");

-- Telemetry outlives the account: ON DELETE SET NULL keeps the aggregate cost
-- history intact while detaching it from the deleted user (unlike the Totem
-- conversation tables, which are personal content and cascade).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nl_search_queries_user_id_fkey'
  ) THEN
    ALTER TABLE "nl_search_queries"
      ADD CONSTRAINT "nl_search_queries_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
