import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { VALID_SENSITIVE_WARNINGS, TRIGGER_CONSENSUS } from "@/lib/sensitive-warnings"

interface CategoryConsensus {
  present: number
  absent: number
  total: number
  presentPercent: number | null
  userVote: boolean | null
}

function emptyConsensus(): CategoryConsensus {
  return { present: 0, absent: 0, total: 0, presentPercent: null, userVote: null }
}

// GET — per-category vote tallies + the caller's own votes for a media item.
// Read-only and works unauthenticated. Only categories with >=1 vote appear;
// the UI overlays them onto the AI-seeded chips, so a zero-vote category simply
// renders in its default "AI-only" state.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    const [grouped, userVotes] = await Promise.all([
      prisma.triggerVote.groupBy({
        by: ["category", "present"],
        where: { mediaId: id },
        _count: true,
      }),
      session?.user?.id
        ? prisma.triggerVote.findMany({
            where: { userId: session.user.id, mediaId: id },
            select: { category: true, present: true },
          })
        : Promise.resolve([] as { category: string; present: boolean }[]),
    ])

    const categories: Record<string, CategoryConsensus> = {}
    for (const g of grouped) {
      const c = categories[g.category] ?? emptyConsensus()
      if (g.present) c.present += g._count
      else c.absent += g._count
      categories[g.category] = c
    }
    for (const c of Object.values(categories)) {
      c.total = c.present + c.absent
      c.presentPercent = c.total > 0 ? Math.round((c.present / c.total) * 100) : null
    }
    for (const v of userVotes) {
      if (!categories[v.category]) categories[v.category] = emptyConsensus()
      categories[v.category].userVote = v.present
    }

    return NextResponse.json({ categories, threshold: TRIGGER_CONSENSUS })
  } catch (error) {
    console.error("TriggerVote GET error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}

// POST — cast/update/clear one (category, present) vote.
// Body: { category, present: boolean } to vote, or { category, present: null }
// to clear (re-tapping the active choice). Parent-only (must have a family
// member), mirroring the family-warning-vote gate.
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
        { error: "Vous devez avoir un profil famille pour confirmer un point de vigilance" },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { category, present } = body

    if (!(VALID_SENSITIVE_WARNINGS as readonly string[]).includes(category)) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 })
    }

    // present: null → clear the vote (toggle off)
    if (present === null) {
      await prisma.triggerVote.deleteMany({
        where: { userId: session.user.id, mediaId: id, category },
      })
      return NextResponse.json({ success: true })
    }

    if (typeof present !== "boolean") {
      return NextResponse.json({ error: "Le champ 'present' est requis" }, { status: 400 })
    }

    await prisma.triggerVote.upsert({
      where: {
        userId_mediaId_category: { userId: session.user.id, mediaId: id, category },
      },
      create: { userId: session.user.id, mediaId: id, category, present },
      update: { present },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("TriggerVote POST error:", error)
    return NextResponse.json({ error: "Erreur lors du vote" }, { status: 500 })
  }
}
