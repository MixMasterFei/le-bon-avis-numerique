/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/admin/corrections - Get all correction reports (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const type = searchParams.get("type")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (type) {
      where.type = type
    }

    const [corrections, total] = await Promise.all([
      prisma.mediaCorrection.findMany({
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
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mediaCorrection.count({ where }),
    ])

    // Get stats
    const stats = await prisma.mediaCorrection.groupBy({
      by: ["status"],
      _count: true,
    })

    return NextResponse.json({
      corrections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: stats.reduce((acc, s) => {
        acc[s.status] = s._count
        return acc
      }, {} as Record<string, number>),
    })
  } catch (error) {
    console.error("Error fetching corrections:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

// PATCH /api/admin/corrections - Update correction status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès réservé aux administrateurs" }, { status: 403 })
    }

    const body = await request.json()
    const { id, status, adminNotes } = body

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }

    const validStatuses = ["PENDING", "REVIEWED", "APPROVED", "REJECTED", "DUPLICATE"]
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 })
    }

    const correction = await prisma.mediaCorrection.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(status && status !== "PENDING" && {
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
        }),
      },
      include: {
        media: {
          select: {
            title: true,
          },
        },
      },
    })

    return NextResponse.json({ correction })
  } catch (error) {
    console.error("Error updating correction:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
