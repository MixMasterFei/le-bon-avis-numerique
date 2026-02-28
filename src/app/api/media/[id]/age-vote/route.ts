import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET — Fetch vote counts + user's own vote for a media item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    const [agrees, disagrees, userVote] = await Promise.all([
      prisma.ageVote.count({ where: { mediaId: id, agree: true } }),
      prisma.ageVote.count({ where: { mediaId: id, agree: false } }),
      session?.user?.id
        ? prisma.ageVote.findUnique({
            where: { userId_mediaId: { userId: session.user.id, mediaId: id } },
          })
        : null,
    ])

    const total = agrees + disagrees
    const agreePercent = total > 0 ? Math.round((agrees / total) * 100) : null

    return NextResponse.json({
      agrees,
      disagrees,
      total,
      agreePercent,
      userVote: userVote ? { agree: userVote.agree, suggestedAge: userVote.suggestedAge } : null,
    })
  } catch (error) {
    console.error("AgeVote GET error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}

// POST — Cast or update a vote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { agree, suggestedAge } = body

    if (typeof agree !== "boolean") {
      return NextResponse.json({ error: "Le champ 'agree' est requis" }, { status: 400 })
    }

    const vote = await prisma.ageVote.upsert({
      where: {
        userId_mediaId: { userId: session.user.id, mediaId: id },
      },
      create: {
        userId: session.user.id,
        mediaId: id,
        agree,
        suggestedAge: suggestedAge ? parseInt(suggestedAge) : null,
      },
      update: {
        agree,
        suggestedAge: suggestedAge ? parseInt(suggestedAge) : null,
      },
    })

    return NextResponse.json({ success: true, vote })
  } catch (error) {
    console.error("AgeVote POST error:", error)
    return NextResponse.json({ error: "Erreur lors du vote" }, { status: 500 })
  }
}
