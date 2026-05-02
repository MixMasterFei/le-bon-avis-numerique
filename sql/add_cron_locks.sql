-- Cron task lock table — guards long-running automated jobs against
-- concurrent invocations (manual GH Actions retry, Vercel cron + GH
-- Actions overlap, etc.). Each task acquires a lease-bounded lock at
-- entry and releases it on exit; if the worker crashes mid-run the
-- lease auto-expires so the next scheduled invocation can recover.
--
-- The acquire path is a single atomic INSERT … ON CONFLICT … DO UPDATE
-- WHERE lease_until < NOW() — Postgres evaluates the conflict + the
-- WHERE atomically per row, so two concurrent acquirers can never
-- both succeed. RETURNING tells the caller which one won.
--
-- One row per task name. Stays small (handful of rows total).

CREATE TABLE IF NOT EXISTS "cron_locks" (
  "task"         TEXT        PRIMARY KEY,
  "lease_until"  TIMESTAMPTZ NOT NULL,
  "acquired_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "acquired_by"  TEXT
);

-- Lock down access via Supabase's anon/authenticated PostgREST keys.
-- This table should ONLY be touched by the server-side Prisma
-- connection (postgres role, which bypasses RLS). Enabling RLS with
-- no policies means anon and authenticated requests get an empty
-- result set on SELECT and a permission error on writes — exactly
-- what we want for an internal coordination table.
ALTER TABLE "cron_locks" ENABLE ROW LEVEL SECURITY;
