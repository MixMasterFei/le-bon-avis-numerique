-- Replaces single relatedMediaId (kept for back-compat) with an
-- array of catalog matches. Each news story can mention up to a few
-- catalog items; we surface them as mini-cards at the bottom of the
-- story page rather than scattering inline links across the body.

ALTER TABLE news_stories
  ADD COLUMN IF NOT EXISTS related_media_ids TEXT[] DEFAULT '{}';
