import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { mapCertificationToInternal, type TMDBTVDetails } from "@/lib/tmdb"
import { uploadTMDBPoster, uploadTMDBBackdrop } from "@/lib/supabase-storage"

/**
 * Create a provisional TV fiche (isEnriched:false) from TMDB details. Shared by
 * the pre-school sweep and the approved-list import of import-candidates, so
 * both write series identically. Callers own dedup on (tmdb_id, type) and the
 * adult guard, and pick the provisional age; the nightly enrichment assigns
 * the real one.
 */
export async function createTvFromTmdb(
  details: TMDBTVDetails,
  opts: { frRating: string | null; expertAgeRec: number; platforms: string[] },
): Promise<string> {
  const id = randomUUID()
  const [posterUrl, backdropUrl] = await Promise.all([
    uploadTMDBPoster(id, details.poster_path),
    uploadTMDBBackdrop(id, details.backdrop_path),
  ])
  await prisma.mediaItem.create({
    data: {
      id,
      tmdbId: details.id,
      title: details.name,
      originalTitle: details.original_name !== details.name ? details.original_name : null,
      type: "TV",
      releaseDate: details.first_air_date ? new Date(details.first_air_date) : null,
      releaseStatus: details.status || null,
      posterUrl,
      backdropUrl,
      synopsisFr: details.overview || null,
      officialRating: mapCertificationToInternal(opts.frRating),
      expertAgeRec: opts.expertAgeRec,
      numberOfSeasons: details.number_of_seasons || null,
      genres: details.genres?.map((g) => g.name) ?? [],
      platforms: opts.platforms,
      topics: [],
      originalLanguage: details.original_language || null,
      tmdbRating: details.vote_average || null,
      tmdbVoteCount: details.vote_count || null,
      dataSource: "TMDB",
      dataQualityScore: 30,
      isEnriched: false,
      lastVerifiedAt: new Date(),
    },
  })
  return id
}
