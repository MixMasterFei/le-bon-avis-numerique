-- Migration 012: shareable / saveable Recherche magique boards
-- Table: decouverte_boards
--
-- WHAT IS STORED IS THE PLAN, NOT THE RENDERED PAGE.
--
-- A board keeps the question, the clamped interpretation and the ordered list
-- of sections. It is re-rendered against live catalogue data every time it is
-- opened. That is deliberate: ages get refined by enrichment, community
-- consensus moves, provisional ratings get confirmed. A board frozen as HTML
-- would keep asserting "dès 8 ans" months after the fiche moved to 10 — the
-- exact failure the guides-parents freshness cron exists to prevent. Stable
-- composition, current facts.
--
-- Two lifetimes:
--   saved = false  a share snapshot. Anonymous, short-lived (expires_at set),
--                  created by the Partager button so a link can be sent.
--   saved = true   the owner kept it. Named, listed in /profil, never expires.

CREATE TABLE IF NOT EXISTS "decouverte_boards" (
  -- Short, URL-safe, unguessable. Not a uuid: this id is meant to be pasted
  -- into a message, and an unguessable id is what keeps an unlisted board
  -- unlisted.
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "query" TEXT NOT NULL,
  "intent" JSONB NOT NULL,
  "plan" JSONB NOT NULL,
  "title" TEXT,
  "saved" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" TIMESTAMP(3),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decouverte_boards_pkey" PRIMARY KEY ("id")
);

-- The owner's list in /profil, newest first.
CREATE INDEX IF NOT EXISTS "decouverte_boards_user_id_created_at_idx"
  ON "decouverte_boards"("user_id", "created_at");

-- Sweeping expired share snapshots.
CREATE INDEX IF NOT EXISTS "decouverte_boards_expires_at_idx"
  ON "decouverte_boards"("expires_at");

-- Cascade, unlike nl_search_queries: a board is personal content (it carries
-- the question someone asked and the name they gave it), not aggregate
-- telemetry, so deleting the account takes its boards with it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decouverte_boards_user_id_fkey'
  ) THEN
    ALTER TABLE "decouverte_boards"
      ADD CONSTRAINT "decouverte_boards_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
