-- ============================================
-- Migration: Add data quality tracking and taxonomy tables
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add DataSource enum
DO $$ BEGIN
  CREATE TYPE data_source AS ENUM ('TMDB', 'IGDB', 'GOOGLE_BOOKS', 'EXPERT', 'COMMUNITY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Add quality tracking columns to media_items
ALTER TABLE media_items
ADD COLUMN IF NOT EXISTS data_source data_source DEFAULT 'TMDB',
ADD COLUMN IF NOT EXISTS data_quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_enriched BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS enriched_by TEXT;

-- Create indexes for quality queries
CREATE INDEX IF NOT EXISTS media_items_data_quality_score_idx ON media_items(data_quality_score);
CREATE INDEX IF NOT EXISTS media_items_is_enriched_idx ON media_items(is_enriched);

-- ============================================
-- 3. Taxonomy Tables
-- ============================================

-- Genres table (normalized)
CREATE TABLE IF NOT EXISTS genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  tmdb_id INTEGER UNIQUE,
  igdb_id INTEGER UNIQUE,
  parent_id UUID REFERENCES genres(id)
);

-- Topic category enum
DO $$ BEGIN
  CREATE TYPE topic_category AS ENUM ('THEME', 'EMOTION', 'SETTING', 'ACTIVITY', 'CHARACTER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Topics table (normalized)
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  category topic_category NOT NULL,
  synonyms TEXT[] DEFAULT '{}',
  icon TEXT
);

CREATE INDEX IF NOT EXISTS topics_category_idx ON topics(category);

-- ============================================
-- 4. Cast & Crew Tables
-- ============================================

-- Persons table
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tmdb_id INTEGER UNIQUE,
  igdb_id INTEGER UNIQUE,
  image_url TEXT,
  known_for TEXT
);

CREATE INDEX IF NOT EXISTS persons_name_idx ON persons(name);

-- Credit role enum
DO $$ BEGIN
  CREATE TYPE credit_role AS ENUM ('DIRECTOR', 'ACTOR', 'WRITER', 'COMPOSER', 'PRODUCER', 'DEVELOPER', 'AUTHOR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Media credits (join table)
CREATE TABLE IF NOT EXISTS media_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  role credit_role NOT NULL,
  character TEXT,
  "order" INTEGER,
  UNIQUE(media_id, person_id, role)
);

CREATE INDEX IF NOT EXISTS media_credits_person_id_idx ON media_credits(person_id);

-- ============================================
-- 5. Media Similarity Table
-- ============================================

-- Similarity source enum
DO $$ BEGIN
  CREATE TYPE similarity_source AS ENUM ('ALGORITHM', 'TMDB', 'EXPERT', 'COMMUNITY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Media similarities
CREATE TABLE IF NOT EXISTS media_similarities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id_a TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  media_id_b TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  similarity_score FLOAT NOT NULL,
  reasons TEXT[] DEFAULT '{}',
  source similarity_source DEFAULT 'ALGORITHM',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id_a, media_id_b)
);

CREATE INDEX IF NOT EXISTS media_similarities_media_id_a_idx ON media_similarities(media_id_a);
CREATE INDEX IF NOT EXISTS media_similarities_media_id_b_idx ON media_similarities(media_id_b);
CREATE INDEX IF NOT EXISTS media_similarities_score_idx ON media_similarities(similarity_score);

-- ============================================
-- 6. Streaming Availability Table
-- ============================================

-- Streaming type enum
DO $$ BEGIN
  CREATE TYPE streaming_type AS ENUM ('SUBSCRIPTION', 'RENT', 'BUY', 'FREE', 'ADS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Streaming availability
CREATE TABLE IF NOT EXISTS streaming_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id INTEGER,
  country TEXT DEFAULT 'FR',
  type streaming_type NOT NULL,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  link TEXT,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(media_id, provider, country, type)
);

CREATE INDEX IF NOT EXISTS streaming_availability_provider_idx ON streaming_availability(provider);
CREATE INDEX IF NOT EXISTS streaming_availability_country_idx ON streaming_availability(country);
CREATE INDEX IF NOT EXISTS streaming_availability_last_checked_idx ON streaming_availability(last_checked);

-- ============================================
-- Done!
-- ============================================
