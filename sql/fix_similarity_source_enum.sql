-- Create SimilaritySource enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE "SimilaritySource" AS ENUM ('ALGORITHM', 'TMDB', 'EXPERT', 'COMMUNITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add source column to media_similarities if missing
ALTER TABLE "media_similarities"
  ADD COLUMN IF NOT EXISTS "source" "SimilaritySource" NOT NULL DEFAULT 'ALGORITHM';
