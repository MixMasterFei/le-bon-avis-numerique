/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import {
  getPopularTVShows,
  getTVDetails,
  getTVFrenchRating,
  TVGenres,
  mapCertificationToInternal,
  getTVWatchProviders,
} from "@/lib/tmdb"
import { uploadTMDBPoster, uploadTMDBBackdrop } from "@/lib/supabase-storage"
import { isAdultTmdbTv } from "@/lib/adult-content-filter"

// Vercel serverless function config
export const maxDuration = 60

// Map French CSA certification to recommended age
function certificationToAge(cert: string | null): number | null {
  if (!cert) return null
  const map: Record<string, number> = {
    NR: 0,
    "10": 10,
    "12": 12,
    "16": 16,
    "18": 18,
  }
  return map[cert] ?? null
}

const FR_SAFE_SOURCES = ["french", "kids"]

interface ImportStats {
  total: number
  imported: number
  skipped: number
  skippedNoFR: number
  skippedAdult: number
  errors: number
  details: string[]
}

// TMDB discover endpoint for TV shows
async function discoverTVShows(options: {
  page?: number
  with_genres?: string
  sort_by?: string
  "first_air_date.gte"?: string
  "first_air_date.lte"?: string
  with_original_language?: string
  "vote_average.gte"?: string
  "vote_count.gte"?: string
}) {
  const params = new URLSearchParams({
    language: "fr-FR",
    region: "FR",
  })

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, value.toString())
    }
  })

  const response = await fetch(
    `https://api.themoviedb.org/3/discover/tv?${params}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 },
    }
  )

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`)
  }

  return response.json()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      source = "popular",
      pages = 5,
      skipExisting = true,
      startPage = 1,
    } = body

    const stats: ImportStats = {
      total: 0,
      imported: 0,
      skipped: 0,
      skippedNoFR: 0,
      skippedAdult: 0,
      errors: 0,
      details: [],
    }

    const allShows: Array<{ id: number; name: string }> = []
    const maxPages = Math.min(pages, 10)

    for (let page = startPage; page < startPage + maxPages; page++) {
      try {
        let response

        switch (source) {
          case "top_rated":
            response = await fetch(
              `https://api.themoviedb.org/3/tv/top_rated?language=fr-FR&page=${page}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                },
              }
            ).then(r => r.json())
            break
          case "animation":
            response = await discoverTVShows({
              page,
              with_genres: TVGenres.ANIMATION.toString(),
              sort_by: "popularity.desc",
            })
            break
          case "kids":
            response = await discoverTVShows({
              page,
              with_genres: TVGenres.KIDS.toString(),
              sort_by: "popularity.desc",
            })
            break
          case "family":
            response = await discoverTVShows({
              page,
              with_genres: TVGenres.FAMILY.toString(),
              sort_by: "popularity.desc",
            })
            break
          case "french":
            response = await discoverTVShows({
              page,
              with_original_language: "fr",
              sort_by: "popularity.desc",
            })
            break
          case "recent":
            const twoYearsAgo = new Date()
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
            response = await discoverTVShows({
              page,
              "first_air_date.gte": twoYearsAgo.toISOString().split("T")[0],
              sort_by: "popularity.desc",
            })
            break
          case "highly_rated":
            response = await discoverTVShows({
              page,
              "vote_average.gte": "7",
              "vote_count.gte": "500",
              sort_by: "vote_average.desc",
            })
            break
          default:
            response = await getPopularTVShows(page)
        }

        allShows.push(
          ...response.results.map((s: { id: number; name: string }) => ({ id: s.id, name: s.name }))
        )

        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (pageError) {
        stats.details.push(`Error fetching page ${page}: ${pageError instanceof Error ? pageError.message : "Unknown"}`)
      }
    }

    stats.details.push(`Fetched ${allShows.length} TV shows from TMDB (${source})`)

    // Pre-filter existing - only check TV items (unique constraint is now per type)
    const existingTmdbIds = new Set(
      (await prisma.mediaItem.findMany({
        where: {
          type: "TV",
          tmdbId: { in: allShows.map(s => s.id) }
        },
        select: { tmdbId: true }
      })).map(m => m.tmdbId)
    )

    const newShows = skipExisting
      ? allShows.filter(s => !existingTmdbIds.has(s.id))
      : allShows

    stats.total = allShows.length
    stats.skipped = existingTmdbIds.size
    stats.details.push(`${newShows.length} nouvelles séries à importer (${existingTmdbIds.size} déjà en base ou conflit ID)`)

    for (const show of newShows) {
      try {
        const details = await getTVDetails(show.id)

        // Family-guide guard: never import hentai / explicit adult series.
        if (isAdultTmdbTv(details)) {
          stats.skippedAdult++
          continue
        }

        const rating = getTVFrenchRating(details.content_ratings)

        // Skip TV shows with no French relevance (unless source is inherently FR)
        if (!FR_SAFE_SOURCES.includes(source)) {
          const isFR = details.original_language === "fr"
            || !!rating
            || details.content_ratings?.results?.some((r: any) => r.iso_3166_1 === "FR")
          if (!isFR) {
            const frProviders = await getTVWatchProviders(show.id)
            if (!frProviders) {
              stats.skippedNoFR++
              continue
            }
          }
        }

        const creator = details.created_by?.[0]?.name || null

        const id = randomUUID()
        const [posterUrl, backdropUrl] = await Promise.all([
          uploadTMDBPoster(id, details.poster_path),
          uploadTMDBBackdrop(id, details.backdrop_path),
        ])

        await prisma.mediaItem.create({
          data: {
            id,
            tmdbId: show.id,
            title: details.name,
            originalTitle: details.original_name,
            type: "TV",
            synopsisFr: details.overview || null,
            posterUrl,
            backdropUrl,
            releaseDate: details.first_air_date
              ? new Date(details.first_air_date)
              : null,
            duration: details.episode_run_time?.[0] || null,
            numberOfSeasons: details.number_of_seasons || null,
            director: creator,
            genres: details.genres.map((g) => g.name),
            officialRating: mapCertificationToInternal(rating),
            expertAgeRec: certificationToAge(rating),
            originalLanguage: details.original_language || null,
            tmdbRating: details.vote_average || null,
            tmdbVoteCount: details.vote_count || null,
            platforms: [],
            topics: [],
            lastVerifiedAt: new Date(),
          },
        })

        stats.imported++
        await new Promise((resolve) => setTimeout(resolve, 150))
      } catch (error) {
        stats.errors++
        stats.details.push(
          `Error importing ${show.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }

    stats.details.push(
      `Import complete: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`
    )

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error("TV import error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  const tvCount = await prisma.mediaItem.count({
    where: { type: "TV" },
  })

  const recentTV = await prisma.mediaItem.findMany({
    where: { type: "TV" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { title: true, tmdbId: true, createdAt: true },
  })

  return NextResponse.json({
    tvCount,
    recentTV,
  })
}
