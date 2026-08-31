import { NextResponse } from "next/server"
import { getUpcomingItems, UPCOMING_LIMIT } from "@/lib/upcoming"

// Upcoming / not-yet-released titles for the homepage "Bientôt" rail.
// Read-only; short cache like /api/cinema. The selection itself lives in
// @/lib/upcoming so the composed /decouverte board uses the same one.
//
// force-dynamic, NOT `revalidate`: this handler reads request.url (the
// ?maxAge param), so it can never be prerendered — `revalidate` made the
// build try anyway, and Next's DYNAMIC_SERVER_USAGE bail-out landed in the
// catch below, baking an empty 500 into the build ("Upcoming API error" in
// the Vercel log). Caching is handled by the CDN s-maxage header on the
// response instead, same pattern as /api/cinema.
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const maxAgeParam = new URL(request.url).searchParams.get("maxAge")
    const maxAge =
      maxAgeParam !== null && Number.isFinite(Number(maxAgeParam)) ? Number(maxAgeParam) : null

    const items = await getUpcomingItems(maxAge, UPCOMING_LIMIT)

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
    )
  } catch (error) {
    console.error("Upcoming API error:", error)
    return NextResponse.json({ items: [] }, { status: 500 })
  }
}
