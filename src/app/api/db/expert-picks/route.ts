import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { seededShuffle, getWeekSeed } from "@/lib/seeded-shuffle"

/**
 * Expert Picks endpoint — returns a curated mix of highly-rated,
 * family-friendly media across MOVIE, TV, and GAME types.
 *
 * Query params:
 *   limit  – number of items to return (default 6)
 *   seed   – shuffle seed (default: weekly seed). Pass a random number to reload.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "6")
  const seedParam = searchParams.get("seed")
  const seed = seedParam ? parseInt(seedParam) : getWeekSeed()
  const tenYearsAgo = new Date()
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)

  try {
    // Fetch a large pool of quality media, then shuffle & slice
    const poolSize = limit * 8

    const items = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: { in: ["MOVIE", "TV", "GAME"] },
          // Must have a real poster
          posterUrl: { not: null, startsWith: "http" },
          // Must be expert-reviewed and family-friendly (max 12+)
          expertAgeRec: { not: null, lte: 12 },
          // Minimum data completeness
          dataQualityScore: { gte: 50 },
          // Exclude horror/thriller/adult genres
          NOT: {
            genres: { hasSome: ["Horreur", "Horror", "Thriller", "Erotique", "Adult"] },
          },
          // Movies/TV need solid audience signal; games need stricter curation gates.
          OR: [
            {
              type: { in: ["MOVIE", "TV"] },
              tmdbRating: { gte: 7.0 },
              tmdbVoteCount: { gte: 50 },
            },
            {
              type: "GAME",
              dataQualityScore: { gte: 75 },
              releaseDate: { not: null, gte: tenYearsAgo },
            },
          ],
        },
        orderBy: [
          { tmdbRating: { sort: "desc", nulls: "last" } },
          { dataQualityScore: "desc" },
        ],
        take: poolSize,
        select: {
          id: true,
          title: true,
          originalTitle: true,
          type: true,
          posterUrl: true,
          genres: true,
          expertAgeRec: true,
          communityAgeRec: true,
          tmdbRating: true,
          dataQualityScore: true,
          releaseDate: true,
        },
      })
    )

    // Shuffle only the top-ranked slice to keep quality high while still rotating weekly.
    const topPoolSize = Math.max(limit * 3, limit)
    const topPool = items.slice(0, topPoolSize)
    const shuffled = seededShuffle(topPool, seed)
    const maxPerType = Math.ceil(limit / 2)
    const requiredTypes = ["MOVIE", "TV"]

    // Step 1: Guarantee at least 1 of each type
    const picked: typeof items = []
    const pickedIds = new Set<string>()
    for (const type of requiredTypes) {
      const first = shuffled.find((i) => i.type === type && !pickedIds.has(i.id))
      if (first) {
        picked.push(first)
        pickedIds.add(first.id)
      }
    }

    // Step 2: Fill remaining slots, capping each type at maxPerType
    const typeCounts: Record<string, number> = {}
    for (const item of picked) {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1
    }
    for (const item of shuffled) {
      if (picked.length >= limit) break
      if (pickedIds.has(item.id)) continue
      const count = typeCounts[item.type] || 0
      if (count >= maxPerType) continue
      typeCounts[item.type] = count + 1
      picked.push(item)
      pickedIds.add(item.id)
    }

    // Step 3: If still not full, fill from any remaining
    for (const item of shuffled) {
      if (picked.length >= limit) break
      if (!pickedIds.has(item.id)) {
        picked.push(item)
        pickedIds.add(item.id)
      }
    }

    const transformed = picked.map((item) => ({
      id: item.id,
      title: item.title,
      originalTitle: item.originalTitle,
      type: item.type,
      posterUrl: item.posterUrl,
      genres: item.genres,
      expertAgeRec: item.expertAgeRec,
      communityAgeRec: item.communityAgeRec,
      tmdbRating: item.tmdbRating,
      dataQualityScore: item.dataQualityScore,
      releaseDate: item.releaseDate?.toISOString().split("T")[0] || null,
    }))

    return NextResponse.json({ items: transformed, seed })
  } catch (error) {
    console.error("Expert picks error:", error)
    return NextResponse.json(
      { error: "Failed to fetch expert picks" },
      { status: 500 }
    )
  }
}
