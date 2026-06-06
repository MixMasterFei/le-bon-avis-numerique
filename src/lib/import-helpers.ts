// Shared TMDB→DB import helpers. Two jobs:
//   1. estimate a PROVISIONAL age for every film so it can be shown immediately
//      (badged "à confirmer") instead of staying invisible until AI enrichment.
//   2. a single create-block reused by the weekly cron, the admin bulk import,
//      and the now_playing (cinema) import — previously duplicated.
//
// Age estimation is layered, best signal first:
//   French CSA cert → foreign cert (US/GB/DE) → genre heuristic (always returns).
// Films created here stay `isEnriched: false`; the derived age is intentionally
// rough and the UI flags it as provisional.
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import {
  getDirector,
  getFrenchCertification,
  getMovieWatchProviders,
  mapCertificationToInternal,
  MovieGenres,
  type TMDBMovieDetails,
} from "@/lib/tmdb"
import { uploadTMDBPoster, uploadTMDBBackdrop } from "@/lib/supabase-storage"
import { extractProviders } from "@/lib/streaming-providers"

export type AgeSource = "csa" | "foreign" | "genre"

// French CSA certification → recommended age.
export function certificationToAge(cert: string | null): number | null {
  if (!cert) return null
  const map: Record<string, number> = { U: 0, TP: 0, "10": 10, "12": 12, "16": 16, "18": 18 }
  return map[cert] ?? null
}

// Foreign certification → FR-equivalent age. Conservative, only well-known systems.
const US_CERT_AGE: Record<string, number> = { G: 0, PG: 6, "PG-13": 13, R: 16, "NC-17": 18 }
const GB_CERT_AGE: Record<string, number> = { U: 0, PG: 6, "12": 12, "12A": 12, "15": 15, "18": 18 }
const DE_CERT_AGE: Record<string, number> = { "0": 0, "6": 6, "12": 12, "16": 16, "18": 18 }

function foreignCertAge(releaseDates: TMDBMovieDetails["release_dates"]): number | null {
  if (!releaseDates?.results) return null
  const pick = (region: string, table: Record<string, number>): number | null => {
    const entry = releaseDates.results.find((r) => r.iso_3166_1 === region)
    const cert = entry?.release_dates.find((rd) => rd.certification && rd.certification !== "")?.certification
    return cert != null && cert in table ? table[cert] : null
  }
  return pick("US", US_CERT_AGE) ?? pick("GB", GB_CERT_AGE) ?? pick("DE", DE_CERT_AGE)
}

// Genre → age heuristic. Keys are normalized (lowercased, accent-stripped) and
// cover both the French and English TMDB genre vocabularies.
const GENRE_AGE: Record<string, number> = {
  animation: 6, familial: 6, family: 6, documentaire: 6, documentary: 6,
  comedie: 8, comedy: 8, aventure: 8, adventure: 8, fantastique: 8, fantasy: 8,
  musique: 8, music: 8,
  action: 10, "science fiction": 10, "science-fiction": 10,
  drame: 12, drama: 12, romance: 12, histoire: 12, history: 12, western: 12,
  thriller: 13, crime: 13, mystere: 13, mystery: 13, guerre: 13, war: 13,
  horreur: 16, horror: 16,
}
const FAMILY_GENRES = new Set(["animation", "familial", "family", "documentaire", "documentary"])
const MATURE_GENRES = new Set(["thriller", "crime", "mystere", "mystery", "guerre", "war", "horreur", "horror"])

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
}

function ageFromGenreNames(names: string[]): number {
  const keys = names.map(norm)
  const matched = keys.map((k) => GENRE_AGE[k]).filter((a): a is number => a != null)
  const base = matched.length ? Math.max(...matched) : 10
  const hasFamily = keys.some((k) => FAMILY_GENRES.has(k))
  const hasMature = keys.some((k) => MATURE_GENRES.has(k))
  // A family/animation title with no mature genre leans young even if it also
  // carries Action/Adventure (e.g. an animated adventure).
  if (hasFamily && !hasMature) return Math.min(base, 6)
  return base
}

