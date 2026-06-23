-- Enable Row Level Security on the two moderation tables flagged by the
-- Supabase Security Advisor ("RLS Disabled in Public").
--
-- Why this is safe:
--   * The app NEVER touches these tables through Supabase's auto REST API
--     (PostgREST / anon key). All access is server-side via Prisma, which
--     connects as the table OWNER role. Owners are exempt from RLS (we do NOT
--     use FORCE ROW LEVEL SECURITY), so Prisma keeps full read/write access.
--   * Enabling RLS with NO policies = deny-all for the `anon` / `authenticated`
--     PostgREST roles. That closes the exact hole the advisor flags: a public
--     anon key being able to read/write these moderation tables.
--
-- No policies are added on purpose: these admin/moderation tables should never
-- be reachable through the public API.

ALTER TABLE public.media_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports   ENABLE ROW LEVEL SECURITY;
