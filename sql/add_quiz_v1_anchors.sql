-- Phase 1.1 — Quiz v1 schema migration
-- Adds:
--  • NOT_FOR_ME value to the ReactionType enum (preemptive "intent dislike",
--    distinct from BORED which means "watched and was bored")
--  • ReactionSource enum + source column on media_reactions so quiz anchors
--    can be distinguished from organic post-watch reactions
--  • Family member columns for the new 8-step quiz + behavioral vector
--
-- Notes for the operator:
--  • ADD VALUE IF NOT EXISTS requires PG ≥ 12; Supabase is on 15+ so this is
--    safe. Must run standalone, NOT inside a transaction block.
--  • After running this file, update prisma/schema.prisma to add:
--      enum ReactionType { ... NOT_FOR_ME }
--      enum ReactionSource { organic quiz_anchor }
--      MediaReaction.source ReactionSource @default(organic)
--      FamilyMember.{preferredTones, quizVersion, quizCompletedAt,
--                    lastVectorUpdateAt, memberVector}
--    Then run: npx prisma generate

-- 1. Extend ReactionType with the new "intent dislike" value
ALTER TYPE "ReactionType" ADD VALUE IF NOT EXISTS 'NOT_FOR_ME';

-- 2. Reaction source enum (with idempotent guard for re-runs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReactionSource') THEN
    CREATE TYPE "ReactionSource" AS ENUM ('organic', 'quiz_anchor');
  END IF;
END $$;

-- 3. media_reactions.source column
ALTER TABLE media_reactions
  ADD COLUMN IF NOT EXISTS source "ReactionSource" NOT NULL DEFAULT 'organic';

-- 4. family_members — quiz v1 + behavioral-vector fields
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS preferred_tones TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quiz_version INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quiz_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_vector_update_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS member_vector JSONB;
