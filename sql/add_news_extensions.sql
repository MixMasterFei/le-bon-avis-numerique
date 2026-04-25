-- News-story extensions for: international strand (#1), weekly dossier (#2),
-- audience moderation tag (#3 — wired in code already), and research sidebar (#4).
-- All additive, all nullable or with safe defaults — no existing data touched.

ALTER TABLE news_stories
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'FR',
  ADD COLUMN IF NOT EXISTS story_type TEXT NOT NULL DEFAULT 'BRIEF',
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'parent_only',
  ADD COLUMN IF NOT EXISTS research JSONB;

CREATE INDEX IF NOT EXISTS news_stories_region_status_idx
  ON news_stories(region, status);

CREATE INDEX IF NOT EXISTS news_stories_story_type_status_idx
  ON news_stories(story_type, status);
