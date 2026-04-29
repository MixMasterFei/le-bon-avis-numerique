-- Enable RLS on the 4 news tables flagged by Supabase Security Advisor.
-- Same pattern as sql/enable_rls.sql — Prisma uses the postgres role
-- which bypasses RLS, so this blocks unauthorized access via PostgREST
-- / the anon Supabase client without breaking the app.

ALTER TABLE public.news_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_comment_reports ENABLE ROW LEVEL SECURITY;
