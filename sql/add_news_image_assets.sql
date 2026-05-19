-- Dedicated visual library for Discover V4 prewarmed images.
-- Run in Supabase SQL editor or via `npx prisma db push` after the Prisma schema ships.

CREATE TABLE IF NOT EXISTS "news_image_assets" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "news_story_id" TEXT NOT NULL REFERENCES "news_stories"("id") ON DELETE CASCADE,
  "variant" TEXT NOT NULL DEFAULT 'DISCOVERY_V4',
  "provider" TEXT NOT NULL,
  "source_url" TEXT,
  "storage_url" TEXT,
  "credit" TEXT,
  "license_url" TEXT,
  "visual_intent" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "negative_terms" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "topic_label" TEXT,
  "category" "NewsCategory" NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quality_score" DOUBLE PRECISION,
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "rejected_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "news_image_assets_news_story_id_variant_key"
  ON "news_image_assets"("news_story_id", "variant");

CREATE INDEX IF NOT EXISTS "news_image_assets_variant_approved_idx"
  ON "news_image_assets"("variant", "approved");

CREATE INDEX IF NOT EXISTS "news_image_assets_category_idx"
  ON "news_image_assets"("category");

CREATE INDEX IF NOT EXISTS "news_image_assets_rejected_reason_idx"
  ON "news_image_assets"("rejected_reason");
