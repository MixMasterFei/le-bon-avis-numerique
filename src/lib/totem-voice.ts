/**
 * The Coin Famille explanation — a short note tying today's pick to WHO it's for
 * and WHAT it's about, in Totem Avisé's editorial voice.
 *
 * It combines two truthful inputs the caller provides:
 *   - a `FitReason` derived from real signals (the member's favorite genres,
 *     the fit score, who the title suits) → the "who it's for" opener,
 *   - the media's own French synopsis → a one-sentence "what it's about" hook.
 *
 * We never guess a taste and never write the plot ourselves; the sentence is
 * always traceable to the FitReason + the catalogue synopsis.
 *
 * Tone: warm, specific, mainstream — an editor's note, not a gag.
 */

export type FitReason =
  /** The title matches a genre this member has marked as a favorite. */
  | { kind: "member-genre"; name: string; genre: string }
  /** Strong overall fit for this member (high score), no single standout genre. */
  | { kind: "member-strong"; name: string }
  /** A solid pick for this member on age + taste, without a headline reason. */
  | { kind: "member-chosen"; name: string }
  /** Suits every member of the household. */
  | { kind: "family-all" }
  /** Particularly suits one member. */
  | { kind: "family-one"; name: string }
  /** Suits two named members well. */
  | { kind: "family-some"; names: string[] }
  /** A reasonable middle ground when tastes diverge. */
  | { kind: "family-compromise" }

/**
 * Trim a raw synopsis into a short, clean hook (≈ one sentence, ≤ 160 chars).
 * Returns null when there's nothing usable, so the caller falls back to the
 * short opener alone.
 */
export function synopsisHook(text: string | null | undefined): string | null {
  if (!text) return null
  const s = text.trim().replace(/\s+/g, " ")
  if (s.length < 25) return null
  const MAX = 160
  if (s.length <= MAX) return s
  const window = s.slice(0, MAX)
  const lastStop = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  )
  if (lastStop > 70) return window.slice(0, lastStop + 1).trim()
  const lastSpace = window.lastIndexOf(" ")
  const base = lastSpace > 70 ? window.slice(0, lastSpace) : window
  return base.replace(/[,;:]$/, "").trim() + "…"
}

/** The "who it's for" opener, with no trailing punctuation. */
function opener(reason: FitReason): string {
  switch (reason.kind) {
    case "member-genre":
      return `Pour ${reason.name}, qui aime les contenus ${reason.genre.toLowerCase()}`
    case "member-strong":
      return `Un très bon choix pour ${reason.name}`
    case "member-chosen":
      return `Pour ${reason.name}, d'après son âge et ses goûts`
    case "family-all":
      return "Pour toute la famille"
    case "family-one":
      return `Surtout pour ${reason.name}`
    case "family-some":
      return `Pour ${reason.names.slice(0, 2).join(" et ")}`
    case "family-compromise":
      return "Pour se retrouver tous ensemble"
  }
}

/**
 * One or two French sentences in Totem's voice: a member-linked opener plus,
 * when available, a one-sentence synopsis hook so the note is specific to the
 * title rather than generic.
 */
export function totemVoiceLine(reason: FitReason, synopsis?: string | null): string {
  const base = opener(reason)
  const hook = synopsisHook(synopsis)
  return hook ? `${base} : ${hook}` : `${base}.`
}
