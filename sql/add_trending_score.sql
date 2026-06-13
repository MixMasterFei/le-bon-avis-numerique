-- "Tendance du moment" signal for the homepage time-aware hero rail.
-- trending_score: rank-normalized 0–100 within each daily refresh batch
--   (top item = 100), so movies/TV/games stay comparable. NULL = not
--   currently trending; rail queries fall back to tmdb_vote_count.
-- trending_updated_at: lets readers ignore stale scores after a missed run.
-- See src/lib/trending.ts. Additive + idempotent — safe to re-run.

ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS trending_score double precision,
  ADD COLUMN IF NOT EXISTS trending_updated_at timestamptz;

-- Supports the rail's `WHERE type = ... ORDER BY trending_score DESC` pools.
CREATE INDEX IF NOT EXISTS media_items_type_trending_score_idx
  ON media_items (type, trending_score);
