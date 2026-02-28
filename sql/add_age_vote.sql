-- Add AgeVote table for community validation of AI age recommendations
CREATE TABLE IF NOT EXISTS "age_votes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "agree" BOOLEAN NOT NULL,
  "suggested_age" INT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "age_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "age_votes_user_id_media_id_key" UNIQUE ("user_id", "media_id"),
  CONSTRAINT "age_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "age_votes_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_items"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "age_votes_media_id_idx" ON "age_votes"("media_id");
