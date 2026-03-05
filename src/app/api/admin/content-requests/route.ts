/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Check if user is admin
async function checkAdmin() {
  const session = await auth()
  return {
    isAdmin: session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR",
    userId: session?.user?.id,
  }
}

// GET: Admin gets all content requests
export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await checkAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const status = searchParams.get("status")
    const mediaType = searchParams.get("mediaType")

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (mediaType) {
      where.mediaType = mediaType
    }

    const [requests, total, statusCounts] = await Promise.all([
      prisma.contentRequest.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          media: {
            select: { id: true, title: true, type: true, posterUrl: true },
          },
        },
      }),
      prisma.contentRequest.count({ where }),
      // Get counts by status
      prisma.contentRequest.groupBy({
        by: ["status"],
        _count: true,
      }),
    ])

    return NextResponse.json({
      success: true,
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      statusCounts: statusCounts.reduce(
        (acc, s) => {
          acc[s.status] = s._count
          return acc
        },
        {} as Record<string, number>
      ),
    })
  } catch (error) {
    console.error("Admin content requests error:", error)
    return NextResponse.json(
      { error: "Failed to get content requests" },
      { status: 500 }
    )
  }
}

// Update schema for PATCH
const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["PENDING", "REVIEWING", "APPROVED", "ADDED", "REJECTED", "DUPLICATE"]).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  adminNotes: z.string().optional(),
  mediaId: z.string().uuid().optional(),
})

// PATCH: Admin updates a content request
export async function PATCH(request: NextRequest) {
  try {
    const { isAdmin, userId } = await checkAdmin()
    if (!userId || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const validated = updateSchema.parse(body)

    const updateData: any = {}
    if (validated.status !== undefined) updateData.status = validated.status
    if (validated.priority !== undefined) updateData.priority = validated.priority
    if (validated.adminNotes !== undefined) updateData.adminNotes = validated.adminNotes
    if (validated.mediaId !== undefined) updateData.mediaId = validated.mediaId

    // Set resolved fields if status is terminal
    if (["ADDED", "REJECTED", "DUPLICATE"].includes(validated.status || "")) {
      updateData.resolvedAt = new Date()
      updateData.resolvedBy = userId
    }

    const updated = await prisma.contentRequest.update({
      where: { id: validated.id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        media: {
          select: { id: true, title: true, type: true },
        },
      },
    })

    // Log admin activity
    await prisma.adminActivity.create({
      data: {
        userId,
        action: "UPDATE_CONTENT_REQUEST",
        entityType: "CONTENT_REQUEST",
        entityId: validated.id,
        details: JSON.stringify({
          newStatus: validated.status,
          title: updated.title,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      contentRequest: updated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Update content request error:", error)
    return NextResponse.json(
      { error: "Failed to update content request" },
      { status: 500 }
    )
  }
}
