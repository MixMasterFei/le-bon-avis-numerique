-- One-time backfill for the V4 directSource Actualités feed.
-- Legacy real-photo stories: seed source_image_url from image_url (which is the
-- Supabase mirror, not the raw publisher URL — acceptable: stable + clean
-- display immediately). New stories capture the true pre-mirror publisher URL
-- at ingestion. STOCK / FALLBACK rows are intentionally left NULL so they show
-- the clean branded category card.
UPDATE news_stories
SET source_image_url = image_url
WHERE image_source_type IN ('AGENCY', 'PUBLISHER_RSS', 'PUBLISHER_OG')
  AND source_image_url IS NULL;
