/**
 * The Coin Famille hero's one-liner — a short, plain-spoken note explaining WHY
 * today's pick fits, in Totem Avisé's editorial voice.
 *
 * It is a pure PHRASING layer over a `FitReason` that the caller has already
 * derived from real signals (the member's favorite genres, the fit score, who
 * the title suits). We never guess the reason here and never invent a taste —
 * the sentence is always traceable to the data that produced the `FitReason`.
 *
 * Tone: warm, specific, mainstream. No mascot jokes, no manufactured
 * excitement — an editor's note, not a gag.
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

/** One French sentence, in Totem's voice, explaining why the pick fits. */
export function totemVoiceLine(reason: FitReason): string {
  switch (reason.kind) {
    case "member-genre":
      return `Choisi pour ${reason.name}, qui aime les contenus ${reason.genre.toLowerCase()}.`
    case "member-strong":
      return `Très bon accord avec le profil de ${reason.name}.`
    case "member-chosen":
      return `Choisi pour ${reason.name}, d'après son âge et ses goûts.`
    case "family-all":
      return "Un bon choix pour toute la famille."
    case "family-one":
      return `Particulièrement adapté à ${reason.name}.`
    case "family-some":
      return `Adapté à ${reason.names.slice(0, 2).join(" et ")}.`
    case "family-compromise":
      return "Un bon compromis pour réunir tout le monde."
  }
}
