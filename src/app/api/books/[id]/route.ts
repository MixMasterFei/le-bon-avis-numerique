import { NextRequest, NextResponse } from "next/server"
import { getBookDetails, transformBook } from "@/lib/google-books"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const book = await getBookDetails(id)
    return NextResponse.json(transformBook(book))
  } catch (error) {
    console.error("Google Books details error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch book" },
      { status: 500 }
    )
  }
}




