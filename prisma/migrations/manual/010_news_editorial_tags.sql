-- Migration 010: editorial supervision tags on news_stories
-- Adds two nullable columns the feed-level balancer reads to avoid
-- stacking heavy stories at the top of /apercudecouverte-v3.
--
-- Both nullable on purpose: legacy rows synthesized before this
-- ships have no tags, and the balancer treats null editorial_tone
-- as "neutral" and null topic_cluster as "_unclustered". A backfill
-- script (scripts/backfill-news-editorial-tags.ts) populates them
-- after deploy so the V3 feed gets the benefit immediately.
--
-- Apply with: prisma db execute --file prisma/migrations/manual/010_news_editorial_tags.sql --schema prisma/schema.prisma

ALTER TABLE "news_stories"
  ADD COLUMN IF NOT EXISTS "editorial_tone" TEXT,
  ADD COLUMN IF NOT EXISTS "topic_cluster" TEXT;

-- Helpful index for the balancer's "group by cluster + take most
-- recent" pattern. Partial — only for PUBLISHED stories, which is
-- the only status the feed reads anyway.
CREATE INDEX IF NOT EXISTS "news_stories_published_cluster_idx"
  ON "news_stories"("topic_cluster", "published_at" DESC)
  WHERE "status" = 'PUBLISHED';
