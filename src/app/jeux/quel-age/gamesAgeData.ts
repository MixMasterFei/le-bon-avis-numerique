import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { TOP_GAMES, type TopGameSeed } from "./topGames.data"

// Shared server-side data source for the games "quel âge" pillar: used by the
// HTML page (page.tsx) AND its Markdown mirror (/md/jeux/quel-age), so both
// surfaces always present the same rows with the same verdicts.

export type GameRow = {
  seed: TopGameSeed
  id: string
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  officialRating: string | null
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
  } | null
  /** Custom FAQ answer override from seed (if present). */
  customFaqAnswer?: string
}

// Look each curated title up in the catalogue. Only enriched games with a
// poster and an age recommendation qualify (the fiche they link to must be
// worth landing on). A single OR query, then attribute each result to the
// best-matching seed by title fragment — highest data quality wins.
// Seeds with `forcedId` bypass alias matching and fetch that exact game.
export async function fetchTopGameRows(): Promise<GameRow[]> {
  // Separate seeds with forced IDs from those needing alias lookup.
  const forcedSeeds = TOP_GAMES.filter((g) => g.forcedId)
  const aliasSeeds = TOP_GAMES.filter((g) => !g.forcedId)

  // Fetch forced-ID games directly.
  const forcedIds = forcedSeeds.map((g) => g.forcedId!)
  const forcedMatches =
    forcedIds.length > 0
      ? await withPrismaRetry(() =>
          prisma.mediaItem.findMany({
            where: {
              id: { in: forcedIds },
              type: "GAME",
            },
            select: {
              id: true,
              title: true,
              posterUrl: true,
              expertAgeRec: true,
              officialRating: true,
              dataQualityScore: true,
              contentMetrics: {
                select: {
                  violence: true,
                  sexNudity: true,
                  language: true,
                  consumerism: true,
                  substanceUse: true,
                  positiveMessages: true,
                  roleModels: true,
                },
              },
            },
          }),
        )
      : []
  const forcedById = new Map(forcedMatches.map((m) => [m.id, m]))

  // Fetch alias-matched games.
  const orClauses = aliasSeeds.flatMap((g) =>
    g.aliases.map((a) => ({ title: { contains: a, mode: "insensitive" as const } })),
  )

  const aliasMatches =
    orClauses.length > 0
      ? await withPrismaRetry(() =>
          prisma.mediaItem.findMany({
            where: {
              type: "GAME",
              isEnriched: true,
              posterUrl: { not: null },
              expertAgeRec: { not: null },
              OR: orClauses,
            },
            select: {
              id: true,
              title: true,
              posterUrl: true,
              expertAgeRec: true,
              officialRating: true,
              dataQualityScore: true,
              contentMetrics: {
                select: {
                  violence: true,
                  sexNudity: true,
                  language: true,
                  consumerism: true,
                  substanceUse: true,
                  positiveMessages: true,
                  roleModels: true,
                },
              },
            },
            take: 300,
          }),
        )
      : []

  const rows: GameRow[] = []
  const usedIds = new Set<string>()

  for (const seed of TOP_GAMES) {
    if (seed.forcedId) {
      const match = forcedById.get(seed.forcedId)
      if (!match) continue
      usedIds.add(match.id)
      rows.push({
        seed,
        id: match.id,
        title: match.title,
        posterUrl: match.posterUrl,
        expertAgeRec: match.expertAgeRec,
        officialRating: match.officialRating,
        contentMetrics: match.contentMetrics,
        customFaqAnswer: seed.customFaqAnswer,
      })
    } else {
      const candidates = aliasMatches
        .filter((m) => {
          if (usedIds.has(m.id)) return false
          const t = m.title.toLowerCase()
          return seed.aliases.some((a) => t.includes(a))
        })
        .sort((a, b) => b.dataQualityScore - a.dataQualityScore)

      const best = candidates[0]
      if (!best) continue
      usedIds.add(best.id)
      rows.push({
        seed,
        id: best.id,
        title: best.title,
        posterUrl: best.posterUrl,
        expertAgeRec: best.expertAgeRec,
        officialRating: best.officialRating,
        contentMetrics: best.contentMetrics,
        customFaqAnswer: seed.customFaqAnswer,
      })
    }
  }

  return rows
}
