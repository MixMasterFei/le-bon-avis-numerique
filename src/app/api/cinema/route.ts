import { NextResponse } from "next/server"
import { getCinemaMovies } from "@/lib/cinema"

/**
 * GET /api/cinema
 *
 * Returns movies currently playing in French theaters.
 * Uses TMDB's now_playing endpoint (region=FR) as the source of truth,
 * then enriches with our DB data (expert age recommendations, etc.).
 * Falls back to TMDB-only data for movies not yet in our DB.
 */
function parseAge(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : undefined
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams
    const movies = await getCinemaMovies({
      minAge: parseAge(searchParams.get("minAge")),
      maxAge: parseAge(searchParams.get("maxAge")),
      // Homepage passes ?safe=1 to drop horror from the family front page. The
      // full /films?sort=cinema listing calls getCinemaMovies directly without
      // it, so it stays complete.
      familySafe: searchParams.get("safe") === "1",
    })

    return NextResponse.json(
      { movies },
      {
        headers: {
          // 30 min CDN cache (was 1h) - TMDB updates now_playing
          // throughout the day as theatrical releases shift, and
          // users perceive the homepage section as stale at the 1h
          // mark. SWR window stays at 1h for graceful degradation.
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    )
  } catch (error) {
    console.error("Cinema API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch now playing movies" },
      { status: 500 },
    )
  }
}
