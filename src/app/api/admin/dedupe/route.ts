import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { applyContentSafetyFloors } from "@/lib/content-safety-floors"

// Deduplicate games by title - merge multiple entries into one
// This handles cases where IGDB returns different entries for the same game on different platforms

interface DedupeResult {
  checked: number
  merged: number
  deleted: number
  details: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dryRun = true } = body

    const result: DedupeResult = {
      checked: 0,
      merged: 0,
      deleted: 0,
      details: [],
    }

    // Find duplicate games by title (case-insensitive). Include contentMetrics
    // so the merged row can be re-floored on its real content axes.
    const games = await prisma.mediaItem.findMany({
      where: { type: "GAME" },
      include: { contentMetrics: true },
      orderBy: [
        { title: "asc" },
        { createdAt: "asc" }, // Keep the oldest entry as primary
      ],
    })

    result.checked = games.length

    // Group games by normalized title
    const gamesByTitle = new Map<string, typeof games>()
    for (const game of games) {
      const normalizedTitle = normalizeTitle(game.title)
      const existing = gamesByTitle.get(normalizedTitle) || []
      existing.push(game)
      gamesByTitle.set(normalizedTitle, existing)
    }

    // Process duplicates
    for (const [, duplicates] of gamesByTitle) {
      if (duplicates.length <= 1) continue

      const primary = duplicates[0] // Keep the first (oldest) entry
      const toMerge = duplicates.slice(1)

      // Merge platforms from all duplicates
      const allPlatforms = new Set<string>()
      for (const game of duplicates) {
        game.platforms.forEach((p) => allPlatforms.add(p))
      }

      // Merge genres from all duplicates
      const allGenres = new Set<string>()
      for (const game of duplicates) {
        game.genres.forEach((g) => allGenres.add(g))
      }

      // Merge topics from all duplicates
      const allTopics = new Set<string>()
      for (const game of duplicates) {
        game.topics.forEach((t) => allTopics.add(t))
      }

      // Use the best synopsis (longest non-null one)
      let bestSynopsis = primary.synopsisFr
      for (const game of duplicates) {
        if (game.synopsisFr && (!bestSynopsis || game.synopsisFr.length > bestSynopsis.length)) {
          bestSynopsis = game.synopsisFr
        }
      }

      // Use the best poster (first non-null one)
      let bestPoster = primary.posterUrl
      for (const game of duplicates) {
        if (game.posterUrl && game.posterUrl !== "/placeholder-game.jpg") {
          bestPoster = game.posterUrl
          break
        }
      }

      // Use the earliest release date
      let earliestRelease = primary.releaseDate
      for (const game of duplicates) {
        if (game.releaseDate && (!earliestRelease || game.releaseDate < earliestRelease)) {
          earliestRelease = game.releaseDate
        }
      }

      // Use the SAFEST age recommendation (HIGHEST non-null) across duplicates.
      // Taking the lowest used to silently degrade a correctly-floored horror
      // duplicate (14) down to a stale one (10) — the exact class of bug from
      // the 2026-07-11 incident. The merged row is then re-floored below.
      let bestAge = primary.expertAgeRec
      for (const game of duplicates) {
        if (game.expertAgeRec !== null) {
          if (bestAge === null || game.expertAgeRec > bestAge) {
            bestAge = game.expertAgeRec
          }
        }
      }

      // Re-run the deterministic safety floor on the merged row: the unioned
      // topics (the reliable "Horreur" signal), primary's official PEGI rating
      // + descriptors, and its content axes must all be honored on the survivor.
      const mergedTopics = Array.from(allTopics)
      if (bestAge !== null) {
        bestAge = applyContentSafetyFloors({
          expertAgeRec: bestAge,
          metrics: primary.contentMetrics ?? { violence: 0, sexNudity: 0, language: 0, substanceUse: 0 },
          genres: Array.from(allGenres),
          topics: mergedTopics,
          type: primary.type,
          officialRating: primary.officialRating,
          pegiDescriptors: primary.pegiDescriptors,
        }).expertAgeRec
      }

      const mergeInfo = `"${primary.title}" (${toMerge.length} duplicates) -> platforms: ${Array.from(allPlatforms).join(", ")}`
      result.details.push(mergeInfo)

      if (!dryRun) {
        // Update the primary entry with merged data
        await prisma.mediaItem.update({
          where: { id: primary.id },
          data: {
            platforms: Array.from(allPlatforms),
            genres: Array.from(allGenres),
            topics: mergedTopics,
            synopsisFr: bestSynopsis,
            posterUrl: bestPoster,
            releaseDate: earliestRelease,
            expertAgeRec: bestAge,
          },
        })

        // Delete the duplicate entries
        for (const dup of toMerge) {
          // First delete related content metrics
          await prisma.contentMetrics.deleteMany({
            where: { mediaId: dup.id },
          })
          // Then delete the media item
          await prisma.mediaItem.delete({
            where: { id: dup.id },
          })
          result.deleted++
        }
      }

      result.merged++
    }

    return NextResponse.json({
      success: true,
      dryRun,
      result,
      message: dryRun
        ? "Dry run complete. Set dryRun: false to actually merge."
        : `Merged ${result.merged} groups, deleted ${result.deleted} duplicate entries.`,
    })
  } catch (error) {
    console.error("Dedupe error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deduplication failed" },
      { status: 500 }
    )
  }
}

// GET to check for duplicates without making changes
export async function GET() {
  const games = await prisma.mediaItem.findMany({
    where: { type: "GAME" },
    select: { id: true, title: true, platforms: true },
    orderBy: { title: "asc" },
  })

  // Group by normalized title
  const gamesByTitle = new Map<string, typeof games>()
  for (const game of games) {
    const normalizedTitle = normalizeTitle(game.title)
    const existing = gamesByTitle.get(normalizedTitle) || []
    existing.push(game)
    gamesByTitle.set(normalizedTitle, existing)
  }

  // Find duplicates
  const duplicates: Array<{
    title: string
    count: number
    entries: Array<{ id: string; title: string; platforms: string[] }>
  }> = []

  for (const [, entries] of gamesByTitle) {
    if (entries.length > 1) {
      duplicates.push({
        title: entries[0].title,
        count: entries.length,
        entries: entries.map((e) => ({
          id: e.id,
          title: e.title,
          platforms: e.platforms,
        })),
      })
    }
  }

  return NextResponse.json({
    totalGames: games.length,
    uniqueTitles: gamesByTitle.size,
    duplicateGroups: duplicates.length,
    potentialToRemove: games.length - gamesByTitle.size,
    duplicates: duplicates.slice(0, 20), // Show first 20
  })
}

// Normalize title for comparison
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'") // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ") // Normalize spaces
    .replace(/[^\w\s'-]/g, "") // Remove special chars except basic punctuation
    .trim()
}
