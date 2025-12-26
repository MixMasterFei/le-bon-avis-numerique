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
    const { mediaId, role, rating, ageSuggestion, comment } = body

    if (!mediaId || !role || !rating) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      )
    }

    // Check if user already reviewed this media
    const existingReview = await prisma.review.findFirst({
      where: {
        userId: session.user.id,
        mediaId,
      },
    })

    if (existingReview) {
      // Update existing review
      const updated = await prisma.review.update({
        where: { id: existingReview.id },
        data: {
          role,
          rating,
          ageSuggestion,
          comment,
        },
      })
      return NextResponse.json({ success: true, review: updated, updated: true })
    }

    // Create new review
    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        mediaId,
        role,
        rating,
        ageSuggestion,
        comment,
      },
    })

    // Update community age recommendation
    const reviews = await prisma.review.findMany({
      where: { mediaId, ageSuggestion: { not: null } },
      select: { ageSuggestion: true },
    })

    if (reviews.length > 0) {
      const avgAge = reviews.reduce((sum, r) => sum + (r.ageSuggestion || 0), 0) / reviews.length
      await prisma.mediaItem.update({
        where: { id: mediaId },
        data: { communityAgeRec: avgAge },
      })
    }

    return NextResponse.json({ success: true, review })
  } catch (error) {
    console.error("Review error:", error)
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
    if (!mediaId) {
      return NextResponse.json({ error: "mediaId requis" }, { status: 400 })
    }

    const review = await prisma.review.findFirst({
      where: {
        userId: session.user.id,
        mediaId,
      },
    })

    return NextResponse.json({ review })
  } catch (error) {
    console.error("Get review error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const reviewId = request.nextUrl.searchParams.get("reviewId")
    if (!reviewId) {
      return NextResponse.json({ error: "reviewId requis" }, { status: 400 })
    }

    // Find the review and verify ownership
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    })

    if (!review) {
      return NextResponse.json({ error: "Avis non trouvé" }, { status: 404 })
    }

    if (review.userId !== session.user.id) {
      // Check if user is admin/moderator
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })

      if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
        return NextResponse.json(
          { error: "Vous ne pouvez supprimer que vos propres avis" },
          { status: 403 }
        )
      }
    }

    // Delete the review
    await prisma.review.delete({
      where: { id: reviewId },
    })

    // Recalculate community age recommendation
    const remainingReviews = await prisma.review.findMany({
      where: { mediaId: review.mediaId, ageSuggestion: { not: null } },
      select: { ageSuggestion: true },
    })

    if (remainingReviews.length > 0) {
      const avgAge =
        remainingReviews.reduce((sum, r) => sum + (r.ageSuggestion || 0), 0) /
        remainingReviews.length
      await prisma.mediaItem.update({
        where: { id: review.mediaId },
        data: { communityAgeRec: avgAge },
      })
    } else {
      await prisma.mediaItem.update({
        where: { id: review.mediaId },
        data: { communityAgeRec: null },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete review error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
