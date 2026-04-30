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
 * Scan the body for catalog title mentions and return the matched
 * catalog ids, in order of first occurrence, deduped. Body is NOT
 * modified — Xavier's editorial preference is to keep prose clean
 * and surface related catalog items as mini-cards at the bottom of
 * the story page rather than peppering inline links.
 *
 * Sort titles by length DESC so longer titles win over shorter ones
 * that contain them ("Final Fantasy VII Rebirth" before "Final
 * Fantasy"). Returns up to `limit` ids (caller renders 3 cards).
 */
export function extractCatalogMatches(
  body: string,
  catalog: LinkableMedia[],
  limit = 3,
): string[] {
  if (!body || catalog.length === 0) return []

  // Sort longest titles first so the long-title-takes-priority rule
  // works: ("Final Fantasy VII Rebirth" recorded before "Final
  // Fantasy" so the same body span isn't double-counted).
  const sorted = [...catalog].sort((a, b) => b.title.length - a.title.length)

  const matchedIds: string[] = []
  const claimedRanges: Array<{ start: number; end: number }> = []

  for (const item of sorted) {
    if (matchedIds.length >= limit) break
    if (matchedIds.includes(item.id)) continue
    const re = new RegExp(`\\b${escapeRegex(item.title)}\\b`, "i")
    const match = body.match(re)
    if (!match || match.index === undefined) continue
    const start = match.index
    const end = start + match[0].length
    // Skip when a longer title already claimed this span (avoids
    // counting "Final Fantasy" once "Final Fantasy VII Rebirth" hit).
    if (claimedRanges.some((r) => start < r.end && end > r.start)) continue
    claimedRanges.push({ start, end })
    matchedIds.push(item.id)
  }

  // Re-order results by their position in the body so the FIRST
  // mention determines the primary subject (mini-card #1).
  matchedIds.sort((a, b) => {
    const aRange = claimedRanges[matchedIds.indexOf(a)]
    const bRange = claimedRanges[matchedIds.indexOf(b)]
    return (aRange?.start ?? 0) - (bRange?.start ?? 0)
  })

  return matchedIds
}
