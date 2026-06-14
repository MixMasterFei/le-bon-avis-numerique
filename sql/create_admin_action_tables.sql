-- Create the two admin action-item tables that exist in the Prisma schema
-- (models MediaCorrection, ReviewReport) but were never migrated to this
-- database — their absence 500s /api/admin/corrections and
-- /api/admin/review-reports (and silently breaks the user-facing
-- correction/report submission flows).
--
-- Enum type names are PascalCase to match what Prisma expects (same gotcha
-- as SimilaritySource). Additive + idempotent — safe to re-run.

-- ── Enum types (guarded: skip if they already exist) ─────────────────
DO $$ BEGIN
  CREATE TYPE "CorrectionType" AS ENUM
    ('WRONG_INFO','MISSING_INFO','AGE_RATING','CONTENT_WARNING','BROKEN_LINK','DUPLICATE','OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CorrectionStatus" AS ENUM
    ('PENDING','REVIEWED','APPROVED','REJECTED','DUPLICATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportReason" AS ENUM
    ('INAPPROPRIATE','SPAM','HARASSMENT','MISINFORMATION','OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM
    ('PENDING','REVIEWED','RESOLVED','DISMISSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── media_corrections ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_corrections (
  id              text PRIMARY KEY,
  media_id        text NOT NULL,
  user_id         text NOT NULL,
  type            "CorrectionType" NOT NULL,
  field           text,
  current_value   text,
  suggested_value text,
  description     text NOT NULL,
  status          "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
  admin_notes     text,
  reviewed_at     timestamptz,
  reviewed_by     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_corrections_media_id_fkey
    FOREIGN KEY (media_id) REFERENCES media_items(id) ON DELETE CASCADE,
  CONSTRAINT media_corrections_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS media_corrections_media_id_idx  ON media_corrections(media_id);
CREATE INDEX IF NOT EXISTS media_corrections_user_id_idx   ON media_corrections(user_id);
CREATE INDEX IF NOT EXISTS media_corrections_status_idx    ON media_corrections(status);
CREATE INDEX IF NOT EXISTS media_corrections_created_at_idx ON media_corrections(created_at);

-- ── review_reports ───────────────────────────────────────────────────
-- Note: reviewId has no FK in the Prisma schema (only userId relates), so we
-- mirror that — just the unique (review_id, user_id) guard.
CREATE TABLE IF NOT EXISTS review_reports (
  id         text PRIMARY KEY,
  review_id  text NOT NULL,
  user_id    text NOT NULL,
  reason     "ReportReason" NOT NULL,
  details    text,
  status     "ReportStatus" NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_reports_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT review_reports_review_id_user_id_key UNIQUE (review_id, user_id)
);
CREATE INDEX IF NOT EXISTS review_reports_status_idx ON review_reports(status);