// TMDB numeric genre id → name (movie genres), for callers that only have ids
// (e.g. the cinema overlay using now_playing results, which carry genre_ids).
const GENRE_ID_TO_NAME: Record<number, string> = {
  [MovieGenres.ACTION]: "action",
  [MovieGenres.ADVENTURE]: "adventure",
  [MovieGenres.ANIMATION]: "animation",
  [MovieGenres.COMEDY]: "comedy",
  [MovieGenres.CRIME]: "crime",
  [MovieGenres.DOCUMENTARY]: "documentary",
  [MovieGenres.DRAMA]: "drama",
  [MovieGenres.FAMILY]: "family",
  [MovieGenres.FANTASY]: "fantasy",
  [MovieGenres.HISTORY]: "history",
  [MovieGenres.HORROR]: "horror",
  [MovieGenres.MUSIC]: "music",
  [MovieGenres.MYSTERY]: "mystery",
  [MovieGenres.ROMANCE]: "romance",
  [MovieGenres.SCIENCE_FICTION]: "science fiction",
  [MovieGenres.THRILLER]: "thriller",
  [MovieGenres.WAR]: "war",
  [MovieGenres.WESTERN]: "western",
}

/** Estimate a provisional age from TMDB numeric genre ids (always returns a number). */
export function estimateAgeFromTmdbGenreIds(ids: number[]): number {
  return ageFromGenreNames(ids.map((id) => GENRE_ID_TO_NAME[id]).filter(Boolean))
}

/**
 * Estimate a provisional age + internal CSA-style rating for a movie.
 * Always returns an age (genre heuristic is the floor). `source` records which
 * signal won, for the UI tooltip / debugging.
 */
export function estimateProvisionalAge(details: TMDBMovieDetails): {
  age: number
  source: AgeSource
  internalRating: string | null
} {
  const frCert = getFrenchCertification(details.release_dates)
  const internalRating = mapCertificationToInternal(frCert)
  const csaAge = certificationToAge(frCert)
  if (csaAge != null) return { age: csaAge, source: "csa", internalRating }

  const foreign = foreignCertAge(details.release_dates)
  if (foreign != null) return { age: foreign, source: "foreign", internalRating }

  const genreNames = details.genres?.map((g) => g.name) ?? []
  return { age: ageFromGenreNames(genreNames), source: "genre", internalRating }
}

/** Estimate a provisional age from already-stored data (no TMDB call) — used by the backfill. */
export function estimateProvisionalAgeFromStored(args: {
  officialRating: string | null
  genres: string[]
}): { age: number; source: AgeSource } {
  // officialRating is stored in internal form (TOUS_PUBLICS / CSA_10 / ...).
  const internalToAge: Record<string, number> = {
    TOUS_PUBLICS: 0, CSA_10: 10, CSA_12: 12, CSA_16: 16, CSA_18: 18,
  }
  if (args.officialRating && args.officialRating in internalToAge) {
    return { age: internalToAge[args.officialRating], source: "csa" }
  }
  return { age: ageFromGenreNames(args.genres), source: "genre" }
}

/**
 * Create a MOVIE DB row from TMDB details, with a provisional age and (best
 * effort) day-one streaming platforms. Returns the created id. Caller handles
 * dedup (skip existing tmdbId) before calling.
 */
export async function createMovieFromTmdb(
  details: TMDBMovieDetails,
  opts: { fetchProviders?: boolean; providers?: string[] } = {},
): Promise<string> {
  const id = randomUUID()
  const [posterUrl, backdropUrl] = await Promise.all([
    uploadTMDBPoster(id, details.poster_path),
    uploadTMDBBackdrop(id, details.backdrop_path),
  ])

  const { age, internalRating } = estimateProvisionalAge(details)
  const director = getDirector(details.credits)
  const genres = details.genres?.map((g) => g.name) ?? []

  // Day-one platforms so the film is immediately filterable by service.
  let platforms = opts.providers ?? []
  if (platforms.length === 0 && opts.fetchProviders) {
    try {
      platforms = extractProviders(await getMovieWatchProviders(details.id))
    } catch {
      platforms = []
    }
  }

  await prisma.mediaItem.create({
    data: {
      id,
      tmdbId: details.id,
      title: details.title,
      originalTitle: details.original_title !== details.title ? details.original_title : null,
      type: "MOVIE",
      releaseDate: details.release_date ? new Date(details.release_date) : null,
      posterUrl,
      backdropUrl,
      synopsisFr: details.overview || null,
      officialRating: internalRating,
      expertAgeRec: age,
      duration: details.runtime || null,
      director: director || null,
      genres,
      platforms,
      topics: [],
      originalLanguage: details.original_language || null,
      tmdbRating: details.vote_average || null,
      tmdbVoteCount: details.vote_count || null,
      dataSource: "TMDB",
      // age is always set now (genre floor) → provisional films start at 30.
      dataQualityScore: 30,
      isEnriched: false,
      lastVerifiedAt: new Date(),
    },
  })
  return id
}
