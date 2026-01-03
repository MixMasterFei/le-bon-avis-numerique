-- Migration: Add streaming availability table and enum
-- This enables storing JustWatch/TMDB streaming platform data

-- Create the StreamingType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StreamingType') THEN
    CREATE TYPE "StreamingType" AS ENUM ('SUBSCRIPTION', 'RENT', 'BUY', 'FREE', 'ADS');
  END IF;
END $$;

-- Create the streaming_availability table
CREATE TABLE IF NOT EXISTS streaming_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL,
  provider VARCHAR(255) NOT NULL,
  provider_id INTEGER,
  country VARCHAR(10) DEFAULT 'FR' NOT NULL,
  type "StreamingType" NOT NULL,
  available_from TIMESTAMP,
  available_until TIMESTAMP,
  link TEXT,
  last_checked TIMESTAMP DEFAULT NOW() NOT NULL,

  CONSTRAINT streaming_availability_media_id_fkey
    FOREIGN KEY (media_id)
    REFERENCES media_items(id)
    ON DELETE CASCADE,

  CONSTRAINT streaming_availability_media_provider_country_type_key
    UNIQUE (media_id, provider, country, type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS streaming_availability_provider_idx ON streaming_availability(provider);
CREATE INDEX IF NOT EXISTS streaming_availability_country_idx ON streaming_availability(country);
CREATE INDEX IF NOT EXISTS streaming_availability_last_checked_idx ON streaming_availability(last_checked);
CREATE INDEX IF NOT EXISTS streaming_availability_media_id_idx ON streaming_availability(media_id);
