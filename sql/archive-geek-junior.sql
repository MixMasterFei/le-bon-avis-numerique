-- Archive existing Geek Junior news stories so they drop from the
-- /apercudecouverte-v3 feed immediately. The source has been added
-- to LOW_QUALITY_IMAGE_PUBLISHERS in news-image-policy.ts so future
-- cron runs won't ingest them. This one-shot UPDATE handles the
-- recent stories that are already published.
--
-- sources is a JSONB array of { name, url, favicon, headline,
-- publishedAt }. We match on the publisher name via @> containment.
--
-- Safe to re-run: the WHERE clause excludes already-archived rows
-- so the UPDATE is idempotent.

UPDATE news_stories
SET status = 'ARCHIVED',
    updated_at = NOW()
WHERE status = 'PUBLISHED'
  AND sources @> '[{"name": "Geek Junior"}]'::jsonb;
