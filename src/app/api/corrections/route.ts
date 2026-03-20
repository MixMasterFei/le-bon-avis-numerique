import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CorrectionType, Prisma } from "@prisma/client"

// POST /api/corrections - Submit a new correction report
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vous devez être connecté pour signaler une erreur" }, { status: 401 })
    }

    const body = await request.json()
    const { mediaId, type, field, currentValue, suggestedValue, description } = body

    // Validate required fields
    if (!mediaId || typeof mediaId !== "string") {
      return NextResponse.json({ error: "ID du média requis" }, { status: 400 })
    }

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "Type de correction requis" }, { status: 400 })
    }

    if (!description || typeof description !== "string" || description.trim().length < 10) {
      return NextResponse.json({ error: "Description requise (minimum 10 caractères)" }, { status: 400 })
    }

    // Validate correction type
    const validTypes = ["WRONG_INFO", "MISSING_INFO", "AGE_RATING", "CONTENT_WARNING", "BROKEN_LINK", "DUPLICATE", "OTHER"]
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Type de correction invalide" }, { status: 400 })
    }

    // Check if media exists
    const media = await prisma.mediaItem.findUnique({
      where: { id: mediaId },
      select: { id: true, title: true },
    })

    if (!media) {
      return NextResponse.json({ error: "Média non trouvé" }, { status: 404 })
    }

    // Check for recent duplicate reports from same user for same media
    const recentReport = await prisma.mediaCorrection.findFirst({
      where: {
        userId: session.user.id,
        mediaId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    })

    if (recentReport) {
      return NextResponse.json(
        { error: "Vous avez déjà signalé une erreur pour ce média récemment. Merci de patienter 24h." },
        { status: 429 }
      )
    }

    // Create the correction report
    const correction = await prisma.mediaCorrection.create({
      data: {
        mediaId,
        userId: session.user.id,
        type: type as CorrectionType,
        field: field || null,
        currentValue: currentValue || null,
        suggestedValue: suggestedValue || null,
        description: description.trim(),
      },
      include: {
        media: {
          select: {
            title: true,
            type: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Merci pour votre signalement ! Notre équipe va l'examiner.",
      correction: {
        id: correction.id,
        mediaTitle: correction.media.title,
        type: correction.type,
        status: correction.status,
        createdAt: correction.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating correction:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// GET /api/corrections - Get user's correction reports
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mediaId = searchParams.get("mediaId")

    const where: Prisma.MediaCorrectionWhereInput = { userId: session.user.id }
    if (mediaId) {
      where.mediaId = mediaId
    }

    const corrections = await prisma.mediaCorrection.findMany({
      where,
      include: {
        media: {
          select: {
            id: true,
            title: true,
            type: true,
            posterUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json({ corrections })
  } catch (error) {
    console.error("Error fetching corrections:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
