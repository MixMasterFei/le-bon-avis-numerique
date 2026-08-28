import { NextRequest, NextResponse } from "next/server"
import { getWeekSeed } from "@/lib/seeded-shuffle"
import { getExpertPicks } from "@/lib/expert-picks"

/**
 * Expert Picks endpoint — returns a curated mix of highly-rated,
 * family-friendly media across MOVIE, TV, and GAME types.
 *
 * Selection logic lives in `@/lib/expert-picks` (shared with the homepage
 * hero, which renders the picks server-side).
 *
 * Query params:
 *   limit  – number of items to return (default 6)
 *   seed   – shuffle seed (default: weekly seed). Pass a random number to reload.
 *   maxAge – age cap (default 12)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "6")
  const seedParam = searchParams.get("seed")
  const seed = seedParam ? parseInt(seedParam) : getWeekSeed()
  const maxAgeParam = searchParams.get("maxAge")
  const parsedMaxAge = maxAgeParam ? parseInt(maxAgeParam) : NaN

  try {
    const items = await getExpertPicks({
      limit,
      seed,
      maxAge: Number.isFinite(parsedMaxAge) ? parsedMaxAge : undefined,
    })
    // CDN-cacheable — the re-roll seed is a query param, so each roll is its
    // own cache entry and « Recharger » still works.
    return NextResponse.json({ items, seed }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } })
  } catch (error) {
    console.error("Expert picks error:", error)
    return NextResponse.json(
      { error: "Failed to fetch expert picks" },
      { status: 500 }
    )
  }
}
