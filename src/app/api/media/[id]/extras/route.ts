import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  getMovieWatchProviders,
  getTVWatchProviders,
  getMovieVideos,
  getTVVideos,
  getBestTrailer,
} from "@/lib/tmdb"
import { isMovieNowPlaying } from "@/lib/cinema"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Look up the media item for tmdbId and type
    const media = await prisma.mediaItem.findUnique({
      where: { id },
      select: { tmdbId: true, type: true },
    })

    if (!media || !media.tmdbId) {
      return NextResponse.json(
        { watchProviders: null, trailer: null, inTheaters: false },
        {
          headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
        }
      )
    }

    const tmdbId = media.tmdbId
    const mediaType = media.type

    // Is this movie currently in French theaters? (cached now_playing lookup, MOVIE-only)
    const inTheaters = mediaType === "MOVIE" ? await isMovieNowPlaying(tmdbId) : false

    // Try DB-stored streaming data first (fast path)
    let watchProviders = null
    try {
      const dbStreaming = await prisma.streamingAvailability.findMany({
        where: { mediaId: id, country: "FR", provider: { not: "_none" } },
        orderBy: { type: "asc" },
      })

      if (dbStreaming.length > 0) {
        const flatrate = dbStreaming
          .filter((s) => s.type === "SUBSCRIPTION")
          .map((s) => ({ provider_id: s.providerId || 0, provider_name: s.provider, logo_path: "", display_priority: 0 }))
        const free = dbStreaming
          .filter((s) => s.type === "FREE" || s.type === "ADS")
          .map((s) => ({ provider_id: s.providerId || 0, provider_name: s.provider, logo_path: "", display_priority: 0 }))
        const rent = dbStreaming
          .filter((s) => s.type === "RENT")
          .map((s) => ({ provider_id: s.providerId || 0, provider_name: s.provider, logo_path: "", display_priority: 0 }))
        const buy = dbStreaming
          .filter((s) => s.type === "BUY")
          .map((s) => ({ provider_id: s.providerId || 0, provider_name: s.provider, logo_path: "", display_priority: 0 }))

        if (flatrate.length > 0 || free.length > 0 || rent.length > 0 || buy.length > 0) {
          watchProviders = { flatrate, free, rent, buy }
        }
      }
    } catch {
      // DB streaming lookup failed, will fall back to TMDB
    }

    // Fetch from TMDB with 5s timeout (for fresh logos + trailer)
    let trailer = null
    try {
      const tmdbPromise = Promise.all([
        mediaType === "MOVIE"
          ? getMovieWatchProviders(tmdbId)
          : getTVWatchProviders(tmdbId),
        mediaType === "MOVIE"
          ? getMovieVideos(tmdbId)
          : getTVVideos(tmdbId),
      ])
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TMDB timeout")), 5000)
      )

      const [providersResult, videosResult] = await Promise.race([tmdbPromise, timeoutPromise])
      if (providersResult) watchProviders = providersResult
      trailer = getBestTrailer(videosResult)
    } catch {
      // TMDB timed out or failed — DB streaming data (if any) already set above
    }

    return NextResponse.json(
      { watchProviders, trailer, inTheaters },
      {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
      }
    )
  } catch (error) {
    console.error("Media extras error:", error)
    return NextResponse.json(
      { watchProviders: null, trailer: null, inTheaters: false },
      { status: 500 }
    )
  }
}
