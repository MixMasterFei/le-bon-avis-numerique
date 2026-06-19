-- Original publisher image URL captured at ingestion, before the Supabase
-- mirror. The V4 "directSource" Actualités feed hotlinks this as-is. Null for
-- FALLBACK/STOCK stories. Legacy rows are backfilled from image_url (mirror).
ALTER TABLE news_stories ADD COLUMN IF NOT EXISTS source_image_url TEXT;
