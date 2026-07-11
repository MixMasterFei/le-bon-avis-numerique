import { prisma } from "@/lib/prisma"
import { isAdultIgdbGame } from "@/lib/adult-content-filter"
import {
  getIGDBImageUrl,
  getPegiInfo,
  normalizePlatforms,
  type IGDBGame,
} from "@/lib/igdb"
import { normalizeGameGenres } from "@/lib/igdb-genres"
import { deriveGameStyleTags } from "@/lib/game-style-tags"

/**
 * Map an IGDB game to the MediaItem shape. Shared by the admin import route and
 * the games-top-names cron so both create fiches identically (PEGI → age,
 * Steam-style tags, IGDB rating in the shared rating fields). Games stay
 * `isEnriched: false` until the enrichment cron writes the expert content.
 */
export function transformGameToMediaItem(game: IGDBGame) {
  const pegi = getPegiInfo(game.age_ratings)
  const developer = game.involved_companies?.find((c) => c.developer)

  return {
    igdbId: game.id,
    title: game.name,
    type: "GAME" as const,
    synopsisFr: game.summary || game.storyline || null,
    posterUrl: getIGDBImageUrl(game.cover?.image_id, "large"),
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000)
      : null,
    genres: normalizeGameGenres(game.genres?.map((g) => g.name) || []),
    platforms: normalizePlatforms(game.platforms),
    officialRating: pegi?.internal || null,
    pegiDescriptors: pegi?.descriptors ?? [],
    expertAgeRec: pegi?.age || null,
    director: developer?.company.name || null, // "director" field reused for developer
    topics: deriveGameStyleTags(game),
    tmdbRating: game.total_rating ? Math.round(game.total_rating) / 10 : null,
    tmdbVoteCount: game.total_rating_count || null,
  }
}

/**
 * Create a game fiche from an IGDB game, applying the family-guide adult guard.
 * Returns the new id, or null when the title is rejected (adult) — callers
 * treat null as "skipped", not an error.
 */
export async function createGameFromIgdb(game: IGDBGame): Promise<string | null> {
  if (isAdultIgdbGame(game)) return null

  const data = transformGameToMediaItem(game)
  const created = await prisma.mediaItem.create({
    data: {
      ...data,
      originalTitle: null,
      backdropUrl: null,
      duration: null,
      communityAgeRec: null,
    },
    select: { id: true },
  })
  return created.id
}
