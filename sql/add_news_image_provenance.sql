-- Adds image provenance tracking on news_stories so we can render
-- a Perplexity-style photo credit pill on every news card and audit
-- the legal posture of the image pool (agency/stock vs. publisher-
-- scraped).
--
-- All columns nullable: legacy rows keep working until the
-- `/api/admin/news/reprocess-images` backfill stamps them with a tier.

-- 1. Enum type. Postgres requires it to exist before any column can
--    reference it. ImageSourceType (PascalCase) matches Prisma's
--    convention in this codebase (see SimilaritySource gotcha in
--    CLAUDE.md — must use PascalCase, not snake_case).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImageSourceType') THEN
    CREATE TYPE "ImageSourceType" AS ENUM (
      'AGENCY',         -- Wire service (Reuters, AP, AFP, Getty, EPA…)
      'STOCK',          -- Pexels / Unsplash royalty-free
      'PUBLISHER_RSS',  -- Image the publisher syndicated via RSS
      'PUBLISHER_OG'    -- Scraped from OG meta — last resort
    );
  END IF;
END$$;

-- 2. Provenance columns. `image_credit` and `image_license_url` are
--    set together: license_url is only populated for STOCK (required
--    by Pexels and Unsplash for free-tier attribution).
ALTER TABLE news_stories
  ADD COLUMN IF NOT EXISTS image_source_type "ImageSourceType",
  ADD COLUMN IF NOT EXISTS image_credit      TEXT,
  ADD COLUMN IF NOT EXISTS image_license_url TEXT;
