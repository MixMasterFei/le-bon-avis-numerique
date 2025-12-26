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

    // Check if already favorited
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_mediaId: {
          userId: session.user.id,
          mediaId,
        },
      },
    })

    if (existing) {
      // Remove from favorites
      await prisma.favorite.delete({
        where: { id: existing.id },
      })
      return NextResponse.json({ success: true, favorited: false })
    }

    // Add to favorites
    await prisma.favorite.create({
      data: {
        userId: session.user.id,
        mediaId,
      },
    })

    return NextResponse.json({ success: true, favorited: true })
  } catch (error) {
    console.error("Favorite error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const mediaId = request.nextUrl.searchParams.get("mediaId")

    if (mediaId) {
      // Get favorite count for a specific media
      const count = await prisma.favorite.count({
        where: { mediaId },
      })

      // Check if current user has favorited
      const session = await auth()
      let userFavorited = false
      if (session?.user?.id) {
        const existing = await prisma.favorite.findUnique({
          where: {
            userId_mediaId: {
              userId: session.user.id,
              mediaId,
            },
          },
        })
        userFavorited = !!existing
      }

      return NextResponse.json({ count, userFavorited })
    }

    // Get all user favorites
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: {
        media: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            type: true,
            expertAgeRec: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ favorites })
  } catch (error) {
    console.error("Get favorites error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
