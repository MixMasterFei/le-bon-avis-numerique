import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Test 1: Simple lookup
    const simpleMedia = await prisma.mediaItem.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
      },
    })

    // Test 2: Full lookup with includes (like the page does)
    let fullMedia = null
    let fullError = null
    try {
      fullMedia = await prisma.mediaItem.findUnique({
        where: { id },
        include: {
          contentMetrics: true,
          screenshots: {
            orderBy: { order: "asc" },
            take: 6,
          },
          reviews: {
            include: {
              user: {
                select: { id: true, name: true, image: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      })
    } catch (e) {
      fullError = e instanceof Error ? e.message : "Unknown error"
    }

    return NextResponse.json({
      searchedId: id,
      simpleQuery: {
        success: !!simpleMedia,
        media: simpleMedia,
      },
      fullQuery: {
        success: !!fullMedia,
        error: fullError,
        hasMedia: !!fullMedia,
        title: fullMedia?.title,
        reviewsCount: fullMedia?.reviews?.length ?? 0,
        hasContentMetrics: !!fullMedia?.contentMetrics,
        screenshotsCount: fullMedia?.screenshots?.length ?? 0,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      searchedId: id,
    }, { status: 500 })
  }
}
