import { NextRequest, NextResponse } from "next/server"
import { searchPerson, getImageUrl, ImageSize } from "@/lib/tmdb"
import { sanitizeSearchQuery } from "@/lib/security"

// GET /api/movies/person?q=Miyazaki - Search for directors/actors
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawQuery = searchParams.get("q")

  if (!rawQuery) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    )
  }

  const query = sanitizeSearchQuery(rawQuery)

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    )
  }

  try {
    const results = await searchPerson(query)

    // Transform and filter to show mainly directors/filmmakers
    const people = results.results
      .filter(person =>
        person.known_for_department === "Directing" ||
        person.known_for_department === "Writing" ||
        person.known_for_department === "Acting"
      )
      .slice(0, 10)
      .map((person) => ({
        id: person.id.toString(),
        name: person.name,
        department: person.known_for_department,
        profileUrl: getImageUrl(person.profile_path, ImageSize.poster.small),
        knownFor: person.known_for?.slice(0, 3).map(m => m.title).join(", ") || "",
      }))

    return NextResponse.json({ people })
  } catch (error) {
    console.error("TMDB person search error:", error)
    return NextResponse.json(
      { error: "Failed to search people" },
      { status: 500 }
    )
  }
}
