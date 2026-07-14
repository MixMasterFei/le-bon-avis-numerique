import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recomputeMemberVectorSafe } from "@/lib/preference-vector/recompute"

// GET /api/user/reaction?mediaId=xxx - Get reactions for a media item by user's family
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get("mediaId")

    if (!mediaId) {
      return NextResponse.json({ error: "mediaId requis" }, { status: 400 })
    }

    // Get all family members with their reaction (if any) for this media
    const familyMembers = await prisma.familyMember.findMany({
      where: { userId: session.user.id },
      include: {
        reactions: {
          where: { mediaId },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    // Transform to include reaction directly
    const membersWithReactions = familyMembers.map((member) => ({
      id: member.id,
      name: member.name,
      birthYear: member.birthYear,
      birthMonth: member.birthMonth,
      avatarEmoji: member.avatarEmoji,
      avatarStyle: member.avatarStyle,
      avatarSeed: member.avatarSeed,
      avatarOptions: member.avatarOptions,
      reaction: member.reactions[0] || null,
    }))

    return NextResponse.json({ familyMembers: membersWithReactions })
  } catch (error) {
    console.error("Error fetching reactions:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST /api/user/reaction - Add or update a reaction
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { familyMemberId, mediaId, reaction, note, source } = body

    if (!familyMemberId || !mediaId || !reaction) {
      return NextResponse.json(
        { error: "familyMemberId, mediaId et reaction requis" },
        { status: 400 }
      )
    }

    // Verify ownership of family member
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: familyMemberId,
        userId: session.user.id,
      },
    })

    if (!familyMember) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    // Verify media exists
    const media = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
    })

    if (!media) {
      return NextResponse.json({ error: "Média non trouvé" }, { status: 404 })
    }

    // Valid reaction types. NOT_FOR_ME is intent (used by quiz anchors); the
    // other values are organic post-watch reactions.
    const validReactions = ["WATCHED", "LOVED", "LIKED", "OK", "SCARED", "BORED", "TOO_YOUNG", "TOO_OLD", "NOT_FOR_ME", "WANTS_TO_WATCH"]
    if (!validReactions.includes(reaction)) {
      return NextResponse.json({ error: "Réaction invalide" }, { status: 400 })
    }

    // Source defaults to organic; the quiz anchor picker sends "quiz_anchor".
    const reactionSource: "organic" | "quiz_anchor" =
      source === "quiz_anchor" ? "quiz_anchor" : "organic"

    // Upsert the reaction
    const mediaReaction = await prisma.mediaReaction.upsert({
      where: {
        familyMemberId_mediaId: {
          familyMemberId,
          mediaId,
        },
      },
      create: {
        familyMemberId,
        mediaId,
        reaction,
        note: note || null,
        source: reactionSource,
      },
      update: {
        reaction,
        note: note || null,
        source: reactionSource,
      },
    })

    // Phase 2: refresh the behavioral preference vector. Safe variant —
    // errors here must not fail the reaction write itself.
    await recomputeMemberVectorSafe(familyMemberId)

    return NextResponse.json({ reaction: mediaReaction })
  } catch (error) {
    console.error("Error saving reaction:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE /api/user/reaction - Remove a reaction
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const familyMemberId = searchParams.get("familyMemberId")
    const mediaId = searchParams.get("mediaId")

    if (!familyMemberId || !mediaId) {
      return NextResponse.json(
        { error: "familyMemberId et mediaId requis" },
        { status: 400 }
      )
    }

    // Verify ownership
    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id: familyMemberId,
        userId: session.user.id,
      },
    })

    if (!familyMember) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    await prisma.mediaReaction.deleteMany({
      where: { familyMemberId, mediaId },
    })

    // Phase 2: a removed reaction can also shift the vector.
    await recomputeMemberVectorSafe(familyMemberId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting reaction:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
