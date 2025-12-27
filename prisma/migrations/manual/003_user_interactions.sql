-- ============================================
-- Migration: Add user interaction tables
-- Run this in Supabase SQL Editor
-- Tables: favorites, watchlist, family_members, media_reactions
-- ============================================

-- 1. Create favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id)
);

CREATE INDEX IF NOT EXISTS favorites_media_id_idx ON favorites(media_id);

-- 2. Create watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, media_id)
);

CREATE INDEX IF NOT EXISTS watchlist_media_id_idx ON watchlist(media_id);

-- 3. Create family_members table
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_year INTEGER,
  avatar_emoji TEXT DEFAULT '👧',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS family_members_user_id_idx ON family_members(user_id);

-- 4. Create ReactionType enum
DO $$ BEGIN
  CREATE TYPE reaction_type AS ENUM (
    'LOVED',      -- Adoré
    'LIKED',      -- Bien aimé
    'OK',         -- Bof
    'SCARED',     -- A eu peur
    'BORED',      -- S'est ennuyé
    'TOO_YOUNG',  -- Trop jeune pour comprendre
    'TOO_OLD'     -- Trop vieux (pas intéressé)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Create media_reactions table
CREATE TABLE IF NOT EXISTS media_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  reaction reaction_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_member_id, media_id)
);

CREATE INDEX IF NOT EXISTS media_reactions_media_id_idx ON media_reactions(media_id);

-- ============================================
-- Done!
-- After running this, the favorites, watchlist,
-- and family reactions features will work.
-- ============================================
