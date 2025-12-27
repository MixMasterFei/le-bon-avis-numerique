import { NextRequest, NextResponse } from "next/server"
import { searchBooks, transformBook } from "@/lib/google-books"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")
  const startIndex = parseInt(searchParams.get("start") || "0")

  if (!query) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    )
  }

  try {
    const results = await searchBooks(query, { startIndex })
    const books = (results.items || []).map(transformBook)

    return NextResponse.json({
      books,
      totalResults: results.totalItems,
    })
  } catch (error) {
    console.error("Google Books search error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to search books" },
      { status: 500 }
    )
  }
}





