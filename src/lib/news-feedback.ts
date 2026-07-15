/**
 * Reader feedback on news stories — the "was this useful for YOUR family?"
 * loop. Users react LIKE/DISLIKE on any news card (feed + story page); a
 * DISLIKE can carry an optional reason. The aggregate of recent dislikes is
 * injected into the news-discover synthesis prompt (reader signals), so the
 * editor model learns what real families found inadequate — closing the loop
 * between publication and selection.
 *
 * PURE module (no prisma import) — it's shared with the client-side inline
 * feedback buttons. The DB read lives in news-feedback-server.ts.
 */

// Fixed reason vocabulary for "pas pour nous" — one code per family-relevant
// failure mode, so the aggregation stays analyzable (free text alone can't
// be counted). Keys are stored in news_story_reactions.reason_code.
export const DISLIKE_REASONS: Record<string, string> = {
  not_family: "Pas adapté aux familles",
  anxiogene: "Trop anxiogène",
  not_useful: "Pas utile pour moi",
  deja_vu: "Déjà vu ailleurs",
  autre: "Autre raison",
}

export function isDislikeReason(value: unknown): value is keyof typeof DISLIKE_REASONS {
  // Object.hasOwn, not `in`: the `in` operator also matches inherited
  // properties ("toString", "constructor", "__proto__"), which would let
  // those strings through as "valid" reason codes.
  return typeof value === "string" && Object.hasOwn(DISLIKE_REASONS, value)
}

export const MAX_REASON_NOTE_LENGTH = 200

export interface ReaderSignalRow {
  type: string
  reasonCode: string | null
  reasonNote: string | null
  category: string
  title: string
}

/**
 * Formats recent reader feedback into a compact French prompt section for the
 * news-discover editor. Pure — separated from the DB read so it's testable.
 * Returns "" when there's nothing worth telling the editor (few dislikes =
 * noise, not signal).
 */
export function formatReaderSignals(rows: ReaderSignalRow[]): string {
  const dislikes = rows.filter((r) => r.type === "DISLIKE")
  if (dislikes.length < 3) return ""

  // Reason counts (coded reasons only — free text is sampled, not counted).
  const reasonCounts = new Map<string, number>()
  for (const d of dislikes) {
    if (d.reasonCode && Object.hasOwn(DISLIKE_REASONS, d.reasonCode)) {
      reasonCounts.set(d.reasonCode, (reasonCounts.get(d.reasonCode) ?? 0) + 1)
    }
  }
  const reasonLines = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, n]) => `- ${DISLIKE_REASONS[code]} : ${n} signalement${n > 1 ? "s" : ""}`)

  // Category counts — where the dislikes concentrate.
  const catCounts = new Map<string, number>()
  for (const d of dislikes) catCounts.set(d.category, (catCounts.get(d.category) ?? 0) + 1)
  const catLine = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, n]) => `${cat} (${n})`)
    .join(", ")

  // A few recent disliked titles as concrete examples. Deliberately NO
  // free-text notes here: reason notes are user-written and this string is
  // injected into the editorial LLM prompt — raw user text in a prompt is an
  // injection vector ("ignore tes instructions…"), and delimiters are not a
  // reliable defense. The CODED reasons carry the aggregate signal; the
  // titles are our own synthesized text (trusted). Notes stay in the DB for
  // human review.
  // Deduped by story title — several users disliking the same story should
  // yield one example line, not crowd out the other examples.
  const seenTitles = new Set<string>()
  const examples: string[] = []
  for (const d of dislikes) {
    if (examples.length >= 5) break
    if (seenTitles.has(d.title)) continue
    seenTitles.add(d.title)
    const why = d.reasonCode && Object.hasOwn(DISLIKE_REASONS, d.reasonCode) ? ` — ${DISLIKE_REASONS[d.reasonCode]}` : ""
    examples.push(`- « ${d.title.slice(0, 90)} »${why}`)
  }

  return [
    "\n\n## SIGNAUX LECTEURS (30 derniers jours)",
    "",
    `Des familles ont marqué ${dislikes.length} histoires récentes « pas pour nous ». Tiens-en compte dans ta sélection — ces signaux priment sur ton intuition quand ils convergent.`,
    ...(reasonLines.length > 0 ? ["", "Raisons données :", ...reasonLines] : []),
    ...(catLine ? ["", `Catégories les plus signalées : ${catLine}`] : []),
    ...(examples.length > 0 ? ["", "Exemples d'histoires signalées :", ...examples] : []),
  ].join("\n")
}

