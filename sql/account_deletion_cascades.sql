-- 2026-11-07 · Account deletion: the database's backstop (Guardian, finding F01).
--
-- « Supprimer mon compte » now runs as one transaction in the app
-- (src/lib/account-deletion.ts): it removes reviews, « Recherche magique »
-- queries and recommendation clicks itself, then deletes the users row. This
-- file makes the DATABASE agree, so a users row removed any other way
-- (Supabase dashboard, a future admin tool) cannot leave personal text behind:
--
--   reviews.user_id            ON DELETE SET NULL → CASCADE
--                              (the comment stayed online, signed « Anonyme »)
--   nl_search_queries.user_id  ON DELETE SET NULL → CASCADE
--                              (the raw query, which can name a child, stayed)
--   reco_clicks.user_id        no foreign key     → FK ON DELETE CASCADE,
--                              plus the index the FK needs on every delete
--
-- prisma/schema.prisma already describes this end state.
--
-- The reco_clicks constraint is added NOT VALID: it holds for every new row and
-- every future deletion, but does not re-check rows left by accounts deleted
-- before the fix. Removing those is a separate, destructive decision:
-- sql/purge_deleted_account_leftovers.sql (it VALIDATEs the constraint after).
--
-- Non-destructive and idempotent. The app does not depend on it (it deletes
-- explicitly), so it can go before or after the deploy.
--
--   npx prisma db execute --file sql/account_deletion_cascades.sql --schema prisma/schema.prisma
--
-- NOT APPLIED to production. Needs Xavier's OK (house rule 5).
-- Tested 2026-11-07 on a throwaway PostgreSQL 16 built from prisma/schema.prisma
-- (before this change): applies cleanly, twice.

BEGIN;

-- Drop every foreign key on <table>.user_id that points at users, whatever its
-- name, so the canonical constraint added below is the only one left.
DO $$
DECLARE
  t text;
  c record;
BEGIN
  FOREACH t IN ARRAY ARRAY['reviews', 'nl_search_queries', 'reco_clicks'] LOOP
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.contype = 'f'
        AND con.conrelid = t::regclass
        AND con.confrelid = 'users'::regclass
        AND att.attname = 'user_id'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', t, c.conname);
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nl_search_queries"
  ADD CONSTRAINT "nl_search_queries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "reco_clicks_user_id_idx" ON "reco_clicks"("user_id");

ALTER TABLE "reco_clicks"
  ADD CONSTRAINT "reco_clicks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

COMMIT;
