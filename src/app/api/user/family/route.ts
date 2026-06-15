import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeAvatarInput } from "@/lib/avatar"

// GET /api/user/family - Get all family members for the current user
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      console.error("Family API: No user ID in session", { session })
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const familyMembers = await prisma.familyMember.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        birthYear: true,
        birthMonth: true,
        avatarEmoji: true,
        avatarStyle: true,
        avatarSeed: true,
        avatarOptions: true,
        favoriteGenres: true,
        dislikedGenres: true,
        sensitivityViolence: true,
        sensitivityScary: true,
        sensitivitySexual: true,
        sensitivityLanguage: true,
        sensitivitySubstances: true,
        preferPositiveMessages: true,
        preferRoleModels: true,
        preferEducational: true,
        interests: true,
        avoidTopics: true,
        useCustomSettings: true,
        createdAt: true,
        updatedAt: true,
        reactions: {
          select: {
            id: true,
            reaction: true,
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
      // Priority order (parent-set) first, then creation order.
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({ familyMembers })
  } catch (error) {
    console.error("Error fetching family members:", error)
    return NextResponse.json({
      error: "Erreur serveur",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
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
    const { name, birthYear, birthMonth, avatarEmoji, avatarStyle, avatarSeed, avatarOptions, favoriteGenres, dislikedGenres } = body

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

    // Sanitize DiceBear avatar inputs
    const sanitizedAvatar = sanitizeAvatarInput({ avatarStyle, avatarSeed, avatarOptions })

    const familyMember = await prisma.familyMember.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        birthYear: birthYear ? parseInt(birthYear) : null,
        birthMonth: birthMonth ? Math.min(12, Math.max(1, parseInt(birthMonth))) : null,
        avatarEmoji: avatarEmoji || "👧",
        ...(sanitizedAvatar.avatarStyle && { avatarStyle: sanitizedAvatar.avatarStyle }),
        ...(sanitizedAvatar.avatarSeed && { avatarSeed: sanitizedAvatar.avatarSeed }),
        ...(sanitizedAvatar.avatarOptions && { avatarOptions: sanitizedAvatar.avatarOptions as object }),
        favoriteGenres: Array.isArray(favoriteGenres) ? favoriteGenres : [],
        dislikedGenres: Array.isArray(dislikedGenres) ? dislikedGenres : [],
      },
    })

    return NextResponse.json({ familyMember }, { status: 201 })
  } catch (error) {
    console.error("Error creating family member:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
