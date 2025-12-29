import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/user/favorites - Get all user favorites
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 })
    }

    const favorites = await prisma.favorite.findMany({
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
    const mappedFavorites = favorites.map((f) => ({
      id: f.media.id,
      title: f.media.title,
      originalTitle: f.media.originalTitle,
      type: f.media.type,
      releaseDate: f.media.releaseDate,
      posterUrl: f.media.posterUrl || "",
      synopsisFr: f.media.synopsisFr,
      officialRating: f.media.officialRating,
      expertAgeRec: f.media.expertAgeRec,
      communityAgeRec: f.media.communityAgeRec,
      genres: f.media.genres || [],
      platforms: f.media.platforms || [],
      topics: f.media.topics || [],
      contentMetrics: null,
      reviews: [],
    }))

    return NextResponse.json({ favorites: mappedFavorites })
  } catch (error) {
    console.error("Get favorites error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
