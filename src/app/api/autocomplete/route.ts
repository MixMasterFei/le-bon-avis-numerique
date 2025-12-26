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
    // Search in database for matching titles
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
