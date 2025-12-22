import { NextRequest, NextResponse } from "next/server"
import { getPopularChildrensBooks, transformBook } from "@/lib/google-books"

export async function GET(request: NextRequest) {
  try {
    const results = await getPopularChildrensBooks()
    const books = (results.items || []).map(transformBook)

    return NextResponse.json({
      books,
      totalResults: results.totalItems,
    })
  } catch (error) {
    console.error("Google Books children error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch books" },
      { status: 500 }
    )
  }
}

