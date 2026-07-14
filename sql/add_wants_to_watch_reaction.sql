-- Add WANTS_TO_WATCH to the ReactionType enum — the per-member "à voir" intent
-- captured by the quick poster actions (PosterActionBar). Postgres requires the
-- enum name in PascalCase to match Prisma ("ReactionType").
--
-- Apply with:
--   npx prisma db execute --file sql/add_wants_to_watch_reaction.sql --schema prisma/schema.prisma
-- then:
--   npx prisma generate
--
-- Idempotent — IF NOT EXISTS guards a re-run.

ALTER TYPE "ReactionType" ADD VALUE IF NOT EXISTS 'WANTS_TO_WATCH';
