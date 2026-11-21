-- Migration 016: homepage spotlight pins (« À ne pas manquer cette semaine »)
-- Table: homepage_spotlight
--
-- Applied in production on 21 Nov 2026 (Director, verified: 8 columns). Written 2026-11-21 (Agentic Master, branch
-- claude/agentic-master-homepage-watch). Apply only with Xavier's OK, then
-- `npx prisma generate`. Number 015 is the agent ledger (already applied).
--
-- The homepage band shows 6–8 titles families are talking about this week
-- (big cinema releases, new series/seasons on French platforms, big game
-- launches). A pin forces a title into the band for a while:
--   source = 'watch' — written by the homepage-watch cron (every 2 days),
--                      expires after ~14 days, at most 8 active;
--   source = 'admin' — added by hand; never overwritten by the cron.
-- Without any active pin the band falls back to a deterministic selection
-- computed from catalogue data (src/lib/homepage-spotlight.ts), so the table
-- being empty — or absent, before this file is applied — is a normal state.
--
-- A pin carries NO age, NO text shown to families: the card reads the age and
-- poster from media_items like every other rail. `reason` is an internal note
-- for /admin (« Sorti en salles le 18 nov. », « Tendance de la semaine »).
--
-- One pin per title (unique media_id): re-pinning refreshes the dates.
-- Pins go with their title (ON DELETE CASCADE).
--
-- Rollback: DROP TABLE IF EXISTS "homepage_spotlight";

CREATE TABLE IF NOT EXISTS "homepage_spotlight" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "media_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "homepage_spotlight_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "homepage_spotlight_source_check" CHECK ("source" IN ('watch', 'admin')),
  CONSTRAINT "homepage_spotlight_window_check" CHECK ("expires_at" > "starts_at"),
  CONSTRAINT "homepage_spotlight_reason_length" CHECK (char_length("reason") BETWEEN 1 AND 200)
);

CREATE UNIQUE INDEX IF NOT EXISTS "homepage_spotlight_media_id_key"
  ON "homepage_spotlight" ("media_id");

-- The homepage read: active pins only.
CREATE INDEX IF NOT EXISTS "homepage_spotlight_expires_at_idx"
  ON "homepage_spotlight" ("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'homepage_spotlight_media_id_fkey'
  ) THEN
    ALTER TABLE "homepage_spotlight"
      ADD CONSTRAINT "homepage_spotlight_media_id_fkey"
      FOREIGN KEY ("media_id") REFERENCES "media_items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Same posture as every other public-schema table: RLS on, no policy, so
-- nothing reaches it over PostgREST. Prisma connects as the owner (postgres),
-- which bypasses RLS (relforcerowsecurity = false).
ALTER TABLE "homepage_spotlight" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "homepage_spotlight" FROM anon, authenticated;
