-- Migration: Add sensitive_warnings_at to content_metrics
-- Marks WHEN sensitive warnings were computed, so "computed, found none"
-- (empty array on a gentle title) is distinct from "never computed" (legacy
-- rows from before the feature shipped). The backfill + nightly cron target
-- `sensitive_warnings_at IS NULL`, which lets them terminate cleanly instead of
-- re-processing warning-free titles forever.
-- Raw SQL per project convention. After running: `npx prisma generate`.

ALTER TABLE content_metrics ADD COLUMN IF NOT EXISTS sensitive_warnings_at TIMESTAMP(3) DEFAULT NULL;

-- Backfill index: the legacy sweep filters on NULL, prioritized by popularity.
CREATE INDEX IF NOT EXISTS idx_content_metrics_sensitive_warnings_at
  ON content_metrics (sensitive_warnings_at)
  WHERE sensitive_warnings_at IS NULL;

SELECT 'Migration: sensitive_warnings_at added successfully!' as status;
