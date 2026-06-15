import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * PATCH /api/user/family/reorder
 * Body: { orderedIds: string[] } — the family member ids in the desired card
 * priority order. Sets displayOrder = index for each owned member. Members not
 * in the list keep their current order (pushed after, by createdAt fallback).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const orderedIds: unknown = body?.orderedIds
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "orderedIds invalide" }, { status: 400 })
    }

    // Only reorder members the user actually owns (ignore foreign/unknown ids).
    const owned = await prisma.familyMember.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })
    const ownedSet = new Set(owned.map((m) => m.id))
    const ids = (orderedIds as string[]).filter((id) => ownedSet.has(id))

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.familyMember.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    )

    return NextResponse.json({ ok: true, count: ids.length })
  } catch (error) {
    console.error("Error reordering family members:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
