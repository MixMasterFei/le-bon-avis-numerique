import { NextRequest, NextResponse } from "next/server"
import { getCollectionSummaries, getCollectionWithItems } from "@/lib/collections"

// Thin wrapper around src/lib/collections — the /collections pages are server
// components and use the lib directly; this route remains for external/legacy
// consumers. Collection data itself lives in src/lib/collections-data.ts.

export async function GET(request: NextRequest) {
  try {
    const collectionId = request.nextUrl.searchParams.get("id")

    if (!collectionId) {
      const collections = await getCollectionSummaries()
      const response = NextResponse.json({ collections })
      response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200")
      return response
    }

    const data = await getCollectionWithItems(collectionId)
    if (!data) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    const { collection, items } = data
    return NextResponse.json({
      collection: {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        intro: collection.intro,
        emoji: collection.emoji,
        limit: collection.limit,
        category: collection.category,
        lastUpdated: collection.lastUpdated,
      },
      items,
      total: items.length,
    })
  } catch (error) {
    console.error("Collections API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch collections", details: String(error) },
      { status: 500 }
    )
  }
}
