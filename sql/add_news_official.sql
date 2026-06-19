-- V5 "trusted sources" feed: tag stories whose every contributing source is a
-- government / public-institution / recognized-nonprofit feed (NewsSource.official
-- in src/lib/news-sources.ts). Computed strictly at ingestion in news-discover.ts;
-- existing rows are backfilled via POST /api/admin/news/tag-official (name-based
-- match on the sources JSON). The V5 page filters with `official = true`.
ALTER TABLE news_stories
  ADD COLUMN IF NOT EXISTS official BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS news_stories_official_status_idx
  ON news_stories (official, status);
