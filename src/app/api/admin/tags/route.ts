import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Check if user is admin
async function checkAdmin() {
  const session = await auth()
  return {
    isAdmin: session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR",
    userId: session?.user?.id,
  }
}

// GET: Get all tags with counts, or get movies with a specific tag
export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await checkAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const tag = searchParams.get("tag")
    const type = searchParams.get("type") || "MOVIE"

    if (tag) {
      // Get all movies with this specific tag
      const items = await prisma.mediaItem.findMany({
        where: {
          type: type as "MOVIE" | "TV" | "GAME",
          topics: { has: tag },
        },
        select: {
          id: true,
          title: true,
          originalTitle: true,
          posterUrl: true,
          genres: true,
          topics: true,
          expertAgeRec: true,
          releaseDate: true,
        },
        orderBy: { title: "asc" },
        take: 200,
      })

      return NextResponse.json({
        success: true,
        tag,
        count: items.length,
        items,
      })
    }

    // Get all unique tags with counts
    const allItems = await prisma.mediaItem.findMany({
      where: { type: type as "MOVIE" | "TV" | "GAME" },
      select: { topics: true },
    })

    const tagCounts: Record<string, number> = {}
    for (const item of allItems) {
      for (const topic of item.topics) {
        tagCounts[topic] = (tagCounts[topic] || 0) + 1
      }
    }

    // Sort by count descending
    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }))

    return NextResponse.json({
      success: true,
      type,
      totalTags: sortedTags.length,
      tags: sortedTags,
    })
  } catch (error) {
    console.error("Tags API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get tags" },
      { status: 500 }
    )
  }
}

// POST: Remove a tag from specific movies or all movies
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, userId } = await checkAdmin()
    if (!isAdmin || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()
    const { action, tag, mediaIds, type = "MOVIE" } = body

    if (!tag) {
      return NextResponse.json({ error: "Tag is required" }, { status: 400 })
    }

    if (action === "remove_from_all") {
      // Remove tag from all items of this type
      const items = await prisma.mediaItem.findMany({
        where: {
          type: type as "MOVIE" | "TV" | "GAME",
          topics: { has: tag },
        },
        select: { id: true, topics: true },
      })

      let updated = 0
      for (const item of items) {
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            topics: item.topics.filter((t) => t !== tag),
          },
        })
        updated++
      }

      // Log admin activity
      await prisma.adminActivity.create({
        data: {
          userId,
          action: "BULK_REMOVE_TAG",
          entityType: type,
          details: JSON.stringify({ tag, removedFrom: updated }),
        },
      })

      return NextResponse.json({
        success: true,
        message: `Removed "${tag}" from ${updated} items`,
        updated,
      })
    }

    if (action === "remove_from_selected" && Array.isArray(mediaIds)) {
      // Remove tag from specific items
      let updated = 0
      for (const id of mediaIds) {
        const item = await prisma.mediaItem.findUnique({
          where: { id },
          select: { topics: true },
        })

        if (item && item.topics.includes(tag)) {
          await prisma.mediaItem.update({
            where: { id },
            data: {
              topics: item.topics.filter((t) => t !== tag),
            },
          })
          updated++
        }
      }

      // Log admin activity
      await prisma.adminActivity.create({
        data: {
          userId,
          action: "REMOVE_TAG",
          entityType: type,
          details: JSON.stringify({ tag, mediaIds, removedFrom: updated }),
        },
      })

      return NextResponse.json({
        success: true,
        message: `Removed "${tag}" from ${updated} items`,
        updated,
      })
    }

    if (action === "add_to_selected" && Array.isArray(mediaIds)) {
      // Add tag to specific items
      let updated = 0
      for (const id of mediaIds) {
        const item = await prisma.mediaItem.findUnique({
          where: { id },
          select: { topics: true },
        })

        if (item && !item.topics.includes(tag)) {
          await prisma.mediaItem.update({
            where: { id },
            data: {
              topics: [...item.topics, tag],
            },
          })
          updated++
        }
      }

      return NextResponse.json({
        success: true,
        message: `Added "${tag}" to ${updated} items`,
        updated,
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Tags API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update tags" },
      { status: 500 }
    )
  }
}
