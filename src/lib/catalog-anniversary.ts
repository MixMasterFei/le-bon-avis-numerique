import { prisma } from "@/lib/prisma"

export interface CatalogAnniversary {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  yearsAgo: number
  releaseYear: number
}

/**
 * Picks one notable media item that was released on this same calendar
 * day, ≥10 years ago. Drives a "Il y a X ans aujourd'hui sortait …"
 * sidebar widget. Sorted by tmdbVoteCount so we surface a recognizable
 * title (no obscure straight-to-DVD).
 *
 * Returns null when nothing in the catalog matches today's date — the
 * widget then hides itself.
 */
export async function getCatalogAnniversary(): Promise<CatalogAnniversary | null> {
  const now = new Date()
  const month = now.getMonth() + 1   // 1-12
  const day = now.getDate()           // 1-31

  // Window: titles released on this calendar day, between 10 and 50
  // years ago (recent enough to feel "I know that", old enough to
  // feel like nostalgia).
  const cutoffOldest = new Date(now.getFullYear() - 50, month - 1, day)
  const cutoffNewest = new Date(now.getFullYear() - 10, month - 1, day, 23, 59, 59)

  // Postgres EXTRACT for month/day match — let the DB do the filtering
  // rather than scanning every release date in JS.
  const rows = await prisma.$queryRaw<
    Array<{
      id: string
      type: string
      title: string
      poster_url: string | null
      release_date: Date
      tmdb_vote_count: number | null
    }>
  >`
    SELECT id, type, title, poster_url, release_date, tmdb_vote_count
    FROM media_items
    WHERE release_date BETWEEN ${cutoffOldest} AND ${cutoffNewest}
      AND EXTRACT(MONTH FROM release_date) = ${month}
      AND EXTRACT(DAY FROM release_date) = ${day}
      AND type IN ('MOVIE', 'TV', 'GAME')
      AND poster_url IS NOT NULL
      AND tmdb_vote_count >= 100
    ORDER BY tmdb_vote_count DESC NULLS LAST
    LIMIT 5
  `

  if (rows.length === 0) return null

  // Among the top 5, pick deterministically per-day so the widget
  // doesn't flicker on revalidation. Day-of-year as the seed.
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000)
  const pick = rows[dayOfYear % rows.length]

  return {
    id: pick.id,
    type: pick.type as CatalogAnniversary["type"],
    title: pick.title,
    posterUrl: pick.poster_url,
    releaseYear: pick.release_date.getFullYear(),
    yearsAgo: now.getFullYear() - pick.release_date.getFullYear(),
  }
}
