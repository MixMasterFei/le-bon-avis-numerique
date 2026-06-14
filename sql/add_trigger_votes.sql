-- Add trigger_votes table — community verification of AI "Ce qui peut marquer"
-- sensitive-warning flags. One vote per (user, media, category): present=true
-- confirms, present=false rejects. Mirrors family_warning_votes + age_votes.
-- Raw SQL per project convention. After running: `npx prisma generate`.

CREATE TABLE IF NOT EXISTS "trigger_votes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "present" BOOLEAN NOT NULL,
  "intensity" INTEGER,
  "spoiler" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trigger_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trigger_votes_user_media_category_key" UNIQUE ("user_id", "media_id", "category"),
  CONSTRAINT "trigger_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "trigger_votes_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_items"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "trigger_votes_media_id_idx" ON "trigger_votes"("media_id");
CREATE INDEX IF NOT EXISTS "trigger_votes_media_category_idx" ON "trigger_votes"("media_id", "category");

SELECT 'Migration: trigger_votes added successfully!' as status;
