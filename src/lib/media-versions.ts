/**
 * « Autres versions et suites » — the titles an editor tied to this fiche as
 * the same work: versions, remakes, sequels (Scrooge ×4, Charlie et la
 * chocolaterie 1971/2005, Beetlejuice 1988/2024, Conjuring ×4, Call of Duty
 * Modern Warfare ×4).
 *
 * Source: EXPERT `MediaSimilarity` edges whose `reasons` contain
 * `editorial_cluster`. Only DIRECT edges are read — a cluster an editor did not
 * fully link shows only the links that exist.
 *
 * Unlike « Titres similaires » (src/lib/similar-media.ts), there is NO
 * « same age or younger » filter: a remake rated older than the original is
 * exactly what a parent needs to see. Every entry carries its own age instead,
 * and the regular rail no longer repeats these titles.
 */
import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { ageSentenceLabel } from "@/lib/age-label"

export const EDITORIAL_CLUSTER_REASON = "editorial_cluster"
export const MAX_VERSIONS = 8

export interface VersionEntry {
  id: string
  title: string
  type: string
  releaseDate: Date | string | null
  expertAgeRec: number | null
  /** Not yet enriched: the age is an estimate. */
  isEnriched?: boolean
}

export interface VersionsBlock {
  heading: string
  items: (VersionEntry & { label: string; year: number | null })[]
}

function yearOf(date: Date | string | null): number | null {
  if (!date) return null
  const year = typeof date === "string" ? Number(date.slice(0, 4)) : date.getUTCFullYear()
  return Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : null
}

/**
 * Compares two display names as the same name: case, accents, punctuation and
 * a trailing parenthetical (« Scrooge (Un Conte De Noël) ») don't count.
 * « Beetlejuice Beetlejuice » or « Conjuring 2 : Le Cas Enfield » do.
 */
export function workNameKey(title: string): string {
  return title
    .replace(/\s*\([^)]*\)\s*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** « Scrooge (1970) · Dès 8 ans » — the age is never left blank (0 = « Tous publics »). */
export function versionEntryLabel(entry: VersionEntry): string {
  const year = yearOf(entry.releaseDate)
  const age = ageSentenceLabel(entry.expertAgeRec)
  const ageText = age ? (entry.isEnriched === false ? `${age} (à confirmer)` : age) : "Âge à confirmer"
  return `${entry.title}${year ? ` (${year})` : ""} · ${ageText}`
}

/**
 * Pure: heading + entries (deduplicated, sorted by release year, undated
 * last, at most MAX_VERSIONS). Null when there is nothing to show.
 */
export function buildVersionsBlock(currentTitle: string, entries: VersionEntry[]): VersionsBlock | null {
  const seen = new Set<string>()
  const unique = entries.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
  if (unique.length === 0) return null

  const items = unique
    .map((e) => ({ ...e, year: yearOf(e.releaseDate), label: versionEntryLabel(e) }))
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title, "fr"))
    .slice(0, MAX_VERSIONS)

  const key = workNameKey(currentTitle)
  const sameName = key !== "" && items.every((e) => workNameKey(e.title) === key)
  const name = currentTitle.replace(/\s*\([^)]*\)\s*$/, "").trim() || currentTitle.trim()
  return { heading: sameName ? `Autres versions de ${name}` : "Autres versions et suites", items }
}

const ENTRY_SELECT = {
  id: true,
  title: true,
  type: true,
  releaseDate: true,
  expertAgeRec: true,
  isEnriched: true,
} as const

/**
 * The fiche's editorial-cluster neighbours. Cached per request: the versions
 * block and the similar-titles rail (which excludes them) share one query.
 * Never throws — a failed lookup just hides the block.
 */
export const getEditorialClusterEntries = cache(async (mediaId: string): Promise<VersionEntry[]> => {
  try {
    const edges = await prisma.mediaSimilarity.findMany({
      where: {
        source: "EXPERT",
        reasons: { has: EDITORIAL_CLUSTER_REASON },
        OR: [{ mediaIdA: mediaId }, { mediaIdB: mediaId }],
      },
      select: {
        mediaIdA: true,
        mediaA: { select: ENTRY_SELECT },
        mediaB: { select: ENTRY_SELECT },
      },
      take: 50,
    })
    return edges.map((e) => {
      const other = e.mediaIdA === mediaId ? e.mediaB : e.mediaA
      return { ...other, type: other.type as string }
    })
  } catch (error) {
    console.error("[media-versions] lookup failed:", error)
    return []
  }
})

/** Ids of the cluster neighbours — for the similar-titles rail to skip. */
export async function getEditorialClusterIds(mediaId: string): Promise<Set<string>> {
  return new Set((await getEditorialClusterEntries(mediaId)).map((e) => e.id))
}

export async function getMediaVersions(mediaId: string, currentTitle: string): Promise<VersionsBlock | null> {
  return buildVersionsBlock(currentTitle, await getEditorialClusterEntries(mediaId))
}
