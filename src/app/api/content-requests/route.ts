import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Validation schema for content request
const contentRequestSchema = z.object({
  title: z.string().min(1).max(255),
  mediaType: z.enum(["MOVIE", "TV", "GAME", "BOOK", "APP"]),
  externalId: z.string().optional(),
  description: z.string().optional(),
})

// POST: User submits a new content request
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validated = contentRequestSchema.parse(body)

    // Check for duplicate request from same user
    const existing = await prisma.contentRequest.findFirst({
      where: {
        userId: session.user.id,
        title: { equals: validated.title, mode: "insensitive" },
        status: { in: ["PENDING", "REVIEWING"] },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Vous avez déjà soumis une demande pour ce contenu" },
        { status: 400 }
      )
    }

    const contentRequest = await prisma.contentRequest.create({
      data: {
        userId: session.user.id,
        title: validated.title,
        mediaType: validated.mediaType,
        externalId: validated.externalId || null,
        description: validated.description || null,
      },
    })

    return NextResponse.json({
      success: true,
      contentRequest,
      message: "Votre demande a été soumise avec succès",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Content request error:", error)
    return NextResponse.json(
      { error: "Failed to submit content request" },
      { status: 500 }
    )
  }
}

// GET: User gets their own content requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const status = searchParams.get("status")

    const where: { userId: string; status?: string } = { userId: session.user.id }
    if (status) {
      where.status = status
    }

    const [requests, total] = await Promise.all([
      prisma.contentRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          media: {
            select: { id: true, title: true, type: true, posterUrl: true },
          },
        },
      }),
      prisma.contentRequest.count({ where }),
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
    })
  } catch (error) {
    console.error("Get content requests error:", error)
    return NextResponse.json(
      { error: "Failed to get content requests" },
      { status: 500 }
    )
  }
}
