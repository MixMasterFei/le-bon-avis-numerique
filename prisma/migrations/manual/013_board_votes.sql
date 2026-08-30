-- Migration 013: badge votes on shared Recherche magique boards
-- Table: decouverte_board_votes
--
-- The social layer: a shared board (/tableau/<id>) becomes a ballot. Every
-- voter has a budget of 3 badges to spend across the board's titles — all
-- three on one film or spread out — and the board tallies live. Voters do
-- not need an account: identity is a server-issued browser token plus the
-- first name they type, because grandparents and group-chat parents will
-- never sign up to tap a badge.
--
-- One row per (board, voter, title), carrying how many badges that voter put
-- on that title (1..3). The 3-badge budget is enforced in the route inside a
-- transaction; the CHECK below is the backstop.

CREATE TABLE IF NOT EXISTS "decouverte_board_votes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "board_id" TEXT NOT NULL,
  "voter_token" TEXT NOT NULL,
  "voter_name" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "badges" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decouverte_board_votes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "decouverte_board_votes_badges_range" CHECK ("badges" >= 1 AND "badges" <= 3)
);

-- One row per voter and title on a board.
CREATE UNIQUE INDEX IF NOT EXISTS "decouverte_board_votes_board_voter_media_key"
  ON "decouverte_board_votes"("board_id", "voter_token", "media_id");

-- The tally read: all votes of one board.
CREATE INDEX IF NOT EXISTS "decouverte_board_votes_board_id_idx"
  ON "decouverte_board_votes"("board_id");

-- Votes are part of the board's life: the board goes, its ballot goes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decouverte_board_votes_board_id_fkey'
  ) THEN
    ALTER TABLE "decouverte_board_votes"
      ADD CONSTRAINT "decouverte_board_votes_board_id_fkey"
      FOREIGN KEY ("board_id") REFERENCES "decouverte_boards"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decouverte_board_votes_media_id_fkey'
  ) THEN
    ALTER TABLE "decouverte_board_votes"
      ADD CONSTRAINT "decouverte_board_votes_media_id_fkey"
      FOREIGN KEY ("media_id") REFERENCES "media_items"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
