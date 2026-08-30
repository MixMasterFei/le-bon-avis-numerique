/**
 * Duty-of-care detection for the search field, mirroring the chatbot's
 * grave-concern routing (src/lib/totem/model-router.ts) on the surface a child
 * can reach without an account.
 *
 * Deliberately NARROWER than the chatbot's list: « cauchemar », « deuil » or
 * « harcèlement » are legitimate PARENTAL searches on this site (films to talk
 * about grief or bullying exist precisely for that), so they must keep
 * returning results. Only self-harm and suicide expressions trigger the care
 * banner — and the banner is shown WITH the results, never instead of them: a
 * parent looking for « un film qui aborde le suicide chez les ados » is doing
 * exactly what the site is for, and a young person typing something darker
 * should see the number without being told their words were invalid.
 */

const CARE_PATTERNS: RegExp[] = [
  /suicid/i,
  /automutil/i,
  /scarific/i,
  /me\s+faire\s+du\s+mal/i,
  /envie\s+de\s+mourir/i,
  /veux\s+mourir/i,
  /plus\s+envie\s+de\s+vivre/i,
]

export function needsCareBanner(query: string): boolean {
  if (!query) return false
  return CARE_PATTERNS.some((pattern) => pattern.test(query))
}

/** French national helplines, per the CNIL/ARCOM guidance for minors' surfaces. */
export const CARE_BANNER = {
  title: "Un moment difficile ?",
  body: "Si vous ou votre enfant avez besoin de parler, le 3114 (prévention du suicide) répond gratuitement, 24h/24. Pour un enfant en danger, le 119.",
} as const
