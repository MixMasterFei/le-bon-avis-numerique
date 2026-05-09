import { DEFAULT_MODEL, ESCALATION_MODEL } from "@/lib/anthropic"

// Words that indicate a grave/sensitive parental concern. Hits Sonnet
// because the answer needs more nuance than Haiku reliably gives.
// Lowercased; we match against the lowercased user text.
const ESCALATION_KEYWORDS = [
  "grave",
  "cauchemar",
  "harcèlement",
  "harcelement",
  "traumatis",
  "traumatique",
  "psy",
  "psychologue",
  "angoiss",
  "anxiet",
  "peur intense",
  "deuil",
  "suicid",
  "automutilat",
  "violen",
]

const ESCALATION_REGEX = new RegExp(
  `\\b(?:${ESCALATION_KEYWORDS.join("|")})`,
  "i",
)

export interface ModelRouterInput {
  /** 1-indexed turn count for the user message about to be processed. */
  turnCount: number
  /** Number of tool calls in the immediately previous assistant turn (0 if first turn). */
  lastTurnToolCount: number
  /** The current user message text (already trimmed). */
  userText: string
}

export interface ModelRouterDecision {
  model: string
  reason: "long_thread" | "multi_tool_prev" | "grave_keyword" | "default"
}

/**
 * Decide whether to escalate from Haiku to Sonnet for the upcoming turn.
 *
 * Triggers (any one is enough):
 *   - turnCount >= 8: long conversation, conversational density.
 *   - lastTurnToolCount >= 2: multi-tool reasoning loop.
 *   - userText matches a grave/sensitive French keyword.
 *
 * Otherwise stays on Haiku (default model).
 */
export function pickModel(input: ModelRouterInput): ModelRouterDecision {
  if (input.turnCount >= 8) {
    return { model: ESCALATION_MODEL, reason: "long_thread" }
  }
  if (input.lastTurnToolCount >= 2) {
    return { model: ESCALATION_MODEL, reason: "multi_tool_prev" }
  }
  if (ESCALATION_REGEX.test(input.userText)) {
    return { model: ESCALATION_MODEL, reason: "grave_keyword" }
  }
  return { model: DEFAULT_MODEL, reason: "default" }
}
