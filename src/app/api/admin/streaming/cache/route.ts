import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { StreamingType } from "@prisma/client"
import { logCronRun } from "@/lib/cron-log"
import { extractProviders } from "@/lib/streaming-providers"
import { syncPlatforms, clearPlatforms, touchStreamingChecked } from "@/lib/streaming-sync"

const INTER_REQUEST_DELAY_MS = 200
const TMDB_FETCH_TIMEOUT_MS = 8000
// Observed cost is ~7.6 s per item end to end (76 s for a batch of 10, from
// cron_logs), overwhelmingly waiting on TMDB rather than on Postgres — both DB
// queries in this route measure ~66 ms against production. Strictly sequential,
// a 10-item chunk therefore spent 76 s to advance a ~9 500-item backlog by 10:
// the operator watches a progress bar move 0.1 % per click. TMDB allows far
// more than this; four in flight keeps us an order of magnitude under its rate
// limit while cutting wall-clock time by ~4x.
const TMDB_CONCURRENCY = 4
// Stop STARTING new work at this point and return what we have, so the chunk
// always answers inside the route's 300 s maxDuration instead of being killed
// mid-flight (which loses the whole batch AND the cron_logs entry).
const RUN_BUDGET_MS = 240_000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Is this HTTP status TMDB's final word on the id?
 *
 * The distinction the route got wrong for weeks. A definitive answer means we
 * must stamp the freshness cursor so the title leaves the queue; a transient
 * one means we must NOT, so it is retried. Leaving a 404 unstamped is what let
 * the same dead ids be re-fetched on every chunk for ever — 4 of every 10 slots
 * burned, the backlog going backwards (8 452 → 8 479 in a week), and an
 * operator watching a progress bar that never moves.
 *
 * 429 is explicitly transient despite being 4xx: it means "ask again later".
 */
export function isDefinitiveTmdbAnswer(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429
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
    // The real limiter is RUN_BUDGET_MS below; `limit` is now just the ceiling
    // on how many rows we pull per invocation.
    const limit = Math.min(body.limit || 200, 400)
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
      // Freshness is read from the item's OWN cursor, not from the presence of
      // streaming_availability rows. The old nested condition made a title that
      // TMDB answers 404 for permanently unprocessable: the 404 path writes no
      // row, so `streamingAvailability: { none: {} }` kept matching and the same
      // dead ids were re-fetched on every single chunk, forever. It showed up in
      // cron_logs as an unwavering `{"404": 4}` on batches of 10 — 4 slots of
      // every 10 burned on the same titles — with `remaining` falling by 6, not
      // 10, per run (and 8 452 → 8 479 between 28/08 and 04/09, i.e. backwards).
      // 1 563 titles are in that state.
      //
      // Writing a fake "_none" row would have unclogged it too, but that
      // sentinel is counted as real streaming presence elsewhere — quality/compute
      // adds 5 points for `streamingAvailability.length > 0` — so it would have
      // silently inflated dataQualityScore on 1 563 fiches.
      ...(forceRefresh
        ? {}
        : {
            OR: [
              { streamingCheckedAt: null },
              { streamingCheckedAt: { lt: sevenDaysAgo } },
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
      // Oldest cursor first, never-checked ahead of everything: the queue drains
      // instead of re-serving whatever the last unrelated write happened to touch
      // (`updatedAt` is rewritten wholesale by the nightly quality pass, which
      // made the previous ordering essentially arbitrary).
      orderBy: { streamingCheckedAt: { sort: "asc", nulls: "first" } },
    })

    let processed = 0
    let updated = 0
    let errors = 0
    // Items that actually LEFT the queue this run (cursor stamped). A transient
    // failure is deliberately not counted: it must be retried, not skipped.
    let drained = 0
    // Track HTTP status code breakdown so cron_logs can tell us what
    // actually went wrong next time (429 vs 404 vs 5xx vs network).
    const statusBreakdown: Record<string, number> = {}

    const deadline = startTime + RUN_BUDGET_MS
    let budgetHit = false

    type Item = (typeof mediaItems)[number]

    async function handle(item: Item): Promise<void> {
      processed++
      try {
        const mediaType = item.type === "MOVIE" ? "movie" : "tv"
        const url = `${TMDB_BASE_URL}/${mediaType}/${item.tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`

        const response = await tmdbFetchWithRetry(url)
        if (!response || !response.ok) {
          const key = response ? String(response.status) : "network"
          statusBreakdown[key] = (statusBreakdown[key] ?? 0) + 1
          errors++
          // A 4xx is TMDB's FINAL answer about this id (404 = the id is gone or
          // was merged). Stamp the cursor so the title leaves the queue for the
          // freshness window instead of being re-fetched on every chunk for
          // ever. 429/5xx/network are transient by definition and stay queued.
          if (response && isDefinitiveTmdbAnswer(response.status)) {
            await touchStreamingChecked(item.id)
            drained++
          }
          await sleep(INTER_REQUEST_DELAY_MS)
          return
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
          drained++
          return
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
        drained++
      } catch {
        errors++
        statusBreakdown["exception"] = (statusBreakdown["exception"] ?? 0) + 1
      }
    }

    // Bounded worker pool over a shared cursor. Each worker stops taking new
    // items once the budget is spent, so the chunk always returns a result and
    // a cron_logs row rather than being cut off by the platform timeout.
    let next = 0
    await Promise.all(
      Array.from({ length: Math.min(TMDB_CONCURRENCY, mediaItems.length) }, async () => {
        for (;;) {
          if (Date.now() >= deadline) {
            budgetHit = true
            return
          }
          const i = next++
          if (i >= mediaItems.length) return
          await handle(mediaItems[i])
        }
      }),
    )

    const newRemaining = remaining - drained
    // Stop the frontend's chunk loop when the queue is empty OR when a whole
    // chunk failed to drain a single item — that means TMDB is refusing us, and
    // spinning would just repeat it. Without this the loop is unbounded.
    const done = newRemaining <= 0 || (processed > 0 && drained === 0)

    await logCronRun({
      task: "streaming-cache",
      status: errors > 0 ? "partial" : "success",
      summary: `${updated} MAJ, ${drained} sortis de file, ${errors} erreurs sur ${processed}${budgetHit ? " — budget temps atteint" : ""}`,
      details: {
        processed,
        updated,
        errors,
        // `drained` vs `processed` is the number that mattered and was missing:
        // when they diverge, slots are being spent on titles that never leave
        // the queue. That gap is what hid the 404 loop for weeks.
        drained,
        budgetHit,
        statusBreakdown,
        remaining: Math.max(0, newRemaining),
      },
      startTime,
    })

    return NextResponse.json({
      success: true,
      done,
      processed,
      updated,
      errors,
      drained,
      budgetHit,
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
