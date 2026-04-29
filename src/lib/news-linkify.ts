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
    select: { id: true, title: true },
  })
  return rows
    .filter((r) => r.title.length >= 4)
    // Drop titles that match overly-generic English/French stop-word
    // patterns ("It", "Up", "And", "On", "Le", "Lui", "Toi").
    .filter((r) => !/^[A-Z][a-z]{0,2}$/.test(r.title))
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
