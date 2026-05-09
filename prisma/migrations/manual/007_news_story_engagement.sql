-- ============================================
-- Migration: Add news story engagement tables
-- Run this in Supabase SQL Editor
-- Tables: news_story_reactions, news_saved_stories
-- ============================================

CREATE TABLE IF NOT EXISTS news_story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_story_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(news_story_id, user_id),
  CONSTRAINT news_story_reactions_type_check CHECK (type IN ('LIKE', 'DISLIKE'))
);

CREATE INDEX IF NOT EXISTS news_story_reactions_story_idx
  ON news_story_reactions(news_story_id);

CREATE INDEX IF NOT EXISTS news_story_reactions_user_idx
  ON news_story_reactions(user_id);

CREATE TABLE IF NOT EXISTS news_saved_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_story_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(news_story_id, user_id)
);

CREATE INDEX IF NOT EXISTS news_saved_stories_story_idx
  ON news_saved_stories(news_story_id);

CREATE INDEX IF NOT EXISTS news_saved_stories_user_created_idx
  ON news_saved_stories(user_id, created_at DESC);

-- Optional FK constraints. Keep them idempotent for environments where
-- legacy tables were created manually before constraints existed.
DO $$ BEGIN
  ALTER TABLE news_story_reactions
    ADD CONSTRAINT news_story_reactions_story_fk
    FOREIGN KEY (news_story_id) REFERENCES news_stories(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE news_story_reactions
    ADD CONSTRAINT news_story_reactions_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE news_saved_stories
    ADD CONSTRAINT news_saved_stories_story_fk
    FOREIGN KEY (news_story_id) REFERENCES news_stories(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE news_saved_stories
    ADD CONSTRAINT news_saved_stories_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
