/**
 * "Bientôt" — titles that are not out yet.
 *
 * Extracted from /api/db/upcoming so the homepage rail and a composed
 * /decouverte board run the SAME selection. The age cap below is a safety
 * gate, not a preference, and duplicating it was the risk worth removing.
 */
import { prisma } from "@/lib/prisma"
import { UNRELEASED_TMDB_STATUSES } from "@/lib/release-status"
import { getUpcomingCinemaMovies } from "@/lib/cinema"
import type { UpcomingItem } from "@/components/home-redesign/UpcomingCard"

export const UPCOMING_LIMIT = 12

// Candidates fetched per source BEFORE the family age cap is applied. The age
// filter below can legitimately reject most of a soonest-first slice (a family
// capped at 10 keeps roughly one theatrical release in six), so cutting at
// `limit` first left the rail with two cards. Over-fetch, then filter, then cut.
const CANDIDATE_FACTOR = 6

export async function getUpcomingItems(
  maxAge: number | null,
  limit: number = UPCOMING_LIMIT,
): Promise<UpcomingItem[]> {
  const now = new Date()
  const pool = limit * CANDIDATE_FACTOR

  const [movies, otherRows] = await Promise.all([
    // Movies: authoritative French-theatrical upcoming list (TMDB
    // upcoming?region=FR minus what's already now-playing). NOT the stored
    // primary release_date, which can sit in the future for a film already in
    // cinemas and would wrongly show it as "à venir".
    getUpcomingCinemaMovies(pool).catch(() => []),
    // TV + games: a single, unambiguous release date (no theatrical /
    // now-playing split), so the stored future-date filter is reliable here.
    prisma.mediaItem
      .findMany({
        where: {
          posterUrl: { not: null, startsWith: "http" },
          type: { in: ["TV", "GAME"] },
          OR: [
            { releaseDate: { gt: now } },
            { AND: [{ releaseDate: null }, { releaseStatus: { in: [...UNRELEASED_TMDB_STATUSES] } }] },
          ],
        },
        select: {
          id: true, type: true, title: true, posterUrl: true,
          expertAgeRec: true, genres: true, releaseDate: true,
        },
        orderBy: { releaseDate: "asc" },
        take: pool,
      })
      .catch(() => []),
  ])

  const movieItems: UpcomingItem[] = movies.map((m) => ({
    id: m.id,
    type: m.type as UpcomingItem["type"],
    title: m.title,
    posterUrl: m.posterUrl,
    expertAgeRec: m.expertAgeRec,
    genres: m.genres ?? [],
    releaseDate: m.releaseDate,
  }))

  const otherItems: UpcomingItem[] = otherRows.map((m) => ({
    id: m.id,
    type: m.type as UpcomingItem["type"],
    title: m.title,
    posterUrl: m.posterUrl,
    // Provisional estimate only — the card badges it "à confirmer" and shows
    // no content totem (we don't score unseen titles).
    expertAgeRec: m.expertAgeRec,
    genres: m.genres ?? [],
    releaseDate: m.releaseDate ? m.releaseDate.toISOString() : null,
  }))

  // Family age cap. Upcoming titles have no ContentMetrics, so neither the
  // score filter nor the card blur can protect a young visitor — the age cap is
  // the ONLY gate. Drop anything above it AND anything with no age at all (an
  // unrated "coming soon" can't be shown safely in a family rail). Applied
  // AFTER the merge so it also covers the off-DB TMDB cinema candidates.
  return [...movieItems, ...otherItems]
    // A card with no artwork reads as a broken tile on this rail, and the
    // candidate pool above is deep enough to simply skip those.
    .filter((m) => typeof m.posterUrl === "string" && m.posterUrl.startsWith("http"))
    .filter((m) => (maxAge === null ? true : typeof m.expertAgeRec === "number" && m.expertAgeRec <= maxAge))
    .sort((a, b) => {
      if (!a.releaseDate) return 1
      if (!b.releaseDate) return -1
      return a.releaseDate.localeCompare(b.releaseDate)
    })
    .slice(0, limit)
}
