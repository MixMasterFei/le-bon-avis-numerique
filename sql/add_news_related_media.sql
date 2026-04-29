-- Adds the linkifier's primary-subject reference. Set at synthesis
-- time when the news body mentions a title that matches a row in
-- media_items. Drives the 'Voir la fiche complète sur Totem Avisé'
-- CTA at the bottom of the story page. NULL = no catalog match
-- (most parenting / general news).

ALTER TABLE news_stories
  ADD COLUMN IF NOT EXISTS related_media_id TEXT;
