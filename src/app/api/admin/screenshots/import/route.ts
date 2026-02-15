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

    // Get media items that need screenshots
    const mediaItems = await prisma.mediaItem.findMany({
      where: {
        ...typeFilter,
        ...(skipExisting ? {
          screenshots: { none: {} }
        } : {}),
        // Only get items with external IDs
        OR: [
          { tmdbId: { not: null } },
          { igdbId: { not: null } },
        ],
      },
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        tmdbId: true,
        igdbId: true,
      },
    })

    stats.total = mediaItems.length
    stats.details.push(`Found ${mediaItems.length} media items to process`)

    for (let i = 0; i < mediaItems.length; i++) {
      const media = mediaItems[i]

      // Delay between items to respect TMDB rate limits (40 req/10s)
      // Use 500ms base delay + extra pause every 10 items
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 500))
        if (i % 10 === 0) {
          await new Promise((r) => setTimeout(r, 2000))
        }
      }

      try {
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

    stats.details.push(
      `Import complete: ${stats.imported} media processed, ${stats.skipped} skipped, ${stats.errors} errors`
    )

    return NextResponse.json({
      success: true,
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
