import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

// Console platforms that mainstream families care about (no PC/Mac)
const CONSOLE_PLATFORMS = [
  "Switch",
  "PS5",
  "PS4",
  "Xbox Series",
  "Xbox One",
  "Nintendo Switch",
  "PlayStation 5",
  "PlayStation 4",
]

// Exclude PC-only games (games that ONLY have these platforms)
const PC_ONLY_PLATFORMS = ["PC", "Mac", "Linux"]

// Default minimum quality to filter out obscure indie games
// Higher = more strict, only well-known mainstream games
const DEFAULT_MIN_QUALITY = 60

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const maxAge = searchParams.get("maxAge")
  const platform = searchParams.get("platform")
  const search = searchParams.get("q")
  const sortBy = searchParams.get("sortBy") || "createdAt" // createdAt, releaseDate, quality, title
  const requirePoster = searchParams.get("requirePoster") === "true"
  const minQuality = searchParams.get("minQuality")
  const featured = searchParams.get("featured") === "true" // Get featured/popular games
  const includeAll = searchParams.get("includeAll") === "true" // Bypass quality filter (for admin)
  const consoleOnly = searchParams.get("consoleOnly") !== "false" // Default to console games only

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {
      type: "GAME",
    }

    // Require poster for featured sections
    if (requirePoster || featured) {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        { posterUrl: { not: null } },
        { posterUrl: { not: "" } },
        { posterUrl: { startsWith: "http" } },
      ]
    }

    // Apply minimum quality filter (unless includeAll is set)
    if (!includeAll) {
      const qualityThreshold = minQuality ? parseInt(minQuality) : DEFAULT_MIN_QUALITY
      where.dataQualityScore = { gte: qualityThreshold }
    } else if (minQuality) {
      // If includeAll but minQuality specified, still apply it
      where.dataQualityScore = { gte: parseInt(minQuality) }
    }

    // Featured games: higher quality, with poster
    if (featured) {
      where.dataQualityScore = { gte: 50 }
    }

    // Filter to console platforms only (excludes PC-only indie games)
    if (consoleOnly && !platform) {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: CONSOLE_PLATFORMS.map(p => ({
            platforms: { has: p }
          }))
        }
      ]
    }

    // Filter by age recommendation
    if (maxAge) {
      const age = parseInt(maxAge)
      where.expertAgeRec = { lte: age, not: null }
    }

    // Filter by platform
    if (platform) {
      where.platforms = { has: platform }
    }

    // Search by title
    if (search) {
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
          ],
        },
      ]
    }

    // Determine sort order
    let orderBy: any = { createdAt: "desc" }
    if (sortBy === "releaseDate") {
      orderBy = { releaseDate: "desc" }
    } else if (sortBy === "title") {
      orderBy = { title: "asc" }
    } else if (sortBy === "quality") {
      orderBy = { dataQualityScore: "desc" }
    }

    const [games, total] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          contentMetrics: true,
          reviews: { select: { rating: true } },
        },
      }),
      prisma.mediaItem.count({ where }),
    ])

    // Transform to API format
    const transformedGames = games.map((game) => {
      const ratings = game.reviews.map((r) => r.rating)
      const reviewCount = ratings.length
      const reviewAvgRating = reviewCount > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / reviewCount) * 10) / 10
        : null

      return {
        id: game.id,
        igdbId: game.igdbId,
        title: game.title,
        type: game.type,
        synopsisFr: game.synopsisFr,
        posterUrl: game.posterUrl,
        releaseDate: game.releaseDate?.toISOString().split("T")[0] || null,
        genres: game.genres,
        platforms: game.platforms,
        officialRating: game.officialRating,
        expertAgeRec: game.expertAgeRec,
        communityAgeRec: game.communityAgeRec,
        developer: game.director, // We stored developer in director field
        topics: game.topics,
        contentMetrics: game.contentMetrics,
        dataQualityScore: game.dataQualityScore,
        reviewCount,
        reviewAvgRating,
      }
    })

    return NextResponse.json({
      games: transformedGames,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json(
      { error: "Failed to fetch games from database" },
      { status: 500 }
    )
  }
}
