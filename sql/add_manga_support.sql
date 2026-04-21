-- Add MANGA to MediaType enum and ANILIST to DataSource enum
-- Plus manga-specific columns on media_items
-- Purely additive: no existing rows are modified.

ALTER TYPE "MediaType" ADD VALUE IF NOT EXISTS 'MANGA';
ALTER TYPE "DataSource" ADD VALUE IF NOT EXISTS 'ANILIST';

-- New columns (all nullable, so the ALTER is instant metadata-only on PG 11+)
ALTER TABLE media_items
  ADD COLUMN IF NOT EXISTS anilist_id INTEGER,
  ADD COLUMN IF NOT EXISTS volume_count INTEGER,
  ADD COLUMN IF NOT EXISTS chapter_count INTEGER,
  ADD COLUMN IF NOT EXISTS demographic TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS latest_volume_date TIMESTAMP;

-- anilistId must be unique across the table (matches @unique in schema.prisma)
CREATE UNIQUE INDEX IF NOT EXISTS media_items_anilist_id_key
  ON media_items(anilist_id)
  WHERE anilist_id IS NOT NULL;

-- Composite index matching @@index([type, latestVolumeDate]) in schema.prisma.
-- Drives the /mangas?sort=newest listing and the "Nouveautés manga" rail.
CREATE INDEX IF NOT EXISTS media_items_type_latest_volume_date_idx
  ON media_items(type, latest_volume_date DESC);
