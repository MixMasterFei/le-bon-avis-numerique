-- Fix type mismatch: column uses "similarity_source" but Prisma expects "SimilaritySource"
-- Drop the wrongly-named enum and alter the column to use the correct one

-- Step 1: Remove the source column (it only has default values anyway)
ALTER TABLE "media_similarities" DROP COLUMN IF EXISTS "source";

-- Step 2: Drop both enum variants if they exist
DROP TYPE IF EXISTS "similarity_source";
DROP TYPE IF EXISTS "SimilaritySource";

-- Step 3: Recreate with the exact name Prisma expects
CREATE TYPE "SimilaritySource" AS ENUM ('ALGORITHM', 'TMDB', 'EXPERT', 'COMMUNITY');

-- Step 4: Re-add the column with the correct type
ALTER TABLE "media_similarities" ADD COLUMN "source" "SimilaritySource" NOT NULL DEFAULT 'ALGORITHM';
