import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sanitizeAvatarInput } from "@/lib/avatar"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/user/family/[id] - Get a specific family member with reactions
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await params

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
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
                genres: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!familyMember) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    return NextResponse.json({ familyMember })
  } catch (error) {
    console.error("Error fetching family member:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PATCH /api/user/family/[id] - Update a family member
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, birthYear, avatarEmoji, avatarStyle, avatarSeed, avatarOptions, favoriteGenres, dislikedGenres, interests } = body

    // Verify ownership
    const existing = await prisma.familyMember.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    // Sanitize DiceBear avatar inputs if provided
    const sanitizedAvatar = sanitizeAvatarInput({ avatarStyle, avatarSeed, avatarOptions })

    const familyMember = await prisma.familyMember.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(birthYear !== undefined && { birthYear: birthYear ? parseInt(birthYear) : null }),
        ...(avatarEmoji && { avatarEmoji }),
        ...(sanitizedAvatar.avatarStyle !== null && { avatarStyle: sanitizedAvatar.avatarStyle }),
        ...(sanitizedAvatar.avatarSeed !== null && { avatarSeed: sanitizedAvatar.avatarSeed }),
        ...(sanitizedAvatar.avatarOptions !== null && { avatarOptions: sanitizedAvatar.avatarOptions }),
        ...(favoriteGenres !== undefined && { favoriteGenres: Array.isArray(favoriteGenres) ? favoriteGenres : [] }),
        ...(dislikedGenres !== undefined && { dislikedGenres: Array.isArray(dislikedGenres) ? dislikedGenres : [] }),
        ...(interests !== undefined && { interests: Array.isArray(interests) ? interests.map((i: unknown) => String(i).trim()).filter(Boolean).slice(0, 20) : [] }),
      },
    })

    return NextResponse.json({ familyMember })
  } catch (error) {
    console.error("Error updating family member:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// DELETE /api/user/family/[id] - Delete a family member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { id } = await params

    // Verify ownership
    const existing = await prisma.familyMember.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Membre non trouvé" }, { status: 404 })
    }

    await prisma.familyMember.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting family member:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
