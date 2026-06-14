-- TMDB release lifecycle for the anti-fabrication guard.
-- "Released" | "Planned" | "In Production" | "Post Production" | "Canceled"
-- | "Rumored". DISTINCT from the existing `status` column (manga/series
-- ongoing/completed). Lets us withhold content evaluation for upcoming
-- titles that have no release_date yet (announced sequels, etc.).
-- See src/lib/release-status.ts. Additive + idempotent — safe to re-run.

ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS release_status text;
