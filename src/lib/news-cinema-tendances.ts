import { getNowPlayingMovies, getImageUrl, ImageSize } from "@/lib/tmdb"
import { prisma } from "@/lib/prisma"

/**
 * Pulls 4 family-friendly movies currently in French theaters for the
 * news page sidebar. Replaces the meta-stats widget ("33 actualités
 * publiées") with something tied to the catalog — concrete real-world
 * info for parents.
 *
 * Ranking:
 *   1. Has expertAgeRec ≤ 12 (in our DB, family-friendly)
 *   2. Highest TMDB popularity (i.e. order from now_playing endpoint)
 *
 * Falls back gracefully — if TMDB or the DB is down, returns []. The
 * sidebar component hides itself when the array is empty.
 */

export interface CinemaTendance {
  id: string                   // DB id when matched, "tmdb-<id>" otherwise
  tmdbId: number
  title: string
  posterUrl: string | null
  expertAgeRec: number | null  // null when not yet in our DB
  inDatabase: boolean
}

const MAX_RESULTS = 4
// Filter cap: if expertAgeRec exists, must be ≤ this. Movies without
// a rating in our DB still show — we don't punish "unknown", just
// hide stuff we know is too mature for the news-page audience.
const MAX_AGE_REC = 12

export async function getCinemaTendances(): Promise<CinemaTendance[]> {
  try {
    const tmdbResult = await getNowPlayingMovies(1)
    const tmdbMovies = (tmdbResult.results ?? []).filter((m) => {
      // European languages only — same filter as /api/cinema route.
      const lang = m.original_language
      return ["fr", "en", "es", "it", "de", "pt", "nl"].includes(lang)
    })
    if (tmdbMovies.length === 0) return []

    const tmdbIds = tmdbMovies.map((m) => m.id)
    let dbRows: Array<{
      tmdbId: number | null
      id: string
      posterUrl: string | null
      expertAgeRec: number | null
    }> = []
    try {
      dbRows = await prisma.mediaItem.findMany({
        where: { tmdbId: { in: tmdbIds }, type: "MOVIE" },
        select: { tmdbId: true, id: true, posterUrl: true, expertAgeRec: true },
      })
    } catch {
      // DB blip — fall back to TMDB-only metadata.
    }
    const byTmdbId = new Map(dbRows.filter((r) => r.tmdbId !== null).map((r) => [r.tmdbId!, r]))

    const merged: CinemaTendance[] = tmdbMovies
      .map((m) => {
        const db = byTmdbId.get(m.id)
        return {
          id: db?.id ?? `tmdb-${m.id}`,
          tmdbId: m.id,
          title: m.title,
          posterUrl:
            db?.posterUrl ?? getImageUrl(m.poster_path, ImageSize.poster.medium),
          expertAgeRec: db?.expertAgeRec ?? null,
          inDatabase: !!db,
        }
      })
      // Drop adult-rated titles when we know the rating; keep unknowns
      // (they may turn out family-friendly once enriched).
      .filter((t) => t.expertAgeRec === null || t.expertAgeRec <= MAX_AGE_REC)
      // Drop posterless entries — the widget is poster-driven.
      .filter((t) => !!t.posterUrl)

    return merged.slice(0, MAX_RESULTS)
  } catch (err) {
    console.warn("[news-cinema-tendances] fetch failed:", err)
    return []
  }
}
