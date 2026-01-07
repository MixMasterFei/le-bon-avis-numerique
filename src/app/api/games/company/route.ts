import { NextRequest, NextResponse } from "next/server"
import { searchCompanies, getCompanyLogoUrl } from "@/lib/igdb"
import { sanitizeSearchQuery } from "@/lib/security"

// GET /api/games/company?q=FromSoftware - Search for game studios/companies
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
    const results = await searchCompanies(query)

    const companies = results.map((company) => ({
      id: company.id.toString(),
      name: company.name,
      logoUrl: getCompanyLogoUrl(company.logo?.image_id, "small"),
      description: company.description?.slice(0, 100) || "",
    }))

    return NextResponse.json({ companies })
  } catch (error) {
    console.error("IGDB company search error:", error)
    return NextResponse.json(
      { error: "Failed to search companies" },
      { status: 500 }
    )
  }
}
