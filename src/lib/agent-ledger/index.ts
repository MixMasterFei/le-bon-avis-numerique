/**
 * Agent ledger: approval queue, run/cost ledger, autonomy policy.
 * See prisma/migrations/manual/015_agent_ledger.sql for the lifecycle, and
 * registry.ts to add a new kind of action.
 */
export * from "./policy"
export { ACTION_HANDLERS, AGENT_LABELS, AgentActionConflict, getHandler } from "./registry"
export {
  startAgentRun,
  proposeAgentAction,
  hasPendingProposal,
  decideAgentAction,
  setAutonomy,
  isHumanDecision,
  DecisionError,
  HUMAN_DECISIONS,
  type AgentRunTracker,
  type ProposalOutcome,
  type HumanDecision,
} from "./ledger"
export { getLedgerOverview, getLedgerCounts, type LedgerOverview } from "./overview"
