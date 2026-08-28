-- 2026-08-28 · Dedicated cursor for the Saturday streaming re-verification
-- rotation. Deliberately NOT lastVerifiedAt: that column already gates the
-- weekly poster-refresh sweep (30d) and the debt digest (90d), so stamping it
-- from the streaming pass would defer poster checks and dilute the debt
-- metric without any content verification happening.
--
-- APPLIED to production 2026-08-28 (Supabase migration add_streaming_checked_at).
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS streaming_checked_at timestamptz;
