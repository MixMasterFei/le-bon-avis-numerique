import { prisma } from "@/lib/prisma"
import { ageSentenceLabel } from "@/lib/age-label"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"

/**
 * Works of the same type that share a fiche's exact title — Scrooge (1970)
 * and Scrooge (2026), three « Kraken », two « L'Odyssée ». Google sends the
 * searches for one to whichever ranks best: in Nov 2026, « scrooge 2026 »
 * queries landed on the 1970 fiche. The notice names each one with its year
 * and age so a parent can tell them apart and reach the right fiche.
 */

export interface Homonym {
  href: string
  label: string
}

export interface HomonymRow {
  id: string
  type: string
  title: string
  releaseDate: Date | string | null
  expertAgeRec: number | null
  isEnriched: boolean
}

function yearOf(date: Date | string | null): number | null {
  if (!date) return null
  const d = typeof date === "string" ? new Date(date) : date
  const y = d.getUTCFullYear()
  return Number.isFinite(y) ? y : null
}

/** « Scrooge (2026) · dès 8 ans (à confirmer) » — pure, for the tests. */
export function homonymLabel(row: HomonymRow, now: Date = new Date()): string {
  const year = yearOf(row.releaseDate)
  const name = year ? `${row.title} (${year})` : row.title
  const upcoming = row.releaseDate != null && new Date(row.releaseDate) > now
  const age = ageSentenceLabel(row.expertAgeRec)
  const parts = [name]
  if (upcoming) parts.push("à venir")
  if (age) {
    const lower = age.charAt(0).toLowerCase() + age.slice(1)
    parts.push(row.isEnriched ? lower : `${lower} (à confirmer)`)
  }
  return parts.join(" · ")
}

/**
 * Does another work of the same type carry this title (case- and accent-
 * insensitive: « L'Odyssée » = « L'ODYSSEE »)? Used by the SEO agent, which must put the release year in a
 * homonym's <title> (« Scrooge (1970) — … »). `null` = could not tell: the
 * caller must fail closed rather than write an ambiguous title.
 */
export async function hasHomonym(media: { id: string; type: string; title: string }): Promise<boolean | null> {
  const title = media.title.trim()
  if (!title) return false
  try {
    const rows = await prisma.$queryRaw<Array<{ one: number }>>`
      SELECT 1 AS one FROM media_items
      WHERE type::text = ${media.type}
        AND id <> ${media.id}
        AND unaccent(lower(btrim(title))) = unaccent(lower(${title}))
      LIMIT 1`
    return rows.length > 0
  } catch {
    // `unaccent` unavailable: fall back to the case-insensitive match
    // findHomonyms uses (misses accent-only variants, never invents one).
    try {
      const row = await prisma.mediaItem.findFirst({
        where: { type: media.type as never, id: { not: media.id }, title: { equals: title, mode: "insensitive" } },
        select: { id: true },
      })
      return row != null
    } catch {
      return null
    }
  }
}

/** Same type, same title (case-insensitive), another id; newest first. */
export async function findHomonyms(media: {
  id: string
  type: string
  title: string
}): Promise<Homonym[]> {
  const title = media.title.trim()
  if (!title) return []
  try {
    const rows = await prisma.mediaItem.findMany({
      where: {
        type: media.type as never,
        id: { not: media.id },
        title: { equals: title, mode: "insensitive" },
      },
      select: { id: true, type: true, title: true, releaseDate: true, expertAgeRec: true, isEnriched: true },
      orderBy: { releaseDate: { sort: "desc", nulls: "last" } },
      take: 5,
    })
    return rows.map((r) => ({
      href: `/media/${toMediaRouteId(r.type as MediaType, r.id)}`,
      label: homonymLabel(r),
    }))
  } catch {
    // A missing notice is harmless; a failing fiche is not.
    return []
  }
}
