import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { COMMUNITY_WARNING_THRESHOLD } from "@/lib/family-warning"

// GET — Fetch flag count + user's own vote for a media item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    const [flagCount, userVote] = await Promise.all([
      prisma.familyWarningVote.count({ where: { mediaId: id } }),
      session?.user?.id
        ? prisma.familyWarningVote.findUnique({
            where: { userId_mediaId: { userId: session.user.id, mediaId: id } },
          })
        : null,
    ])

    return NextResponse.json({
      flagCount,
      userHasFlagged: !!userVote,
      threshold: COMMUNITY_WARNING_THRESHOLD,
    })
  } catch (error) {
    console.error("FamilyWarningVote GET error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}

// POST — Toggle a family warning flag
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 })
    }

    // Must have at least one family member (proves parent status)
    const memberCount = await prisma.familyMember.count({
      where: { userId: session.user.id },
    })
    if (memberCount === 0) {
      return NextResponse.json(
        { error: "Vous devez avoir un profil famille pour signaler du contenu" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { flag } = body

    if (typeof flag !== "boolean") {
      return NextResponse.json({ error: "Le champ 'flag' est requis" }, { status: 400 })
    }

    if (flag) {
      // Create or re-create the flag
      await prisma.familyWarningVote.upsert({
        where: {
          userId_mediaId: { userId: session.user.id, mediaId: id },
        },
        create: {
          userId: session.user.id,
          mediaId: id,
        },
        update: {},
      })
    } else {
      // Remove the flag
      await prisma.familyWarningVote.deleteMany({
        where: {
          userId: session.user.id,
          mediaId: id,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("FamilyWarningVote POST error:", error)
    return NextResponse.json({ error: "Erreur lors du signalement" }, { status: 500 })
  }
}
