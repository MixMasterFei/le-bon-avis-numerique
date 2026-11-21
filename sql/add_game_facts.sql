-- 2026-11-19 · Game facts (« Fiche pratique », pilot approved by Xavier on
-- 19 Nov 2026 — phase 1).
--
-- Twelve nullable columns on media_items holding the practical facts a parent
-- asks about a game and that the catalogue did not store: can it be played
-- online, on the same console, in split screen, by how many players, does it
-- sell in-game purchases, who made it, which series it belongs to, roughly how
-- long the main story lasts.
--
-- NULL means « not known », NEVER « no ». The writer (src/lib/game-facts.ts,
-- POST /api/cron/game-facts) only ever stores TRUE or a value it read from the
-- source; it never infers a « no » from absent data (a game with no
-- multiplayer record is not a solo game — see the « Solo uniquement » fix of
-- 18 Nov). in_game_purchases in particular is only TRUE when an official
-- rating body's descriptor says so (PEGI « Achats intégrés », ESRB
-- « In-Game Purchases »).
--
-- Written for an explicit id list only (the 100-game pilot first), by the
-- dispatch-only `game-facts` task. Read only by pilot fiches (isGamePilot).
--
-- APPLY BEFORE DEPLOYING the code that reads them. Prisma selects every
-- scalar column on a plain findUnique/findMany, so a missing column 500s every
-- fiche:
--
--   npx prisma db execute --file sql/add_game_facts.sql --schema prisma/schema.prisma
--
-- Idempotent — safe to re-run. Nullable columns without default are added
-- without rewriting the table.

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_online_play       BOOLEAN;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_local_play        BOOLEAN;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_split_screen      BOOLEAN;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_min_players       INTEGER;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_max_players       INTEGER;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_in_game_purchases BOOLEAN;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_developer         TEXT;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_publisher         TEXT;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_series            TEXT;
-- Hours for the main story (« normalement »), one decimal. Float on the
-- Prisma side: an approximate duration, never used in arithmetic that needs
-- exact decimals, and a Decimal would not cross into client components.
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_time_to_beat_hours DOUBLE PRECISION;
-- Bookkeeping: which source fields fed the row, and when it was last read.
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_facts_source      TEXT;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS game_facts_checked_at  TIMESTAMPTZ(6);

-- ── 2. content_updated_at follows the visible facts ─────────────────────────
-- Decision: YES, the ten fact columns move content_updated_at; the two
-- bookkeeping columns (game_facts_source, game_facts_checked_at) do not.
--
-- Why: content_updated_at answers « when did the public content of this fiche
-- change? » and feeds the sitemap <lastmod>, the JSON-LD dateModified and the
-- visible « Fiche mise à jour le … ». The facts are rendered as a block of the
-- fiche (« Fiche pratique »); when « jouable en ligne » or the number of
-- players appears or changes, the page a parent reads has changed, and a
-- recrawl is exactly what we want. A monthly re-read that finds the same
-- values must NOT move it — hence IS DISTINCT FROM, column by column, as for
-- the age and the synopsis.
--
-- Consequence to keep in mind: the facts are only RENDERED on pilot fiches for
-- now. Writing them for a non-pilot game would move its date with no visible
-- change, so the writer is restricted to explicit id lists (pilot=1 = the
-- treated games only) until the block is public.
--
-- The writer uses a raw UPDATE, so updated_at (Prisma @updatedAt, applied
-- client-side) is not moved by these writes either.
CREATE OR REPLACE FUNCTION media_items_touch_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.expert_age_rec IS DISTINCT FROM OLD.expert_age_rec
     OR NEW.synopsis_fr IS DISTINCT FROM OLD.synopsis_fr
     OR ROW(NEW.game_online_play, NEW.game_local_play, NEW.game_split_screen,
            NEW.game_min_players, NEW.game_max_players, NEW.game_in_game_purchases,
            NEW.game_developer, NEW.game_publisher, NEW.game_series,
            NEW.game_time_to_beat_hours)
        IS DISTINCT FROM
        ROW(OLD.game_online_play, OLD.game_local_play, OLD.game_split_screen,
            OLD.game_min_players, OLD.game_max_players, OLD.game_in_game_purchases,
            OLD.game_developer, OLD.game_publisher, OLD.game_series,
            OLD.game_time_to_beat_hours) THEN
    NEW.content_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_items_content_updated_at ON media_items;
CREATE TRIGGER media_items_content_updated_at
  BEFORE UPDATE OF expert_age_rec, synopsis_fr,
                   game_online_play, game_local_play, game_split_screen,
                   game_min_players, game_max_players, game_in_game_purchases,
                   game_developer, game_publisher, game_series,
                   game_time_to_beat_hours
  ON media_items
  FOR EACH ROW
  EXECUTE FUNCTION media_items_touch_content_updated_at();

SELECT 'Migration: game facts columns ready' AS status;
