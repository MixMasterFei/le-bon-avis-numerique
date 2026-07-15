-- Reader-signals query support: getReaderFeedbackSignals filters DISLIKEs
-- from the last 30 days by updated_at. Cheap now, necessary at scale.
CREATE INDEX IF NOT EXISTS idx_news_story_reactions_type_updated
  ON news_story_reactions (type, updated_at DESC);
