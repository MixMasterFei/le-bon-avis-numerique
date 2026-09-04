-- Index for the streaming rotation cursor.
--
-- Both /api/admin/streaming/cache and /api/admin/streaming/update now select
-- their next batch with
--     WHERE streaming_checked_at IS NULL OR streaming_checked_at < now() - '7 days'
--     ORDER BY streaming_checked_at ASC NULLS FIRST
-- over ~9 600 movie/TV rows. Without an index that is a full scan plus a sort
-- on every chunk, and the cache route issues one chunk per click.
--
-- NULLS FIRST matches the query's ordering exactly so Postgres can walk the
-- index instead of sorting. CONCURRENTLY so it cannot lock the table in prod.
CREATE INDEX CONCURRENTLY IF NOT EXISTS media_items_streaming_checked_at_idx
  ON media_items (streaming_checked_at ASC NULLS FIRST)
  WHERE tmdb_id IS NOT NULL;
