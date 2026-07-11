-- Migration: Add synopsis_fr_checked_at to media_items
-- Marks WHEN a title's synopsisFr was last passed through the grammar/tone
-- quality audit (src/app/api/admin/synopsis-audit/route.ts), so the backfill
-- can target `synopsis_fr_checked_at IS NULL` and terminate cleanly instead
-- of re-checking the same titles forever. Mirrors add_sensitive_warnings_at.sql.
-- Raw SQL per project convention. After running: `npx prisma generate`.

ALTER TABLE media_items ADD COLUMN IF NOT EXISTS synopsis_fr_checked_at TIMESTAMP(3) DEFAULT NULL;

-- Backfill index: the audit sweep filters on NULL, prioritized by popularity.
CREATE INDEX IF NOT EXISTS idx_media_items_synopsis_checked_at
  ON media_items (synopsis_fr_checked_at)
  WHERE synopsis_fr_checked_at IS NULL;

SELECT 'Migration: synopsis_fr_checked_at added successfully!' as status;
