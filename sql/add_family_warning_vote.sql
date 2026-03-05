-- Add FamilyWarningVote table for community-driven family warnings
-- Row presence = flagged, deletion = unflagged (no boolean column needed)
CREATE TABLE IF NOT EXISTS "family_warning_votes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "family_warning_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "family_warning_votes_user_id_media_id_key" UNIQUE ("user_id", "media_id"),
  CONSTRAINT "family_warning_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "family_warning_votes_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_items"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "family_warning_votes_media_id_idx" ON "family_warning_votes"("media_id");
