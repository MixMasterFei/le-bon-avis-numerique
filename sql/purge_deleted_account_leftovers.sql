-- 2026-11-07 · Leftovers of accounts deleted before the F01 fix (Guardian).
--
-- Until 2026-11-07 « Supprimer mon compte » deleted the users row and let the
-- foreign keys decide. Two kinds of rows outlived those accounts:
--   - reviews (user_id SET NULL): rating, age suggestion AND free-text comment,
--     still displayed on the fiche, signed « Anonyme »;
--   - reco_clicks (no FK): click history under an id that resolves to nobody.
-- (nl_search_queries rows of those accounts are now indistinguishable from
-- anonymous searches, and the app prunes them after 90 days: nothing to do.)
--
-- This deletes both, recomputes the community age of the titles those reviews
-- fed (same rule as src/lib/community-age.ts: 3 suggestions minimum, else
-- NULL), and validates the reco_clicks foreign key that
-- sql/account_deletion_cascades.sql added NOT VALID — apply that file first.
--
-- Every review with a NULL user_id is such a leftover: the only code path that
-- writes reviews sets user_id from the session (src/app/api/user/review), and
-- no seed, script or SQL file inserts reviews. review_reports filed by OTHER
-- members about those reviews are left alone, as when a single review is
-- deleted.
--
-- DESTRUCTIVE: deletes production rows. Needs Xavier's explicit OK (house
-- rule 5). Run the preview alone first and read the counts:
--
--   SELECT
--     (SELECT count(*) FROM reviews WHERE user_id IS NULL)                         AS orphan_reviews,
--     (SELECT count(*) FROM reviews WHERE user_id IS NULL AND comment IS NOT NULL) AS orphan_comments,
--     (SELECT count(DISTINCT media_id) FROM reviews
--        WHERE user_id IS NULL AND age_suggestion IS NOT NULL)                       AS titles_to_recompute,
--     (SELECT count(*) FROM reco_clicks rc WHERE rc.user_id IS NOT NULL
--        AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = rc.user_id))            AS orphan_clicks;
--
--   npx prisma db execute --file sql/purge_deleted_account_leftovers.sql --schema prisma/schema.prisma
--
-- NOT APPLIED to production. Idempotent: a second run finds nothing to delete.
-- Tested 2026-11-07 on a throwaway PostgreSQL 16 built from prisma/schema.prisma.

BEGIN;

CREATE TEMP TABLE purge_aged_media ON COMMIT DROP AS
  SELECT DISTINCT media_id FROM reviews
  WHERE user_id IS NULL AND age_suggestion IS NOT NULL;

DELETE FROM reviews WHERE user_id IS NULL;

-- Raw SQL on purpose: neither updated_at (Prisma sets it client-side) nor
-- content_updated_at (its trigger watches expert_age_rec / synopsis_fr) moves.
UPDATE media_items m
SET community_age_rec = s.rec
FROM (
  SELECT a.media_id,
         CASE WHEN count(r.age_suggestion) >= 3
              THEN avg(r.age_suggestion)::double precision END AS rec
  FROM purge_aged_media a
  LEFT JOIN reviews r ON r.media_id = a.media_id AND r.age_suggestion IS NOT NULL
  GROUP BY a.media_id
) s
WHERE m.id = s.media_id
  AND m.community_age_rec IS DISTINCT FROM s.rec;

DELETE FROM reco_clicks rc
WHERE rc.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = rc.user_id);

ALTER TABLE "reco_clicks" VALIDATE CONSTRAINT "reco_clicks_user_id_fkey";

COMMIT;
