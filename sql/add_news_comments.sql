-- News comments + reactions + reports (community engagement on news stories)

DO $$ BEGIN
  CREATE TYPE "NewsCommentStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ReportReason / ReportStatus are declared in the Prisma schema and used by
-- ReviewReport, but the original ReviewReport table may have been created
-- when these were stored as TEXT (legacy `prisma db push`). Re-create the
-- Postgres ENUM types idempotently so the new tables below can reference them.
DO $$ BEGIN
  CREATE TYPE "ReportReason" AS ENUM ('INAPPROPRIATE', 'SPAM', 'HARASSMENT', 'MISINFORMATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "news_comments" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
  "news_story_id" TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "status"        "NewsCommentStatus" NOT NULL DEFAULT 'VISIBLE',
  "edited_at"     TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "news_comments_news_story_id_fkey" FOREIGN KEY ("news_story_id") REFERENCES "news_stories"("id") ON DELETE CASCADE,
  CONSTRAINT "news_comments_user_id_fkey"       FOREIGN KEY ("user_id")       REFERENCES "users"("id")       ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "news_comments_story_created_idx" ON "news_comments"("news_story_id", "created_at");
CREATE INDEX IF NOT EXISTS "news_comments_user_idx"          ON "news_comments"("user_id");
CREATE INDEX IF NOT EXISTS "news_comments_status_idx"        ON "news_comments"("status");


CREATE TABLE IF NOT EXISTS "news_comment_reactions" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "comment_id"  TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_comment_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "news_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "news_comments"("id") ON DELETE CASCADE,
  CONSTRAINT "news_comment_reactions_user_id_fkey"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")         ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "news_comment_reactions_unique_key" ON "news_comment_reactions"("comment_id", "user_id", "type");
CREATE        INDEX IF NOT EXISTS "news_comment_reactions_comment_idx" ON "news_comment_reactions"("comment_id");


CREATE TABLE IF NOT EXISTS "news_comment_reports" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
  "comment_id"  TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "reason"      "ReportReason" NOT NULL,
  "details"     TEXT,
  "status"      "ReportStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_comment_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "news_comment_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "news_comments"("id") ON DELETE CASCADE,
  CONSTRAINT "news_comment_reports_user_id_fkey"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")         ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "news_comment_reports_unique_key" ON "news_comment_reports"("comment_id", "user_id");
CREATE        INDEX IF NOT EXISTS "news_comment_reports_status_idx" ON "news_comment_reports"("status");
