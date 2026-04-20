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
    // Fetch a large pool — most movies share the same DQS so we need
    // enough candidates for the JS scoring pass to pick from.
    const poolSize = 300

    const items = await withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          posterUrl: { not: null, startsWith: "http" },
          NOT: {
            genres: { hasSome: ["Horreur", "Horror", "Thriller", "Erotique", "Adult"] },
          },
          OR: [
            {
              // Movies/TV: hard TMDB quality gate so hero cards always
              // read as well-received titles (not niche or unrated).
              // Thresholds are intentionally stricter than the site-wide
              // "Featured" bar (6.5 / 200) since these cards are the
              // face of the aperçu page.
              type: { in: ["MOVIE", "TV"] },
              dataQualityScore: { gte: 70 },
              expertAgeRec: { not: null, lte: 12 },
              originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt"] },
              tmdbRating: { gte: 7.0 },
              tmdbVoteCount: { gte: 500 },
            },
            {
              // Games stay on a dataQualityScore gate — IGDB's ratings
              // aren't stored in tmdbRating, so applying the TMDB filter
              // would wipe every game from the pool.
              type: "GAME",
              expertAgeRec: { not: null, lte: 12 },
              dataQualityScore: { gte: 75 },
              releaseDate: { not: null, gte: tenYearsAgo },
            },
          ],
        },
        orderBy: { dataQualityScore: "desc" },
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
          contentMetrics: {
            select: {
              toneTags: true,
              pacing: true,
              enrichmentSource: true,
              // Required so ApercuMediaCard's shouldBlurMedia check has
              // real values to compare against the 15+ / metric ≥ 3
              // trigger. Without these, 15+ posters render crisp.
              violence: true,
              sexNudity: true,
              language: true,
              substanceUse: true,
            },
          },
        },
      })
    )

    // ── Rank items by "pick-worthiness" ──
    // Without TMDB popularity data, we use available signals to prefer
    // recognizable, mainstream, family-friendly content.
    const familyGenres = new Set([
      "Animation", "Familial", "Family", "Aventure", "Adventure",
      "Comédie", "Comedy", "Kids", "Fantastique", "Fantasy",
    ])
    const now = new Date()
    const currentYear = now.getFullYear()

    function pickScore(item: (typeof items)[0]): number {
      let score = 0

      // Recent releases are more recognizable (max +5)
      if (item.releaseDate) {
        const year = item.releaseDate.getFullYear()
        if (year >= currentYear - 5) score += 5
        else if (year >= currentYear - 15) score += 4
        else if (year >= currentYear - 25) score += 3
        else if (year >= currentYear - 40) score += 1
        // Very old (pre-1986) = 0
      }

      // Family-friendly genres boost (max +4)
      const genreHits = item.genres.filter((g) => familyGenres.has(g)).length
      score += Math.min(genreHits, 4)

      // Universally accessible age = better for "expert pick" showcase
      if (item.expertAgeRec !== null) {
        if (item.expertAgeRec <= 6) score += 2
        else if (item.expertAgeRec <= 10) score += 1
      }

      // TMDB rating if available (rare but valuable)
      if (item.tmdbRating && item.tmdbRating >= 7) score += 3

      return score
    }

    // Score and sort — highest-scoring items first
    const scored = items
      .map((item) => ({ item, score: pickScore(item) }))
      .sort((a, b) => b.score - a.score)

    // Take the top-scoring slice, then shuffle for weekly variety
    const topPoolSize = Math.min(limit * 5, scored.length)
    const topPool = scored.slice(0, topPoolSize).map((s) => s.item)
    const shuffled = seededShuffle(topPool, seed)
    const maxPerType: Record<string, number> = {
      MOVIE: Math.max(2, Math.ceil(limit / 2)),
      TV: Math.max(1, Math.ceil(limit / 3)),
      GAME: 1,
    }
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
      const typeCap = maxPerType[item.type] ?? limit
      if (count >= typeCap) continue
      typeCounts[item.type] = count + 1
      picked.push(item)
      pickedIds.add(item.id)
    }

    // Step 3a: If still not full, prefer MOVIE/TV from remaining pool
    for (const item of shuffled) {
      if (picked.length >= limit) break
      if (pickedIds.has(item.id)) continue
      if (item.type === "GAME") continue
      picked.push(item)
      pickedIds.add(item.id)
    }

    // Step 3b: If still not full, fill from any remaining (including games)
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
      toneTags: item.contentMetrics?.toneTags || [],
      pacing: item.contentMetrics?.pacing || null,
      contentMetrics: item.contentMetrics
        ? {
            violence: item.contentMetrics.violence,
            sexNudity: item.contentMetrics.sexNudity,
            language: item.contentMetrics.language,
            substanceUse: item.contentMetrics.substanceUse,
          }
        : null,
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
