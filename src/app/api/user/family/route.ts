import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/user/family - Get all family members for the current user
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const familyMembers = await prisma.familyMember.findMany({
      where: { userId: session.user.id },
      include: {
        reactions: {
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
          take: 10,
        },
        _count: {
          select: { reactions: true },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ familyMembers })
  } catch (error) {
    console.error("Error fetching family members:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// POST /api/user/family - Create a new family member
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { name, birthYear, avatarEmoji } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 })
    }

    // Limit to 10 family members per user
    const existingCount = await prisma.familyMember.count({
      where: { userId: session.user.id },
    })

    if (existingCount >= 10) {
      return NextResponse.json(
        { error: "Maximum 10 membres de famille autorisés" },
        { status: 400 }
      )
    }

    const familyMember = await prisma.familyMember.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        birthYear: birthYear ? parseInt(birthYear) : null,
        avatarEmoji: avatarEmoji || "👧",
      },
    })

    return NextResponse.json({ familyMember }, { status: 201 })
  } catch (error) {
    console.error("Error creating family member:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
