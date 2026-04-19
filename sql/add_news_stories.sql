-- News discovery: synthesized story feed (admin-only V1)
-- Each row is one editorial story clustered from N source articles.

DO $$ BEGIN
  CREATE TYPE "NewsCategory" AS ENUM ('PARENTHOOD', 'FILM_TV', 'GAMES', 'READING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NewsStoryStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "news_stories" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
  "slug"            TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "summary"         TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "category"        "NewsCategory" NOT NULL,
  "sources"         JSONB NOT NULL,
  "image_url"       TEXT NOT NULL,
  "published_at"    TIMESTAMP(3) NOT NULL,
  "fetched_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "relevance_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"          "NewsStoryStatus" NOT NULL DEFAULT 'PUBLISHED',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_stories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "news_stories_slug_key"        ON "news_stories"("slug");
CREATE        INDEX IF NOT EXISTS "news_stories_published_at_idx" ON "news_stories"("published_at");
CREATE        INDEX IF NOT EXISTS "news_stories_cat_status_idx"   ON "news_stories"("category", "status");
