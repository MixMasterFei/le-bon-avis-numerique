import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { UNRELEASED_TMDB_STATUSES } from "@/lib/release-status"

// Upcoming / not-yet-released titles for the homepage "Bientôt" rail.
// Read-only; short cache like /api/cinema.
export const revalidate = 3600

export async function GET() {
  try {
    const now = new Date()
    const items = await prisma.mediaItem.findMany({
      where: {
        posterUrl: { not: null, startsWith: "http" },
        type: { in: ["MOVIE", "TV", "GAME"] },
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
      take: 12,
    })

    return NextResponse.json(
      {
        items: items.map((m) => ({
          id: m.id,
          type: m.type,
          title: m.title,
          posterUrl: m.posterUrl,
          // Provisional estimate only — the card badges it "à confirmer" and
          // shows no content totem (we don't score unseen titles).
          expertAgeRec: m.expertAgeRec,
          genres: m.genres ?? [],
          releaseDate: m.releaseDate ? m.releaseDate.toISOString() : null,
        })),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
    )
  } catch (error) {
    console.error("Upcoming API error:", error)
    return NextResponse.json({ items: [] }, { status: 500 })
  }
}
