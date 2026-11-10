import { DEFAULT_MODEL, ESCALATION_MODEL } from "@/lib/anthropic"
import { detectCrisis } from "@/lib/totem/crisis"

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
  /** Household first names, so the crisis check reads « Inès » as a child of the house. */
  familyNames?: readonly string[]
}

export interface ModelRouterDecision {
  model: string
  reason: "crisis" | "long_thread" | "multi_tool_prev" | "grave_keyword" | "default"
}

/**
 * Decide whether to escalate from Haiku to Sonnet for the upcoming turn.
 *
 * Triggers (any one is enough):
 *   - the message describes a person in distress (crisis.ts) — always first;
 *   - turnCount >= 8: long conversation, conversational density.
 *   - lastTurnToolCount >= 2: multi-tool reasoning loop.
 *   - userText matches a grave/sensitive French keyword.
 *
 * Otherwise stays on Haiku (default model).
 */
export function pickModel(input: ModelRouterInput): ModelRouterDecision {
  // None of « veut mourir », « on le frappe », « se fait harceler », « je me
  // fais du mal » matched the grave keywords below (baseline run 2026-11-08):
  // every crisis turn ran on the default model.
  if (detectCrisis(input.userText, { familyNames: input.familyNames })) {
    return { model: ESCALATION_MODEL, reason: "crisis" }
  }
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
