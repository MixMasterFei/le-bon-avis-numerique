import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeInput } from "@/lib/security"

// Don't publish (or display) a community age until enough parents have voted.
// A single review used to set communityAgeRec outright — noisy and trivially
// gameable. Below this count the field stays null and the UI shows nothing.
const MIN_COMMUNITY_AGE_VOTES = 3

// Recompute a title's community age from its reviews, applying the vote
// threshold. Shared by POST (new/updated review) and DELETE (review removed).
async function recomputeCommunityAge(mediaId: string) {
  const reviews = await prisma.review.findMany({
    where: { mediaId, ageSuggestion: { not: null } },
    select: { ageSuggestion: true },
  })
  if (reviews.length >= MIN_COMMUNITY_AGE_VOTES) {
    const avgAge = reviews.reduce((sum, r) => sum + (r.ageSuggestion || 0), 0) / reviews.length
    await prisma.mediaItem.update({ where: { id: mediaId }, data: { communityAgeRec: avgAge } })
  } else {
    await prisma.mediaItem.update({ where: { id: mediaId }, data: { communityAgeRec: null } })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { mediaId, role, rating, ageSuggestion, comment, familyMemberId } = body

    if (!mediaId || !role || !rating) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      )
    }

    // Validate + bound all user-supplied values before they touch the DB.
    const cleanRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 0)))
    const cleanAge =
      typeof ageSuggestion === "number" && Number.isFinite(ageSuggestion)
        ? Math.min(18, Math.max(0, Math.round(ageSuggestion)))
        : null
    const cleanComment =
      typeof comment === "string" && comment.trim().length > 0 ? sanitizeInput(comment) : null

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
          rating: cleanRating,
          ageSuggestion: cleanAge,
          comment: cleanComment,
          familyMemberId: familyMemberId || null,
        },
      })
      await recomputeCommunityAge(mediaId)
      return NextResponse.json({ success: true, review: updated, updated: true })
    }

    // Create new review
    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        mediaId,
        role,
        rating: cleanRating,
        ageSuggestion: cleanAge,
        comment: cleanComment,
        familyMemberId: familyMemberId || null,
      },
    })

    await recomputeCommunityAge(mediaId)

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

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { reviewId, comment } = body

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
      return NextResponse.json(
        { error: "Vous ne pouvez modifier que vos propres avis" },
        { status: 403 }
      )
    }

    // Update the review with editedAt timestamp (sanitize the edited comment).
    const cleanComment =
      typeof comment === "string" && comment.trim().length > 0
        ? sanitizeInput(comment)
        : review.comment
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        comment: cleanComment,
        editedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, review: updated })
  } catch (error) {
    console.error("Edit review error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la modification" },
      { status: 500 }
    )
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

    // Recalculate community age recommendation (applies the vote threshold).
    await recomputeCommunityAge(review.mediaId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete review error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
