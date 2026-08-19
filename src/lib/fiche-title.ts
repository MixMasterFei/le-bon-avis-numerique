/**
 * The default SERP <title> for a media fiche.
 *
 * Why this is not just `"{titre} — Dès 12 ans"`:
 *
 * Every query that actually earns clicks contains the word "âge" — "spider man
 * brand new day age", "l'odyssée film age minimum", "roblox quel âge". The old
 * default never used that token, so the title matched the query only through
 * the work's name. On the film side that still worked, because the striking-
 * distance agent writes a hand-tuned `seoTitle` for pages that already rank.
 * On games it did not: 0 of 1 860 game pages had a `seoTitle`, because the
 * agent only optimises what already ranks, and games rank nowhere — a
 * cold-start loop no amount of waiting escapes.
 *
 * So the default itself has to carry the keyword. `seoTitle`, when set, still
 * wins: this is the floor, not a ceiling.
 *
 * Length: the root layout appends " | Totem Avisé" (14 chars) and Google shows
 * roughly 60. We therefore pick the longest variant that keeps the
 * page-specific part within `MAX_TITLE`, and always degrade to something
 * sensible rather than truncating mid-phrase.
 */

/** Page-specific budget, leaving room for the " | Totem Avisé" suffix. */
export const MAX_TITLE = 52

export interface FicheTitleInput {
  /** The work's display name — never rewritten. */
  title: string
  /** Totem's recommended age, when there is one. */
  age?: number | null
  /** Pre-release / provisional: the age is an estimate, say so. */
  provisional?: boolean
}

export function buildFicheTitle({ title, age, provisional }: FicheTitleInput): string {
  const name = title.trim()
  if (!age || age <= 0) return name

  const ans = `Dès ${age} ans`
  // Longest first. Each keeps the work's name intact and puts the query
  // wording as early as the name allows.
  const variants = provisional
    ? [` — À partir de quel âge ? ${ans} (à confirmer)`, ` — ${ans} (à confirmer)`]
    : [` — À partir de quel âge ? ${ans}`, ` — Quel âge ? ${ans}`, ` — ${ans}`]

  for (const suffix of variants) {
    if (name.length + suffix.length <= MAX_TITLE) return name + suffix
  }
  // Name alone already eats the budget: keep the age, drop the question.
  return name + (provisional ? ` — ${ans} (à confirmer)` : ` — ${ans}`)
}
