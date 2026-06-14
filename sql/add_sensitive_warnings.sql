-- Migration: Add sensitive_warnings to content_metrics
-- Hedged, AI-generated category flags ("Ce qui peut marquer") surfaced on the
-- media fiche. Closed vocabulary validated in src/lib/sensitive-warnings.ts.
-- Raw SQL per project convention (the topics table blocks `prisma db push`).
-- After running: `npx prisma generate`.

ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS sensitive_warnings TEXT[] DEFAULT '{}';

SELECT 'Migration: sensitive_warnings added successfully!' as status;
