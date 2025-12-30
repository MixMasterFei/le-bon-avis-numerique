import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma, MediaType } from "@prisma/client"

export const maxDuration = 60

// GET - Fetch low quality items
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const maxScore = parseInt(searchParams.get("maxScore") || "30")
  const type = searchParams.get("type") as MediaType | null

  const skip = (page - 1) * limit

  try {
    const where: Prisma.MediaItemWhereInput = {
      dataQualityScore: { lt: maxScore },
      ...(type && { type }),
    }

    const [items, total, byType] = await Promise.all([
      prisma.mediaItem.findMany({
        where,
        orderBy: { dataQualityScore: "asc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          type: true,
          posterUrl: true,
          synopsisFr: true,
          releaseDate: true,
          genres: true,
          expertAgeRec: true,
          dataQualityScore: true,
          tmdbId: true,
          igdbId: true,
          createdAt: true,
        },
      }),
      prisma.mediaItem.count({ where }),
      prisma.mediaItem.groupBy({
        by: ["type"],
        where: { dataQualityScore: { lt: maxScore } },
        _count: true,
      }),
    ])

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      byType: byType.reduce((acc, curr) => {
        acc[curr.type] = curr._count
        return acc
      }, {} as Record<string, number>),
    })
  } catch (error) {
    console.error("Error fetching low quality items:", error)
    return NextResponse.json(
      { error: "Failed to fetch low quality items" },
      { status: 500 }
    )
  }
}

// DELETE - Bulk delete low quality items
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, deleteAll, maxScore = 30, type } = body

    if (deleteAll) {
      // Delete all items below maxScore (optionally filtered by type)
      const where = {
        dataQualityScore: { lt: maxScore },
        ...(type && { type }),
      }

      const result = await prisma.mediaItem.deleteMany({ where })

      return NextResponse.json({
        success: true,
        deleted: result.count,
      })
    } else if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific items by ID
      const result = await prisma.mediaItem.deleteMany({
        where: { id: { in: ids } },
      })

      return NextResponse.json({
        success: true,
        deleted: result.count,
      })
    } else {
      return NextResponse.json(
        { error: "No items specified for deletion" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error deleting low quality items:", error)
    return NextResponse.json(
      { error: "Failed to delete items" },
      { status: 500 }
    )
  }
}
