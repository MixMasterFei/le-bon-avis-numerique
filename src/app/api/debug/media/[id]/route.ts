import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Try direct UUID lookup
    const media = await prisma.mediaItem.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true,
      },
    })

    if (media) {
      return NextResponse.json({
        success: true,
        source: "uuid",
        media,
      })
    }

    // Try tmdbId lookup
    const numericId = parseInt(id)
    if (!isNaN(numericId)) {
      const mediaByTmdb = await prisma.mediaItem.findFirst({
        where: { tmdbId: numericId },
        select: {
          id: true,
          title: true,
          type: true,
          posterUrl: true,
          tmdbId: true,
        },
      })

      if (mediaByTmdb) {
        return NextResponse.json({
          success: true,
          source: "tmdbId",
          media: mediaByTmdb,
        })
      }
    }

    return NextResponse.json({
      success: false,
      error: "Not found",
      searchedId: id,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      searchedId: id,
    }, { status: 500 })
  }
}
