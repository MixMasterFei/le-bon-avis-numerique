-- ============================================================
-- 006: Enable Row Level Security on all tables
-- ============================================================
-- WHY: Supabase exposes a REST API (PostgREST) by default on
-- every project. Without RLS, anyone with the anon key can
-- query all tables directly, bypassing application-level auth.
--
-- With RLS enabled and NO policies, the anon/authenticated
-- roles get ZERO access. Prisma (postgres superuser) bypasses
-- RLS automatically — no app changes needed.
--
-- Skips tables that don't exist yet (safe to re-run).
-- RUN: Execute in Supabase SQL Editor or via psql
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'accounts', 'sessions', 'verification_tokens',
    'family_members', 'family_settings',
    'reviews', 'review_reports', 'favorites', 'watchlist',
    'media_reactions', 'content_requests', 'media_corrections',
    'user_content_metrics',
    'cron_logs', 'admin_activities',
    'media_items', 'content_metrics', 'streaming_availability',
    'media_screenshots', 'media_similarities', 'media_credits',
    'persons',
    'genres', 'topics'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      RAISE NOTICE 'RLS enabled on %', tbl;
    ELSE
      RAISE NOTICE 'Skipped % (table does not exist)', tbl;
    END IF;
  END LOOP;
END $$;
