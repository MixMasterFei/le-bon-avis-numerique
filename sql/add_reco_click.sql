-- Add RecoClick table for tracking recommendation clicks
CREATE TABLE IF NOT EXISTS "reco_clicks" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT,
  "media_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reco_clicks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reco_clicks_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_items"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "reco_clicks_media_id_idx" ON "reco_clicks"("media_id");
CREATE INDEX IF NOT EXISTS "reco_clicks_source_idx" ON "reco_clicks"("source");
CREATE INDEX IF NOT EXISTS "reco_clicks_created_at_idx" ON "reco_clicks"("created_at");
