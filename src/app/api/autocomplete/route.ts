import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sanitizeSearchQuery } from "@/lib/security"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const rawQuery = sp.get("q")

  if (!rawQuery || rawQuery.trim().length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const query = sanitizeSearchQuery(rawQuery)
  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    // Strip non-alphanumeric chars for fuzzy matching (e.g. "wall-e" matches "WALL·E")
    const normalizedQuery = query.replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase()

    // First: standard Prisma contains search
    const results = await prisma.mediaItem.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { originalTitle: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
        releaseDate: true,
        expertAgeRec: true,
      },
      take: 8,
      orderBy: { title: "asc" },
    })

    // Second: if few results, try normalized search via raw SQL
    // This catches cases like "wall-e" → "WALL·E" where special chars differ
    if (results.length < 4 && normalizedQuery.length >= 2) {
      const fuzzyResults = await prisma.$queryRaw<Array<{
        id: string
        title: string
        type: string
        poster_url: string | null
        release_date: Date | null
        expert_age_rec: number | null
      }>>`
        SELECT id, title, type, poster_url, release_date, expert_age_rec
        FROM media_items
        WHERE LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9 ]', '', 'g')) LIKE ${'%' + normalizedQuery + '%'}
           OR LOWER(REGEXP_REPLACE(COALESCE(original_title, ''), '[^a-zA-Z0-9 ]', '', 'g')) LIKE ${'%' + normalizedQuery + '%'}
        LIMIT 8
      `

      const existingIds = new Set(results.map(r => r.id))
      for (const row of fuzzyResults) {
        if (!existingIds.has(row.id)) {
          results.push({
            id: row.id,
            title: row.title,
            type: row.type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP",
            posterUrl: row.poster_url,
            releaseDate: row.release_date,
            expertAgeRec: row.expert_age_rec,
          })
        }
      }
    }

    const suggestions = results.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      posterUrl: item.posterUrl,
      year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : null,
      ageRec: item.expertAgeRec,
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Autocomplete error:", error)
    return NextResponse.json({ suggestions: [] })
  }
}
