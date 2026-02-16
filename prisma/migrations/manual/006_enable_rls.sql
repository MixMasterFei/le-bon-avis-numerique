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
-- RUN: Execute in Supabase SQL Editor or via psql
-- ============================================================

-- Auth & identity (CRITICAL)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- Family data (HIGH)
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_settings ENABLE ROW LEVEL SECURITY;

-- User-generated content (MEDIUM)
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_content_metrics ENABLE ROW LEVEL SECURITY;

-- Admin & operational (MEDIUM)
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activities ENABLE ROW LEVEL SECURITY;

-- Media catalog (LOW but lock down anyway)
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

-- Taxonomy
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
