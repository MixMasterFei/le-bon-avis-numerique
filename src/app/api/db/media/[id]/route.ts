import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Try to find by UUID first
    let media = await prisma.mediaItem.findUnique({
      where: { id },
      include: {
        contentMetrics: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    })

    // If not found by UUID, try by tmdbId (for MOVIE/TV)
    if (!media) {
      const numericId = parseInt(id)
      if (!isNaN(numericId)) {
        media = await prisma.mediaItem.findFirst({
          where: { tmdbId: numericId },
          include: {
            contentMetrics: true,
            reviews: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        })
      }
    }

    // If still not found, try by igdbId (for GAME)
    if (!media) {
      const numericId = parseInt(id)
      if (!isNaN(numericId)) {
        media = await prisma.mediaItem.findFirst({
          where: { igdbId: numericId },
          include: {
            contentMetrics: true,
            reviews: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        })
      }
    }

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }

    // Transform to API format
    const transformed = {
      id: media.id,
      tmdbId: media.tmdbId,
      igdbId: media.igdbId,
      title: media.title,
      originalTitle: media.originalTitle,
      type: media.type,
      synopsisFr: media.synopsisFr,
      posterUrl: media.posterUrl,
      backdropUrl: media.backdropUrl,
      releaseDate: media.releaseDate?.toISOString().split("T")[0] || null,
      duration: media.duration,
      director: media.director,
      genres: media.genres,
      platforms: media.platforms,
      topics: media.topics || [],
      officialRating: media.officialRating,
      expertAgeRec: media.expertAgeRec,
      communityAgeRec: media.communityAgeRec,
      contentMetrics: media.contentMetrics
        ? {
            violence: media.contentMetrics.violence,
            sexNudity: media.contentMetrics.sexNudity,
            language: media.contentMetrics.language,
            consumerism: media.contentMetrics.consumerism,
            substanceUse: media.contentMetrics.substanceUse,
            positiveMessages: media.contentMetrics.positiveMessages,
            roleModels: media.contentMetrics.roleModels,
            whatParentsNeedToKnow: media.contentMetrics.whatParentsNeedToKnow || [],
          }
        : null,
      reviews: media.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        childAge: r.ageSuggestion,
        content: r.comment,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
      })),
    }

    return NextResponse.json(transformed)
  } catch (error) {
    console.error("Database error:", error)
    return NextResponse.json(
      { error: "Failed to fetch media from database" },
      { status: 500 }
    )
  }
}
