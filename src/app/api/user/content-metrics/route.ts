import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Validation schema for content metrics
const metricsSchema = z.object({
  mediaId: z.string().uuid(),
  violence: z.number().int().min(0).max(5),
  sexNudity: z.number().int().min(0).max(5),
  language: z.number().int().min(0).max(5),
  consumerism: z.number().int().min(0).max(5),
  substanceUse: z.number().int().min(0).max(5),
  positiveMessages: z.number().int().min(0).max(5),
  roleModels: z.number().int().min(0).max(5),
})

// POST: User submits or updates their content metrics for a media item
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
    const validated = metricsSchema.parse(body)

    // Check if media exists
    const media = await prisma.mediaItem.findUnique({
      where: { id: validated.mediaId },
      select: { id: true, title: true },
    })

    if (!media) {
      return NextResponse.json(
        { error: "Media not found" },
        { status: 404 }
      )
    }

    // Upsert user metrics
    const metrics = await prisma.userContentMetrics.upsert({
      where: {
        mediaId_userId: {
          mediaId: validated.mediaId,
          userId: session.user.id,
        },
      },
      create: {
        mediaId: validated.mediaId,
        userId: session.user.id,
        violence: validated.violence,
        sexNudity: validated.sexNudity,
        language: validated.language,
        consumerism: validated.consumerism,
        substanceUse: validated.substanceUse,
        positiveMessages: validated.positiveMessages,
        roleModels: validated.roleModels,
      },
      update: {
        violence: validated.violence,
        sexNudity: validated.sexNudity,
        language: validated.language,
        consumerism: validated.consumerism,
        substanceUse: validated.substanceUse,
        positiveMessages: validated.positiveMessages,
        roleModels: validated.roleModels,
      },
    })

    return NextResponse.json({
      success: true,
      metrics,
      message: "Vos évaluations ont été enregistrées",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid metrics data", details: error.issues },
        { status: 400 }
      )
    }
    console.error("User metrics error:", error)
    return NextResponse.json(
      { error: "Failed to save metrics" },
      { status: 500 }
    )
  }
}

// GET: Get user's own metrics for a specific media item
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
    const mediaId = searchParams.get("mediaId")

    if (!mediaId) {
      return NextResponse.json(
        { error: "mediaId is required" },
        { status: 400 }
      )
    }

    const metrics = await prisma.userContentMetrics.findUnique({
      where: {
        mediaId_userId: {
          mediaId,
          userId: session.user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      metrics,
      hasSubmitted: !!metrics,
    })
  } catch (error) {
    console.error("Get user metrics error:", error)
    return NextResponse.json(
      { error: "Failed to get metrics" },
      { status: 500 }
    )
  }
}
