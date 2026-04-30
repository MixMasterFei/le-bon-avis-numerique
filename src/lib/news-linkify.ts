import { prisma } from "@/lib/prisma"

/**
 * Auto-link catalog titles in news bodies. Brings traffic from the
 * news feed back to the catalog: when a brief mentions "Final
 * Fantasy VII Rebirth" and we have that game in our DB, the title
 * becomes a clickable link to /media/<id>.
 *
 * Conservative matching: word-boundary, case-insensitive, only the
 * first occurrence per title gets linked (to avoid a sea of blue),
 * and only matches that are at least 4 chars + don't look like
 * common words ("It", "Up" — too generic, would mis-match).
 */

export interface LinkableMedia {
  id: string
  title: string
  // Used downstream to gate adult-rated catalog matches into
  // PENDING_REVIEW instead of auto-publishing them on the family
  // news page (Kill Bill: The Whole Bloody Affair, Saw, etc).
  expertAgeRec: number | null
}

/**
 * Pre-load a working set of catalog titles for the linkifier. Pulls
 * the rows likely to be mentioned in news (popularity-ranked when
 * the signal exists; otherwise a broad fetch capped at 5,000). Run
 * once at the start of a synthesis batch and reused for every
 * story in that batch.
 */
export async function loadCatalogIndex(): Promise<LinkableMedia[]> {
  // tmdbVoteCount is a popularity proxy. Order by it so the most
  // newsworthy catalog items are favored if we hit the limit.
  const rows = await prisma.mediaItem.findMany({
    where: {
      title: { not: "" },
    },
    orderBy: [
      { tmdbVoteCount: { sort: "desc", nulls: "last" } },
    ],
    take: 5000,
    select: { id: true, title: true, expertAgeRec: true },
  })
  return rows
    .filter((r) => r.title.length >= 5)
    // Drop titles that are common French/English words. These produce
    // false-positive links ("From", "Elle", "Up", "It", "On", "Lui",
    // "L'Attachement" — the body's "elle/from/l'attachement" gets
    // spuriously linked to unrelated catalog entries).
    .filter((r) => !COMMON_WORD_TITLES.has(r.title.toLowerCase()))
    // Drop titles that are a single common French article + a word —
    // "L'Attachement" matches "l'attachement" (a regular noun in a
    // body about something else). Risk of mis-link too high.
    .filter((r) => !/^[LDMSTNCJ]['']/i.test(r.title))
}

// Single-word titles that collide with common French/English words.
// Lowercased for case-insensitive comparison. List is intentionally
// conservative — when in doubt, exclude the catalog title (better a
// missed link than a wrong one). Add to this list as new mis-links
// surface in review.
const COMMON_WORD_TITLES = new Set<string>([
  // English common words (often catalog titles too)
  "from", "with", "into", "over", "down", "back", "home", "love",
  "life", "time", "year", "good", "best", "first", "last",
  "after", "again", "alone", "alive", "dead", "lost", "found",
  // French common words
  "elle", "lui", "toi", "moi", "nous", "vous", "leur", "leurs",
  "tout", "tous", "rien", "tout", "alors", "ainsi", "donc",
  "encore", "même", "très", "plus", "moins", "aussi", "comme",
  "voici", "voilà", "ici", "là-bas", "celui", "celle", "cela",
  "depuis", "pendant", "avant", "après", "selon", "dans", "sans",
  "pour", "avec", "par", "sur", "sous", "vers", "chez",
  // Brand-style single words that overlap with common English/French words
  "up", "it", "on", "you", "her", "him", "us", "we",
  "le", "la", "les", "un", "une", "des", "du", "de",
])

/**
 * Convenience: lookup by id in a catalog index. Used after linkify
 * to inspect the primary subject's age recommendation and decide
 * whether to demote the story to PENDING_REVIEW.
 */
export function findInCatalog(catalog: LinkableMedia[], id: string): LinkableMedia | undefined {
  return catalog.find((c) => c.id === id)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Replace the first occurrence of each catalog title in the body
 * with a markdown link to /media/<id>. Returns the rewritten body
 * plus the id of the **first** catalog title that matched (used to
 * surface the bottom-of-story CTA).
 *
 * Sort titles by length DESC so longer titles win over shorter ones
 * that contain them ("Final Fantasy VII Rebirth" before "Final
 * Fantasy"). Matching is case-insensitive but the original body
 * casing is preserved.
 */
export function linkifyStoryBody(
  body: string,
  catalog: LinkableMedia[],
): { body: string; primaryMediaId: string | null } {
  if (!body || catalog.length === 0) return { body, primaryMediaId: null }

  // Sort longest titles first so they take priority during matching.
  const sorted = [...catalog].sort((a, b) => b.title.length - a.title.length)

  let result = body
  let primaryMediaId: string | null = null
  // Track positions already replaced so we don't link inside an
  // already-linked range (avoid `[[X](/...)](/...)` nesting).
  const replacedRanges: Array<{ start: number; end: number }> = []

  for (const item of sorted) {
    // Word boundary ensures we match "Avatar" but not "Avatar3D" or
    // "Avatara". Case-insensitive flag ('i') lets us catch both
    // "Avatar 3" and "AVATAR 3" while preserving the original case
    // in the substitution.
    const re = new RegExp(`\\b${escapeRegex(item.title)}\\b`, "i")
    const match = result.match(re)
    if (!match || match.index === undefined) continue

    // Skip if this match overlaps an already-replaced range (which
    // would mean a longer title containing this one was already
    // linked here).
    const start = match.index
    const end = start + match[0].length
    if (replacedRanges.some((r) => start < r.end && end > r.start)) continue

    // Skip matches inside an existing markdown link `[…](…)` to
    // avoid nesting (the dossier prompt may have produced its own
    // links).
    const linkPrefixIdx = result.lastIndexOf("[", start)
    const linkOpenAfter = linkPrefixIdx >= 0 ? result.indexOf("]", linkPrefixIdx) : -1
    if (linkPrefixIdx >= 0 && linkOpenAfter > start) continue

    const replacement = `[${match[0]}](/media/${item.id})`
    result = result.slice(0, start) + replacement + result.slice(end)
    // The replacement is longer than the original; track the new
    // range in result-coordinates so subsequent iterations skip it.
    replacedRanges.push({ start, end: start + replacement.length })
    if (!primaryMediaId) primaryMediaId = item.id
  }

  return { body: result, primaryMediaId }
}
