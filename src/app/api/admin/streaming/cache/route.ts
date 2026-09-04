import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { StreamingType } from "@prisma/client"
import { logCronRun } from "@/lib/cron-log"
import { extractProviders } from "@/lib/streaming-providers"
import { syncPlatforms, clearPlatforms } from "@/lib/streaming-sync"

const INTER_REQUEST_DELAY_MS = 200
const TMDB_FETCH_TIMEOUT_MS = 8000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Fetch with one retry on 429/5xx and an 8s timeout. Returns the
 *  response (caller checks .ok) or null if all attempts failed. */
async function tmdbFetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TMDB_FETCH_TIMEOUT_MS) })
      if (res.ok) return res
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await sleep(1000)
        continue
      }
      return res // 404 and other non-retryable — return so caller can log status
    } catch {
      if (attempt === 0) {
        await sleep(1000)
        continue
      }
      return null
    }
  }
  return null
}

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
  const startTime = Date.now()
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
    // Track HTTP status code breakdown so cron_logs can tell us what
    // actually went wrong next time (429 vs 404 vs 5xx vs network).
    const statusBreakdown: Record<string, number> = {}

    for (const item of mediaItems) {
      processed++

      try {
        const mediaType = item.type === "MOVIE" ? "movie" : "tv"
        const url = `${TMDB_BASE_URL}/${mediaType}/${item.tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`

        const response = await tmdbFetchWithRetry(url)
        if (!response || !response.ok) {
          const key = response ? String(response.status) : "network"
          statusBreakdown[key] = (statusBreakdown[key] ?? 0) + 1
          errors++
          // Unconditional delay even after failures — without this, a
          // burst of 429s just makes us hammer TMDB faster.
          await sleep(INTER_REQUEST_DELAY_MS)
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
          // No FR offer at all: the film must stop surfacing under any
          // platform filter. Cleared from a FRESH TMDB answer, never from the
          // (often months-old) streaming_availability table.
          await clearPlatforms(item.id)
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

        // Write-through to MediaItem.platforms[] — the denormalised array every
        // platform filter actually reads (media-queries, smart filter, MCP
        // tools). This route only ever wrote the streaming_availability table,
        // so the two stores drifted apart in BOTH directions: films with a live
        // Netflix offer stayed unfilterable, and films whose offer had expired
        // kept their badge. Writing here fixes it at the source, on fresh TMDB
        // data, for the high-throughput path.
        //
        // Goes through syncPlatforms (raw UPDATE) rather than the Prisma
        // client: it stamps streamingCheckedAt so this route feeds the same
        // rotation cursor as /api/admin/streaming/update, WITHOUT bumping
        // updatedAt — which sitemap.ts publishes as each fiche's lastModified.
        // See src/lib/streaming-sync.ts.
        await syncPlatforms(item.id, extractProviders(frProviders))
      } catch {
        errors++
        statusBreakdown["exception"] = (statusBreakdown["exception"] ?? 0) + 1
      }
      // Unconditional tail delay — runs after both success and failure
      // paths so a 429 burst doesn't accelerate the loop.
      await sleep(INTER_REQUEST_DELAY_MS)
    }

    const newRemaining = remaining - processed
    const done = newRemaining <= 0

    await logCronRun({
      task: "streaming-cache",
      status: errors > 0 ? "partial" : "success",
      summary: `${updated} MAJ, ${errors} erreurs sur ${processed}`,
      details: { processed, updated, errors, statusBreakdown, remaining: Math.max(0, newRemaining) },
      startTime,
    })

    return NextResponse.json({
      success: true,
      done,
      processed,
      updated,
      errors,
      statusBreakdown,
      remaining: Math.max(0, newRemaining),
    })
  } catch (error) {
    console.error("Streaming cache error:", error)
    await logCronRun({
      task: "streaming-cache",
      status: "error",
      summary: error instanceof Error ? error.message : "streaming cache failed",
      startTime,
    })
    return NextResponse.json(
      { success: false, error: "Failed to cache streaming availability" },
      { status: 500 }
    )
  }
}
