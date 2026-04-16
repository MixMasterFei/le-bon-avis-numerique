-- Enable RLS on tables flagged by Supabase Security Advisor
-- Safe: Prisma uses the postgres role which bypasses RLS.
-- This blocks unauthorized access via PostgREST / Supabase client.

ALTER TABLE public.age_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_warning_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reco_clicks ENABLE ROW LEVEL SECURITY;
