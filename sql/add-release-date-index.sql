-- Add index on release_date for media_items to speed up /films and other listing pages
-- This column is filtered on every listing query (WHERE release_date <= NOW())
CREATE INDEX IF NOT EXISTS idx_media_items_release_date
ON media_items (release_date DESC NULLS LAST);

-- Composite index for the most common query pattern: type + release_date
CREATE INDEX IF NOT EXISTS idx_media_items_type_release_date
ON media_items (type, release_date DESC NULLS LAST);
