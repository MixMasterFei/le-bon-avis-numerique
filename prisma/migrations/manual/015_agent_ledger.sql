-- Migration 015: agent ledger — approval queue, run/cost ledger, autonomy policy
--
-- Three tables, one idea: every automated agent writes WHAT it did, HOW SURE it
-- was and WHAT IT COST in one place, and a human sets per action type how much
-- it may do on its own. Humans steer by moving autonomy levels, not by
-- triggering steps.
--
--   agent_runs      one row per agent execution: token usage + estimated cost
--                   (USD list prices, an ESTIMATION), actions proposed/applied.
--   agent_actions   one row per action an agent proposed. Lifecycle:
--                     shadow    recorded only (observation mode), never applied
--                     pending   waiting in « À valider » for a human decision
--                     applied   written to the catalogue; needs_review = true
--                               while it sits in « À relire » (act-and-report)
--                     rejected  a human said no
--                     reverted  applied, then undone from the ledger
--                     failed    the write was refused (target changed since the
--                               proposal, missing row…) — error says why
--                     expired   pending for 30 days with no decision
--                   `previous` holds the value before the write, so every
--                   applied action is reversible from the admin panel.
--   agent_autonomy  per action type: shadow | suggest | act_report | autonomous
--                   and an optional confidence floor. No row = the code default
--                   (src/lib/agent-ledger/registry.ts).
--
-- Apply with:  npx prisma db execute --file prisma/migrations/manual/015_agent_ledger.sql
-- then:        npx prisma generate
-- The code degrades safely before this runs: act_report agents keep writing as
-- they did, suggest-level proposals are dropped (never applied), the admin
-- panel shows an "apply migration 015" notice.

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" TEXT NOT NULL,
  "agent" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "summary" TEXT,
  "llm_calls" INTEGER NOT NULL DEFAULT 0,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
  -- NULL = at least one call used a model with no known price: "not
  -- measurable", never 0.
  "cost_usd" DOUBLE PRECISION,
  "usage_by_model" JSONB,
  "actions_proposed" INTEGER NOT NULL DEFAULT 0,
  "actions_applied" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_runs_agent_started_at_idx" ON "agent_runs"("agent", "started_at");
CREATE INDEX IF NOT EXISTS "agent_runs_started_at_idx" ON "agent_runs"("started_at");

CREATE TABLE IF NOT EXISTS "agent_actions" (
  "id" TEXT NOT NULL,
  "run_id" TEXT,
  "agent" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  -- Autonomy level in force when the action was proposed (snapshot: moving
  -- the policy later must not rewrite history).
  "autonomy" TEXT NOT NULL,
  "needs_review" BOOLEAN NOT NULL DEFAULT false,
  -- 0..1 when the agent produced a calibrated confidence; NULL = deterministic
  -- checks only.
  "confidence" DOUBLE PRECISION,
  "target_type" TEXT,
  "target_id" TEXT,
  "target_label" TEXT,
  "rationale" TEXT,
  "payload" JSONB NOT NULL,
  "previous" JSONB,
  "error" TEXT,
  -- The last HUMAN verdict: approved | rejected | acknowledged | reverted.
  -- NULL = no human has looked yet. This, not status, feeds the track record.
  "decision" TEXT,
  "decided_by" TEXT,
  "decided_at" TIMESTAMP(3),
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_actions_run_id_fkey" FOREIGN KEY ("run_id")
    REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "agent_actions_status_created_at_idx" ON "agent_actions"("status", "created_at");
CREATE INDEX IF NOT EXISTS "agent_actions_needs_review_idx" ON "agent_actions"("needs_review") WHERE "needs_review" = true;
CREATE INDEX IF NOT EXISTS "agent_actions_type_target_idx" ON "agent_actions"("action_type", "target_id");
CREATE INDEX IF NOT EXISTS "agent_actions_run_id_idx" ON "agent_actions"("run_id");
-- At most ONE open proposal per (action type, target): a weekly agent must not
-- stack the same suggestion every Thursday while the first one waits.
CREATE UNIQUE INDEX IF NOT EXISTS "agent_actions_one_pending_per_target"
  ON "agent_actions"("action_type", "target_id") WHERE "status" = 'pending';

CREATE TABLE IF NOT EXISTS "agent_autonomy" (
  "action_type" TEXT NOT NULL,
  "level" TEXT NOT NULL CHECK ("level" IN ('shadow', 'suggest', 'act_report', 'autonomous')),
  "min_confidence" DOUBLE PRECISION CHECK ("min_confidence" IS NULL OR ("min_confidence" >= 0 AND "min_confidence" <= 1)),
  "updated_by" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_autonomy_pkey" PRIMARY KEY ("action_type")
);

-- Server-only, like the other admin tables: only the Prisma connection reads
-- or writes these.
ALTER TABLE "agent_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_autonomy" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "agent_runs" FROM anon, authenticated;
REVOKE ALL ON TABLE "agent_actions" FROM anon, authenticated;
REVOKE ALL ON TABLE "agent_autonomy" FROM anon, authenticated;
