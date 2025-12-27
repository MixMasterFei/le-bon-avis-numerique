import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { StreamingType } from "@prisma/client"

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
 * Cache streaming availability from TMDB for movies/TV shows
 * Processes items without recent streaming data (older than 7 days)
 */
export async function POST(request: Request) {
  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 50, 100) // Max 100 items per batch
    const forceRefresh = body.forceRefresh || false

    // Find media items needing streaming data update
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const mediaItems = await prisma.mediaItem.findMany({
      where: {
        tmdbId: { not: null },
        type: { in: ["MOVIE", "TV"] },
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
      },
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
    const details: string[] = []

    for (const item of mediaItems) {
      processed++

      try {
        const mediaType = item.type === "MOVIE" ? "movie" : "tv"
        const url = `${TMDB_BASE_URL}/${mediaType}/${item.tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`

        const response = await fetch(url)
        if (!response.ok) {
          errors++
          details.push(`✗ ${item.title}: TMDB API error ${response.status}`)
          continue
        }

        const data: TMDBWatchProviders = await response.json()
        const frProviders = data.results?.FR

        if (!frProviders) {
          details.push(`○ ${item.title}: Pas de streaming FR`)
          continue
        }

        // Delete old streaming data for this item
        await prisma.streamingAvailability.deleteMany({
          where: { mediaId: item.id },
        })

        // Map TMDB provider types to our StreamingType enum
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

        let addedCount = 0

        for (const { providers, type } of providerMappings) {
          if (!providers || providers.length === 0) continue

          for (const provider of providers) {
            await prisma.streamingAvailability.create({
              data: {
                mediaId: item.id,
                provider: provider.provider_name,
                providerId: provider.provider_id,
                country: "FR",
                type,
                link: frProviders.link,
                lastChecked: new Date(),
              },
            })
            addedCount++
          }
        }

        if (addedCount > 0) {
          updated++
          details.push(`✓ ${item.title}: ${addedCount} providers cached`)
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (err) {
        errors++
        details.push(
          `✗ ${item.title}: ${err instanceof Error ? err.message : "Erreur"}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      updated,
      errors,
      details: details.slice(0, 50), // Limit details to 50 items
    })
  } catch (error) {
    console.error("Streaming cache error:", error)
    return NextResponse.json(
      { error: "Failed to cache streaming availability" },
      { status: 500 }
    )
  }
}
