/**
 * Grounding: an age only comes from the catalogue, read through a tool in the
 * same turn, and a provisional age is always said to be provisional.
 *
 * Baseline (2026-11-08): « Mon fils de 8 ans peut-il regarder Stranger
 * Things ? » was answered with no tool call, « plutôt à partir de 13 ans »
 * (catalogue: 14) — the exact reply of a soul.md example; « 18+ » for GTA V
 * and « Spider-Man: Beyond, plutôt 12 ans » likewise came from memory; Verity
 * (provisional) was given a firm « à partir de 16 ans ».
 */

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
}

// « quel âge », « peut-il regarder », « ça convient à Léa », « trop âgé pour
// Hugo », « bon pour mon enfant », PEGI… — a question whose answer is an age.
const AGE_QUESTION = new RegExp(
  [
    "\\bquel age\\b",
    "\\ba partir de quel",
    "\\bdes quel\\b",
    "\\bage (conseille|minimum|recommande|requis|mini)\\b",
    "\\b(peut|peuvent|pourra|pourrait|pourraient|puis|peux)(-| )(il|elle|ils|elles|on|je|t-il|t-elle)?\\s*(le |la |les |l'|y )?(regarder|voir|jouer|lire)\\b",
    "\\blaiss(e|er)\\b[^.?!]{0,20}\\b(regarder|voir|jouer|lire)\\b",
    "\\b(convient|conviennent|conviendrait|convenir)\\b",
    "\\badapte(e|s|es)? (a|pour) (mon|ma|mes|un|une|son|sa|ses|lui|elle|eux|des|les|nos|notre|[a-z]+ (de )?\\d{1,2} ans)\\b",
    "\\b(est|c'est|serait)(-ce|-il|-elle)? (adapte|pour (lui|elle|eux|un enfant|les enfants))\\b",
    "\\b(bon|bien|ok) pour (mon|ma|un|une|son|sa|lui|elle|eux|des|les|nos|notre)\\b",
    "\\btrop (jeune|jeunes|age|ages|agee|violent|violente|effrayant|effrayante|dur|choquant|petit|petite)\\b",
    "\\bpegi\\b",
    "\\binterdit aux\\b",
    // A cautious parent about a title: « je préfère que Léa ne joue pas à
    // Fortnite, j'ai raison ? » — the answer must carry the catalogue's age.
    "\\b(je prefere|je prefererais|j'aime mieux|on prefere|je ne veux pas|je refuse|j'interdis)\\b[^.?!]{0,60}\\b(joue|jouer|regarde|regarder|voie|voir|lise|lire)\\b",
  ].join("|"),
)

/**
 * The message asks for an age, whether a title suits a child, or whether a
 * parent is right to keep a title from a child.
 */
export function asksAboutAge(text: string): boolean {
  return AGE_QUESTION.test(norm(text))
}

// On a media fiche, « ce film » IS the page's title: its age is already in
// the prompt (page context), no lookup needs to be forced.
const DEICTIC = /\b(ce|cet|cette) (film|serie|jeu|livre|titre|dessin anime|episode|manga)\b|\b(celui-ci|celle-ci|ca)\b/

export function refersToPageTitle(text: string): boolean {
  return DEICTIC.test(norm(text))
}

/**
 * Models on which a forced tool call (toolChoice "required") is honoured.
 * The 4.x line accepts it; newer models reject forced tool use, and the
 * provider would silently downgrade it to « auto ».
 */
export function supportsForcedToolChoice(modelId: string): boolean {
  return /^claude-(haiku|sonnet|opus)-4/.test(modelId)
}

/** How sure the catalogue is of an age: confirmed (analysed), provisional (estimated), none. */
export type AgeStatus = "confirmé" | "provisoire" | "non évalué"

export function ageStatusOf(row: { isEnriched: boolean; expertAgeRec: number | null }): AgeStatus {
  if (row.expertAgeRec == null) return "non évalué"
  return row.isEnriched ? "confirmé" : "provisoire"
}

const TO_ROMAN: Record<string, string> = {
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  "6": "VI",
  "7": "VII",
  "8": "VIII",
  "9": "IX",
  "10": "X",
}
// Single letters (I, V, X) stay letters: « V pour Vendetta », « X-Men ».
const TO_ARABIC: Record<string, string> = { ii: "2", iii: "3", iv: "4", vi: "6", vii: "7", viii: "8", ix: "9" }

/**
 * Other spellings of a title query, tried in order when the query itself
 * finds nothing: « Mortal Kombat 2 » ↔ « Mortal Kombat II », « le film
 * Vaiana 2 » → « Vaiana 2 », « Dune 2021 » → « Dune ». Hyphens, accents,
 * case, leading articles and original (English) titles are already handled by
 * the title search itself (search-normalize.ts).
 */
export function titleQueryVariants(query: string): string[] {
  const q = query.trim()
  const out: string[] = []
  const numerals = q.replace(/\b(\d{1,2}|[ivx]{2,4})\b/gi, (w) => TO_ROMAN[w] ?? TO_ARABIC[w.toLowerCase()] ?? w)
  if (numerals !== q) out.push(numerals)
  const noTypeWord = q.replace(
    /^(le |la |l'|les )?(film|serie|série|jeu vidéo|jeu video|jeu|livre|roman|bd|dessin animé|dessin anime|saga|manga)( de| d')?\s+/i,
    "",
  )
  if (noTypeWord !== q && noTypeWord.trim().length > 1) out.push(noTypeWord.trim())
  const noYear = q.replace(/\s*\(?\b(19|20)\d{2}\)?\s*$/, "").trim()
  if (noYear !== q && noYear.length > 1) out.push(noYear)
  return [...new Set(out)]
}
