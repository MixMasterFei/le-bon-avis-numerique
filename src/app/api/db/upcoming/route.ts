import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UNRELEASED_TMDB_STATUSES } from "@/lib/release-status"
import { getUpcomingCinemaMovies } from "@/lib/cinema"

// Upcoming / not-yet-released titles for the homepage "Bientôt" rail.
// Read-only; short cache like /api/cinema.
//
// force-dynamic, NOT `revalidate`: this handler reads request.url (the
// ?maxAge param), so it can never be prerendered — `revalidate` made the
// build try anyway, and Next's DYNAMIC_SERVER_USAGE bail-out landed in the
// catch below, baking an empty 500 into the build ("Upcoming API error" in
// the Vercel log). Caching is handled by the CDN s-maxage header on the
// response instead, same pattern as /api/cinema.
export const dynamic = "force-dynamic"

const LIMIT = 12

export async function GET(request: Request) {
  try {
    const maxAgeParam = new URL(request.url).searchParams.get("maxAge")
    const maxAge =
      maxAgeParam !== null && Number.isFinite(Number(maxAgeParam)) ? Number(maxAgeParam) : null
    const now = new Date()
    const [movies, otherRows] = await Promise.all([
      // Movies: authoritative French-theatrical upcoming list (TMDB
      // upcoming?region=FR minus what's already now-playing). NOT the stored
      // primary release_date, which can sit in the future for a film already in
      // cinemas and would wrongly show it as "à venir".
      getUpcomingCinemaMovies(LIMIT).catch(() => []),
      // TV + games: a single, unambiguous release date (no theatrical / now-playing
      // split), so the stored future-date filter is reliable for these.
      prisma.mediaItem
        .findMany({
          where: {
            posterUrl: { not: null, startsWith: "http" },
            type: { in: ["TV", "GAME"] },
            // Not out yet: a future release date, OR flagged unreleased by TMDB
            // status with no date yet. Past-dated rows are excluded.
            OR: [
              { releaseDate: { gt: now } },
              { AND: [{ releaseDate: null }, { releaseStatus: { in: [...UNRELEASED_TMDB_STATUSES] } }] },
            ],
          },
          select: {
            id: true,
            type: true,
            title: true,
            posterUrl: true,
            expertAgeRec: true,
            genres: true,
            releaseDate: true,
          },
          orderBy: { releaseDate: "asc" }, // soonest first; null dates last
          take: LIMIT,
        })
        .catch(() => []),
    ])

    const movieItems = movies.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      posterUrl: m.posterUrl,
      expertAgeRec: m.expertAgeRec,
      genres: m.genres ?? [],
      releaseDate: m.releaseDate, // YYYY-MM-DD (FR theatrical)
    }))

    const otherItems = otherRows.map((m) => ({
      id: m.id,
      type: m.type,
      title: m.title,
      posterUrl: m.posterUrl,
      // Provisional estimate only — the card badges it "à confirmer" and shows
      // no content totem (we don't score unseen titles).
      expertAgeRec: m.expertAgeRec,
      genres: m.genres ?? [],
      releaseDate: m.releaseDate ? m.releaseDate.toISOString() : null,
    }))

    // Family age cap. Upcoming titles have no ContentMetrics, so neither the
    // score filter nor the card blur can protect a young visitor — the age cap
    // is the ONLY gate. Drop anything above the cap AND anything with no age at
    // all (an unrated "coming soon" can't be shown safely in a family rail).
    // Applied AFTER the merge so it also covers the off-DB TMDB cinema
    // candidates (their ages are provisional genre estimates), not just the
    // stored TV/GAME rows.
    const merged = [...movieItems, ...otherItems].filter((m) =>
      maxAge === null ? true : typeof m.expertAgeRec === "number" && m.expertAgeRec <= maxAge,
    )

    // Merge and order by soonest release; unknown dates sink to the end.
    const items = merged
      .sort((a, b) => {
        if (!a.releaseDate) return 1
        if (!b.releaseDate) return -1
        return a.releaseDate.localeCompare(b.releaseDate)
      })
      .slice(0, LIMIT)

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
    )
  } catch (error) {
    console.error("Upcoming API error:", error)
    return NextResponse.json({ items: [] }, { status: 500 })
  }
}
