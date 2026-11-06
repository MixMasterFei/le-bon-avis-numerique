-- 2026-11-06 · Data-freshness columns (assessment of 6 Nov 2026).
--
-- Three columns on media_items, each answering ONE question honestly instead
-- of everything leaning on updated_at (which Prisma's @updatedAt moves on ANY
-- write — the nightly quality job alone rewrote all ~12 000 rows every day):
--
--   content_updated_at      when did the public content of this fiche change?
--   tmdb_checked_at         when did we last re-read its TMDB lifecycle/votes?
--   similarity_computed_at  when were its "titres proches" last recomputed?
--
-- APPLY BEFORE DEPLOYING the code that reads them. Prisma selects every
-- scalar column on a plain findUnique/findMany, so a missing column 500s every
-- fiche:
--
--   npx prisma db execute --file sql/add_data_freshness_columns.sql --schema prisma/schema.prisma
--
-- Idempotent — safe to re-run. The one-time backfill below only runs when the
-- column is created, so a re-run never overwrites trigger-maintained values.
--
-- APPLIED to production 2026-11-06 (Supabase migration
-- add_data_freshness_columns, version 20261106203251). Backfill: 12 265 rows,
-- 0 NULL; trigger behaviour re-checked on production in a rolled-back block.

-- ── 1. content_updated_at ───────────────────────────────────────────────────
-- Feeds the sitemap <lastmod>, the JSON-LD dateModified, the visible « Fiche
-- mise à jour le … » and the markdown/MCP layer. Moves ONLY when the age
-- (expert_age_rec), the synopsis (synopsis_fr) or the content analysis
-- (content_metrics) actually changes. Kept exact by the triggers in section 2,
-- so every write path — enrichment, deep enrichment, age-floor sweep, admin
-- edits, synopsis audit, SEO rewrites, scripts, raw SQL — is covered without
-- each one having to remember to stamp it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'media_items'
      AND column_name = 'content_updated_at'
  ) THEN
    ALTER TABLE media_items ADD COLUMN content_updated_at TIMESTAMPTZ(6);

    -- One-time estimate for existing rows. updated_at is useless here (every
    -- row carries the date of the last quality run), so take the last write to
    -- the content analysis, floored at the import date. Timestamps are stored
    -- as UTC wall-clock (timestamp without time zone), hence AT TIME ZONE 'UTC'.
    -- An age/synopsis edit that left no other trace can't be recovered; from
    -- here on the triggers keep the column exact.
    UPDATE media_items AS m
       SET content_updated_at = GREATEST(m.created_at, cm.updated_at) AT TIME ZONE 'UTC'
      FROM content_metrics AS cm
     WHERE cm.media_id = m.id;

    UPDATE media_items
       SET content_updated_at = created_at AT TIME ZONE 'UTC'
     WHERE content_updated_at IS NULL;

    ALTER TABLE media_items
      ALTER COLUMN content_updated_at SET DEFAULT now(),
      ALTER COLUMN content_updated_at SET NOT NULL;
  END IF;
END
$$;

-- ── 2. Triggers keeping content_updated_at exact ────────────────────────────
-- Age or synopsis changed → stamp. `BEFORE UPDATE OF` only fires when the
-- statement SETs one of these columns, so the quality job, the similarity and
-- TMDB cursors, streaming syncs etc. never even enter the function, and
-- IS DISTINCT FROM ignores a rewrite of an identical value (an enrichment that
-- lands on the same age is not an update of the fiche).
CREATE OR REPLACE FUNCTION media_items_touch_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.expert_age_rec IS DISTINCT FROM OLD.expert_age_rec
     OR NEW.synopsis_fr IS DISTINCT FROM OLD.synopsis_fr THEN
    NEW.content_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_items_content_updated_at ON media_items;
CREATE TRIGGER media_items_content_updated_at
  BEFORE UPDATE OF expert_age_rec, synopsis_fr ON media_items
  FOR EACH ROW
  EXECUTE FUNCTION media_items_touch_content_updated_at();

-- Content analysis created, withdrawn (revert-unreleased deletes it) or changed
-- → stamp the parent fiche. On UPDATE only the columns a reader actually sees
-- count; bookkeeping (updated_at, pass1_at/pass2_at, sensitive_warnings_at,
-- needs_deep_enrich, enrichment_source/confidence) is deliberately ignored.
CREATE OR REPLACE FUNCTION content_metrics_touch_media_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.media_items SET content_updated_at = now() WHERE id = NEW.media_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE public.media_items SET content_updated_at = now() WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;

  IF NEW.media_id IS DISTINCT FROM OLD.media_id THEN
    -- Analysis moved to another fiche (dedupe): both fiches changed.
    UPDATE public.media_items SET content_updated_at = now()
     WHERE id IN (OLD.media_id, NEW.media_id);
  ELSIF ROW(NEW.violence, NEW.sex_nudity, NEW.language, NEW.consumerism,
            NEW.substance_use, NEW.positive_messages, NEW.role_models,
            NEW.what_parents_need_to_know, NEW.sensitive_warnings,
            NEW.tone_tags, NEW.emotional_themes, NEW.pacing, NEW.visual_style)
        IS DISTINCT FROM
        ROW(OLD.violence, OLD.sex_nudity, OLD.language, OLD.consumerism,
            OLD.substance_use, OLD.positive_messages, OLD.role_models,
            OLD.what_parents_need_to_know, OLD.sensitive_warnings,
            OLD.tone_tags, OLD.emotional_themes, OLD.pacing, OLD.visual_style) THEN
    UPDATE public.media_items SET content_updated_at = now() WHERE id = NEW.media_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_metrics_content_updated_at ON content_metrics;
CREATE TRIGGER content_metrics_content_updated_at
  AFTER INSERT OR UPDATE OR DELETE ON content_metrics
  FOR EACH ROW
  EXECUTE FUNCTION content_metrics_touch_media_content_updated_at();

-- ── 3. tmdb_checked_at ──────────────────────────────────────────────────────
-- Last time the release-status refresh or the zero-vote refresh re-read this
-- title on TMDB (src/lib/tmdb-refresh.ts). release_status and the vote
-- counters used to be written once at import and never again, so a film
-- imported in "Post Production" stayed there — and out of the enrichment
-- queue — forever. NULL = never re-read since import.
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS tmdb_checked_at TIMESTAMPTZ(6);

-- ── 4. similarity_computed_at ───────────────────────────────────────────────
-- Rotation cursor for the weekly "titres proches" recompute
-- (/api/admin/similarity/compute picks the least recently computed first).
-- It used to page by offset over ORDER BY updated_at DESC from offset 0 every
-- Saturday, so the same ~1 000 of ~9 700 titles were recomputed every week.
-- NULL = never computed, which sorts first.
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS similarity_computed_at TIMESTAMPTZ(6);

SELECT 'Migration: data-freshness columns ready' AS status;
