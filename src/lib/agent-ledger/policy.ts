/**
 * Autonomy policy — pure, no I/O, pinned by tests.
 *
 * Four levels, from least to most trusted. A human raises an action type one
 * step at a time as its track record earns it; that is the whole steering
 * model: humans move levels, agents do the work.
 *
 *   shadow      the agent records what it WOULD do; nothing is written and
 *               nobody is asked. For trying a new agent (or a new model) on
 *               real data before it touches anything.
 *   suggest     every proposal waits in « À valider »; nothing is written
 *               until a human approves it.
 *   act_report  the agent writes, and the write lands in « À relire » where a
 *               human acknowledges it or undoes it in one click.
 *   autonomous  the agent writes; the action is logged in the history but
 *               asks for nobody's attention.
 *
 * Optional confidence floor (0..1): at act_report / autonomous, a proposal
 * whose confidence is under the floor — or which carries NO confidence while
 * a floor is set — drops back to the queue instead of being written. This is
 * what lets a calibrated model act alone on the easy 90% and hand the rest to
 * a human.
 */

export const AUTONOMY_LEVELS = ["shadow", "suggest", "act_report", "autonomous"] as const
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number]

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  shadow: "Observation",
  suggest: "Proposer",
  act_report: "Agir et signaler",
  autonomous: "Autonome",
}

export const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  shadow: "L'agent note ce qu'il ferait, sans rien écrire ni rien demander.",
  suggest: "Chaque proposition attend votre validation avant d'être appliquée.",
  act_report: "L'agent applique, puis vous relisez (« Vu » ou « Annuler »).",
  autonomous: "L'agent applique seul ; l'action reste visible dans l'historique.",
}

export function isAutonomyLevel(v: unknown): v is AutonomyLevel {
  return typeof v === "string" && (AUTONOMY_LEVELS as readonly string[]).includes(v)
}

/** What happens to one proposal. */
export type Disposition = "shadow" | "queue" | "apply_report" | "apply"

export function clearsFloor(confidence: number | null, minConfidence: number | null): boolean {
  if (minConfidence == null) return true
  return confidence != null && confidence >= minConfidence
}

export function decideDisposition(input: {
  level: AutonomyLevel
  minConfidence: number | null
  confidence: number | null
}): Disposition {
  const { level, minConfidence, confidence } = input
  switch (level) {
    case "shadow":
      return "shadow"
    case "suggest":
      return "queue"
    case "act_report":
      return clearsFloor(confidence, minConfidence) ? "apply_report" : "queue"
    case "autonomous":
      return clearsFloor(confidence, minConfidence) ? "apply" : "queue"
  }
}

/** Accepts 0..1; anything else (NaN, out of range, non-number) → null (no floor). */
export function parseMinConfidence(v: unknown): number | null | "invalid" {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  if (!Number.isFinite(n) || n < 0 || n > 1) return "invalid"
  return n
}

/**
 * Track record of one action type, over the review window. "Human verdicts"
 * are the only signal that counts toward trust: an approval, an
 * acknowledgement (« Vu »), a rejection or a revert.
 */
export interface ActionTrackRecord {
  approved: number // human approved from the queue
  acknowledged: number // applied by the agent, a human said « Vu »
  rejected: number
  reverted: number
}

export const GRADUATION_MIN_VERDICTS = 10
export const DEMOTION_MIN_VERDICTS = 5
export const DEMOTION_BAD_RATE = 0.2

/**
 * A nudge, never an automatic change: autonomy is only ever raised by a
 * human. Returns a French sentence for the admin panel, or null.
 */
export function graduationHint(level: AutonomyLevel, r: ActionTrackRecord): string | null {
  const good = r.approved + r.acknowledged
  const bad = r.rejected + r.reverted
  const total = good + bad
  if (total >= DEMOTION_MIN_VERDICTS && bad / total > DEMOTION_BAD_RATE && level !== "shadow" && level !== "suggest") {
    return `${bad} refus ou annulation(s) sur ${total} : envisagez de redescendre à « ${AUTONOMY_LABELS.suggest} ».`
  }
  if (bad > 0 || good < GRADUATION_MIN_VERDICTS) return null
  if (level === "suggest") {
    return `${good} validations sans aucun refus : vous pouvez passer à « ${AUTONOMY_LABELS.act_report} ».`
  }
  if (level === "act_report") {
    return `${good} actions relues sans aucune annulation : vous pouvez passer à « ${AUTONOMY_LABELS.autonomous} ».`
  }
  return null
}
