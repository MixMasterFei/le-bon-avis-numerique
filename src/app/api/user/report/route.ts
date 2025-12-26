import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { reviewId, reason, details } = body

    if (!reviewId) {
      return NextResponse.json({ error: "reviewId requis" }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: "reason requis" }, { status: 400 })
    }

    // Check if already reported by this user
    const existing = await prisma.reviewReport.findUnique({
      where: {
        reviewId_userId: {
          reviewId,
          userId: session.user.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Vous avez déjà signalé ce commentaire" },
        { status: 400 }
      )
    }

    // Create report
    await prisma.reviewReport.create({
      data: {
        reviewId,
        userId: session.user.id,
        reason,
        details: details || null,
      },
    })

    return NextResponse.json({ success: true, message: "Signalement enregistré" })
  } catch (error) {
    console.error("Report error:", error)
    return NextResponse.json(
      { error: "Erreur lors du signalement" },
      { status: 500 }
    )
  }
}

// Get reports for admin
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Check if user is admin or moderator
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }

    const status = request.nextUrl.searchParams.get("status") || "PENDING"

    const reports = await prisma.reviewReport.findMany({
      where: { status: status as any },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("Get reports error:", error)
    return NextResponse.json({ error: "Erreur" }, { status: 500 })
  }
}
