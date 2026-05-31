// Shared "verdict line" for agent emails: a single line at the very top of
// every report so the owner can triage in ~5 seconds without reading the body.
//
//   ✅ RIEN À FAIRE — pour information.
//   ⚠️ ACTION : 2 — pousser « avis de fil et de sang » (pos. 10)
//   💡 5 OPPORTUNITÉS — top : « avis de fil et de sang » (pos. 10)
//
// "action" = something needs the owner (health broke, validation required).
// "opportunity" = optional growth intel; ignoring it costs nothing.

export interface VerdictInput {
  /** 0 → "rien à faire". >0 → the headline count. */
  count: number
  /** "action" (needs you) vs "opportunity" (optional). Defaults to "action". */
  kind?: "action" | "opportunity"
  /** Short description of the single most important item, if any. */
  top?: string
}

export function verdictLine(input: VerdictInput): string {
  if (input.count <= 0) {
    return "✅ RIEN À FAIRE — pour information."
  }
  const plural = input.count > 1 ? "S" : ""
  const head =
    input.kind === "opportunity"
      ? `💡 ${input.count} OPPORTUNITÉ${plural}`
      : `⚠️ ACTION : ${input.count}`
  return input.top ? `${head} — ${input.top}` : head
}

/** Prepend the verdict line (+ a blank line) to an existing report body. */
export function withVerdict(report: string, input: VerdictInput): string {
  return `${verdictLine(input)}\n\n${report}`
}
