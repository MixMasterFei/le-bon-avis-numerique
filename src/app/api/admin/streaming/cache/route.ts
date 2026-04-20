import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { StreamingType } from "@prisma/client"

// Per item: TMDB fetch + Prisma deleteMany + create(s). At 30 items
// this was brushing the 60 s timeout under load. Bumped to 300 s
// matching the other heavy admin jobs (CNC, enrich-deep).
export const maxDuration = 300

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = "https://api.themoviedb.org/3"

interface TMDBProvider {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

interface TMDBWatchProviders {
  results?: {
    FR?: {
      link?: string
      flatrate?: TMDBProvider[]
      rent?: TMDBProvider[]
      buy?: TMDBProvider[]
      free?: TMDBProvider[]
      ads?: TMDBProvider[]
    }
  }
}

/**
 * Cache streaming availability from TMDB for movies/TV shows.
 * Chunked: processes a small batch per call, frontend loops until done.
 */
export async function POST(request: Request) {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { success: false, error: "TMDB API key not configured" },
      { status: 500 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 10, 30)
    const forceRefresh = body.forceRefresh || false
    const familyOnly = body.familyOnly || false
    const maxAge = body.maxAge || null

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const whereClause = {
      tmdbId: { not: null },
      type: { in: ["MOVIE", "TV"] as ("MOVIE" | "TV")[] },
      ...(familyOnly || maxAge
        ? {
            AND: [
              { expertAgeRec: { not: null } },
              { expertAgeRec: { lte: maxAge || 10 } },
            ],
          }
        : {}),
      ...(forceRefresh
        ? {}
        : {
            OR: [
              { streamingAvailability: { none: {} } },
              {
                streamingAvailability: {
                  every: { lastChecked: { lt: sevenDaysAgo } },
                },
              },
            ],
          }),
    }

    // Count remaining to show progress
    const remaining = await prisma.mediaItem.count({ where: whereClause })

    if (remaining === 0) {
      return NextResponse.json({
        success: true,
        done: true,
        processed: 0,
        updated: 0,
        errors: 0,
        remaining: 0,
      })
    }

    const mediaItems = await prisma.mediaItem.findMany({
      where: whereClause,
      select: {
        id: true,
        tmdbId: true,
        type: true,
        title: true,
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    })

    let processed = 0
    let updated = 0
    let errors = 0

    for (const item of mediaItems) {
      processed++

      try {
        const mediaType = item.type === "MOVIE" ? "movie" : "tv"
        const url = `${TMDB_BASE_URL}/${mediaType}/${item.tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`

        const response = await fetch(url)
        if (!response.ok) {
          errors++
          continue
        }

        const data: TMDBWatchProviders = await response.json()
        const frProviders = data.results?.FR

        // Delete old streaming data
        await prisma.streamingAvailability.deleteMany({
          where: { mediaId: item.id },
        })

        if (!frProviders) {
          // Mark as checked so it's not re-queried next chunk
          await prisma.streamingAvailability.create({
            data: {
              mediaId: item.id,
              provider: "_none",
              providerId: 0,
              country: "FR",
              type: "SUBSCRIPTION" as StreamingType,
              lastChecked: new Date(),
            },
          })
          continue
        }

        const providerMappings: Array<{
          providers: TMDBProvider[] | undefined
          type: StreamingType
        }> = [
          { providers: frProviders.flatrate, type: "SUBSCRIPTION" },
          { providers: frProviders.rent, type: "RENT" },
          { providers: frProviders.buy, type: "BUY" },
          { providers: frProviders.free, type: "FREE" },
          { providers: frProviders.ads, type: "ADS" },
        ]

        const records: Array<{
          mediaId: string
          provider: string
          providerId: number
          country: string
          type: StreamingType
          link: string | undefined
          lastChecked: Date
        }> = []

        for (const { providers, type } of providerMappings) {
          if (!providers?.length) continue
          for (const provider of providers) {
            records.push({
              mediaId: item.id,
              provider: provider.provider_name,
              providerId: provider.provider_id,
              country: "FR",
              type,
              link: frProviders.link,
              lastChecked: new Date(),
            })
          }
        }

        if (records.length > 0) {
          await prisma.streamingAvailability.createMany({ data: records })
          updated++
        }

        // Respect TMDB rate limits (40 req/10s)
        await new Promise((r) => setTimeout(r, 300))
      } catch {
        errors++
      }
    }

    const newRemaining = remaining - processed

    return NextResponse.json({
      success: true,
      done: newRemaining <= 0,
      processed,
      updated,
      errors,
      remaining: Math.max(0, newRemaining),
    })
  } catch (error) {
    console.error("Streaming cache error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to cache streaming availability" },
      { status: 500 }
    )
  }
}
