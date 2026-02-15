import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMovieImages, getTVImages, getBackdropUrl, TMDBImage } from "@/lib/tmdb"
import { getGameScreenshots, getIGDBScreenshotUrl, IGDBScreenshot } from "@/lib/igdb"

export const maxDuration = 60

interface ImportStats {
  total: number
  imported: number
  skipped: number
  errors: number
  details: string[]
}

/**
 * Import screenshots for media items into local database
 * Supports MOVIE, TV, and GAME types
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      mediaType = "MOVIE", // MOVIE, TV, GAME, or ALL
      limit = 50, // Number of media items to process
      screenshotsPerMedia = 6, // Screenshots per media item
      skipExisting = true, // Skip items that already have screenshots
    } = body

    // Cursor-based pagination: afterId from URL params to progress past items
    const url = new URL(request.url)
    const afterId = url.searchParams.get("afterId") || null

    const stats: ImportStats = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: 0,
      details: [],
    }

    // Build query based on media type
    const typeFilter = mediaType === "ALL"
      ? { type: { in: ["MOVIE", "TV", "GAME"] as ("MOVIE" | "TV" | "GAME")[] } }
      : { type: mediaType as "MOVIE" | "TV" | "GAME" }

    const whereClause = {
      ...typeFilter,
      ...(skipExisting ? {
        screenshots: { none: {} }
      } : {}),
      // Only get items with external IDs
      OR: [
        { tmdbId: { not: null } },
        { igdbId: { not: null } },
      ],
      // Cursor: skip items we already checked in previous chunks
      ...(afterId ? { id: { gt: afterId } } : {}),
    }

    // Count total remaining for progress
    const remaining = await prisma.mediaItem.count({ where: whereClause })

    // Get media items that need screenshots
    const mediaItems = await prisma.mediaItem.findMany({
      where: whereClause,
      take: limit,
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        tmdbId: true,
        igdbId: true,
      },
    })

    stats.total = mediaItems.length

    let consecutiveRateLimits = 0

    for (let i = 0; i < mediaItems.length; i++) {
      const media = mediaItems[i]

      // Delay between items to respect TMDB rate limits (40 req/10s)
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 500))
        if (i % 5 === 0) {
          await new Promise((r) => setTimeout(r, 1500))
        }
      }

      try {
        // Helper to fetch images for this item
        const fetchImages = async () => {
          if (media.type === "MOVIE" && media.tmdbId) {
            const imgs = await getMovieImages(media.tmdbId, screenshotsPerMedia)
            return imgs.map((img: TMDBImage, idx: number) => ({
              url: getBackdropUrl(img.file_path, "large"),
              width: img.width, height: img.height,
              externalId: img.file_path, order: idx,
            }))
          } else if (media.type === "TV" && media.tmdbId) {
            const imgs = await getTVImages(media.tmdbId, screenshotsPerMedia)
            return imgs.map((img: TMDBImage, idx: number) => ({
              url: getBackdropUrl(img.file_path, "large"),
              width: img.width, height: img.height,
              externalId: img.file_path, order: idx,
            }))
          } else if (media.type === "GAME" && media.igdbId) {
            const imgs = await getGameScreenshots(media.igdbId, screenshotsPerMedia)
            return imgs.map((img: IGDBScreenshot, idx: number) => ({
              url: getIGDBScreenshotUrl(img.image_id, "large"),
              width: img.width, height: img.height,
              externalId: img.image_id, order: idx,
            }))
          }
          return []
        }

        let screenshots: { url: string; width?: number; height?: number; externalId?: string; order?: number }[]
        try {
          screenshots = await fetchImages()
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : ""
          if (msg.includes("rate limit") || msg.includes("429")) {
            // Back off 10s and retry once
            await new Promise((r) => setTimeout(r, 10000))
            try {
              screenshots = await fetchImages()
            } catch {
              consecutiveRateLimits++
              stats.errors++
              stats.details.push(`Rate limit: ${media.title}`)
              if (consecutiveRateLimits >= 3) {
                stats.details.push("Arret: rate limit persistant")
                break
              }
              continue
            }
          } else {
            throw fetchErr
          }
        }

        consecutiveRateLimits = 0

        if (screenshots.length === 0) {
          stats.skipped++
          continue
        }

        // Delete existing screenshots if not skipping
        if (!skipExisting) {
          await prisma.mediaScreenshot.deleteMany({
            where: { mediaId: media.id },
          })
        }

        // Create screenshot records
        await prisma.mediaScreenshot.createMany({
          data: screenshots.map((s, index) => ({
            mediaId: media.id,
            url: s.url,
            width: s.width || null,
            height: s.height || null,
            externalId: s.externalId || null,
            order: index,
            source: media.type === "GAME" ? "IGDB" : "TMDB",
          })),
        })

        stats.imported++
        stats.details.push(`Imported ${screenshots.length} screenshots for "${media.title}"`)
      } catch (error) {
        stats.errors++
        stats.details.push(
          `Error processing ${media.title}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }

    // Last processed item ID for cursor pagination
    const lastId = mediaItems.length > 0 ? mediaItems[mediaItems.length - 1].id : null
    const done = mediaItems.length < limit

    return NextResponse.json({
      success: true,
      done,
      lastId,
      remaining: Math.max(0, remaining - mediaItems.length),
      stats,
    })
  } catch (error) {
    console.error("Screenshot import error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 }
    )
  }
}

/**
 * Import screenshots for a single media item by ID
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { mediaId, screenshotsPerMedia = 6 } = body

    if (!mediaId) {
      return NextResponse.json(
        { success: false, error: "mediaId is required" },
        { status: 400 }
      )
    }

    const media = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        title: true,
        type: true,
        tmdbId: true,
        igdbId: true,
      },
    })

    if (!media) {
      return NextResponse.json(
        { success: false, error: "Media not found" },
        { status: 404 }
      )
    }

    let screenshots: { url: string; width?: number; height?: number; externalId?: string }[] = []

    // Fetch screenshots based on media type
    if (media.type === "MOVIE" && media.tmdbId) {
      const tmdbImages = await getMovieImages(media.tmdbId, screenshotsPerMedia)
      screenshots = tmdbImages.map((img: TMDBImage, index: number) => ({
        url: getBackdropUrl(img.file_path, "large"),
        width: img.width,
        height: img.height,
        externalId: img.file_path,
        order: index,
      }))
    } else if (media.type === "TV" && media.tmdbId) {
      const tmdbImages = await getTVImages(media.tmdbId, screenshotsPerMedia)
      screenshots = tmdbImages.map((img: TMDBImage, index: number) => ({
        url: getBackdropUrl(img.file_path, "large"),
        width: img.width,
        height: img.height,
        externalId: img.file_path,
        order: index,
      }))
    } else if (media.type === "GAME" && media.igdbId) {
      const igdbScreenshots = await getGameScreenshots(media.igdbId, screenshotsPerMedia)
      screenshots = igdbScreenshots.map((img: IGDBScreenshot, index: number) => ({
        url: getIGDBScreenshotUrl(img.image_id, "large"),
        width: img.width,
        height: img.height,
        externalId: img.image_id,
        order: index,
      }))
    }

    if (screenshots.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No screenshots found for this media",
        count: 0,
      })
    }

    // Delete existing screenshots
    await prisma.mediaScreenshot.deleteMany({
      where: { mediaId: media.id },
    })

    // Create screenshot records
    await prisma.mediaScreenshot.createMany({
      data: screenshots.map((s, index) => ({
        mediaId: media.id,
        url: s.url,
        width: s.width || null,
        height: s.height || null,
        externalId: s.externalId || null,
        order: index,
        source: media.type === "GAME" ? "IGDB" : "TMDB",
      })),
    })

    return NextResponse.json({
      success: true,
      message: `Imported ${screenshots.length} screenshots for "${media.title}"`,
      count: screenshots.length,
    })
  } catch (error) {
    console.error("Single screenshot import error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 }
    )
  }
}

/**
 * GET stats about screenshots in the database
 */
export async function GET() {
  const stats = await prisma.mediaItem.groupBy({
    by: ["type"],
    _count: { id: true },
  })

  const withScreenshots = await prisma.mediaItem.count({
    where: {
      screenshots: { some: {} },
    },
  })

  const totalScreenshots = await prisma.mediaScreenshot.count()

  const recentScreenshots = await prisma.mediaScreenshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      media: { select: { title: true, type: true } },
    },
  })

  return NextResponse.json({
    mediaByType: stats,
    mediaWithScreenshots: withScreenshots,
    totalScreenshots,
    recentScreenshots: recentScreenshots.map(s => ({
      mediaTitle: s.media.title,
      mediaType: s.media.type,
      url: s.url,
      createdAt: s.createdAt,
    })),
  })
}
