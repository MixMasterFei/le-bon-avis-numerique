import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { mediaId } = body

    if (!mediaId) {
      return NextResponse.json({ error: "mediaId requis" }, { status: 400 })
    }

    // Check if already in watchlist
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_mediaId: {
          userId: session.user.id,
          mediaId,
        },
      },
    })

    if (existing) {
      // Remove from watchlist
      await prisma.watchlist.delete({
        where: { id: existing.id },
      })
      return NextResponse.json({ success: true, inWatchlist: false })
    }

    // Add to watchlist
    await prisma.watchlist.create({
      data: {
        userId: session.user.id,
        mediaId,
      },
    })

    return NextResponse.json({ success: true, inWatchlist: true })
  } catch (error) {
    console.error("Watchlist error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const mediaId = request.nextUrl.searchParams.get("mediaId")

    if (mediaId) {
      // Check if specific media is in watchlist
      const existing = await prisma.watchlist.findUnique({
        where: {
          userId_mediaId: {
            userId: session.user.id,
            mediaId,
          },
        },
      })
      return NextResponse.json({ inWatchlist: !!existing })
    }

    // Get all user watchlist
    const watchlistItems = await prisma.watchlist.findMany({
      where: { userId: session.user.id },
      include: {
        media: {
          select: {
            id: true,
            title: true,
            originalTitle: true,
            posterUrl: true,
            type: true,
            releaseDate: true,
            synopsisFr: true,
            officialRating: true,
            expertAgeRec: true,
            communityAgeRec: true,
            genres: true,
            platforms: true,
            topics: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Map to the format expected by the page
    const watchlist = watchlistItems.map((w) => ({
      id: w.media.id,
      title: w.media.title,
      originalTitle: w.media.originalTitle,
      type: w.media.type,
      releaseDate: w.media.releaseDate,
      posterUrl: w.media.posterUrl || "",
      synopsisFr: w.media.synopsisFr,
      officialRating: w.media.officialRating,
      expertAgeRec: w.media.expertAgeRec,
      communityAgeRec: w.media.communityAgeRec,
      genres: w.media.genres || [],
      platforms: w.media.platforms || [],
      topics: w.media.topics || [],
      contentMetrics: null,
      reviews: [],
    }))

    return NextResponse.json({ watchlist })
  } catch (error) {
    console.error("Get watchlist error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
