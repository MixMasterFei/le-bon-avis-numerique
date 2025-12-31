import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 30

export async function GET() {
  try {
    // Run all queries in parallel for performance
    const [
      // Media stats
      mediaStats,
      // Pending action items
      pendingCorrections,
      pendingContentRequests,
      lowQualityCount,
      pendingReports,
      // Recent admin activity
      recentActivity,
      // User activity stats
      topContributors,
      recentReviews,
      // Language distribution
      languageStats,
    ] = await Promise.all([
      // Media counts by type
      prisma.mediaItem.groupBy({
        by: ["type"],
        _count: true,
      }),

      // Pending corrections count
      prisma.mediaCorrection.count({
        where: { status: "PENDING" },
      }),

      // Pending content requests count
      prisma.contentRequest.count({
        where: { status: "PENDING" },
      }),

      // Low quality items (score < 50)
      prisma.mediaItem.count({
        where: {
          dataQualityScore: { lt: 50 },
          tmdbId: { not: null },
        },
      }),

      // Pending review reports
      prisma.reviewReport.count({
        where: { status: "PENDING" },
      }),

      // Recent admin activity (last 20)
      prisma.adminActivity.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),

      // Top contributors (users with most reviews)
      prisma.review.groupBy({
        by: ["userId"],
        _count: true,
        orderBy: { _count: { userId: "desc" } },
        take: 10,
        where: { userId: { not: null } },
      }),

      // Recent reviews (last 10)
      prisma.review.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          media: {
            select: { id: true, title: true, type: true },
          },
        },
      }),

      // Language distribution
      prisma.mediaItem.groupBy({
        by: ["originalLanguage"],
        _count: true,
        orderBy: { _count: { originalLanguage: "desc" } },
        take: 10,
        where: { originalLanguage: { not: null } },
      }),
    ])

    // Get user details for top contributors
    const contributorIds = topContributors
      .map((c) => c.userId)
      .filter((id): id is string => id !== null)

    const contributorUsers = await prisma.user.findMany({
      where: { id: { in: contributorIds } },
      select: { id: true, name: true, email: true, image: true },
    })

    const contributorMap = new Map(contributorUsers.map((u) => [u.id, u]))

    // Calculate average quality score
    const avgQuality = await prisma.mediaItem.aggregate({
      _avg: { dataQualityScore: true },
      where: { tmdbId: { not: null } },
    })

    // Format response
    const stats = {
      movies: mediaStats.find((s) => s.type === "MOVIE")?._count || 0,
      tv: mediaStats.find((s) => s.type === "TV")?._count || 0,
      games: mediaStats.find((s) => s.type === "GAME")?._count || 0,
      books: mediaStats.find((s) => s.type === "BOOK")?._count || 0,
      apps: mediaStats.find((s) => s.type === "APP")?._count || 0,
      averageQualityScore: Math.round(avgQuality._avg.dataQualityScore || 0),
    }

    const actionItems = {
      pendingCorrections,
      pendingContentRequests,
      lowQualityItems: lowQualityCount,
      pendingReports,
    }

    const formattedContributors = topContributors.map((c) => ({
      user: contributorMap.get(c.userId!) || { id: c.userId, name: "Unknown" },
      reviewCount: c._count,
    }))

    return NextResponse.json({
      success: true,
      stats,
      actionItems,
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        details: a.details,
        createdAt: a.createdAt,
        user: a.user,
      })),
      topContributors: formattedContributors,
      recentReviews: recentReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment?.substring(0, 100),
        createdAt: r.createdAt,
        user: r.user,
        media: r.media,
      })),
      languageDistribution: languageStats.map((l) => ({
        language: l.originalLanguage,
        count: l._count,
      })),
    })
  } catch (error) {
    console.error("Dashboard API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load dashboard data",
      },
      { status: 500 }
    )
  }
}
