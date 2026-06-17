-- PEGI content descriptor labels (from IGDB), stored per game.
-- Run: npx prisma db execute --file sql/add_pegi_descriptors.sql

ALTER TABLE media_items ADD COLUMN IF NOT EXISTS pegi_descriptors TEXT[] DEFAULT '{}';

SELECT 'Migration: pegi_descriptors column added successfully!' as status;
