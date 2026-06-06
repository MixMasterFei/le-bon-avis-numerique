import { NextRequest, NextResponse } from "next/server"
import { fetchSeries, type MediaQueryFilters } from "@/lib/media-queries"

const parseIntOrUndef = (v: string | null): number | undefined =>
  v === null || v === "" ? undefined : parseInt(v)

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams

  const filters: MediaQueryFilters = {
    page: parseInt(sp.get("page") || "1"),
    limit: parseInt(sp.get("limit") || "20"),
    minAge: parseIntOrUndef(sp.get("minAge")),
    maxAge: parseIntOrUndef(sp.get("maxAge")),
    maxViolence: parseIntOrUndef(sp.get("maxViolence")),
    maxSexual: parseIntOrUndef(sp.get("maxSexual")),
    maxLanguage: parseIntOrUndef(sp.get("maxLanguage")),
    maxSubstance: parseIntOrUndef(sp.get("maxSubstance")),
    maxConsumerism: parseIntOrUndef(sp.get("maxConsumerism")),
    genres: sp.get("genre") ? [sp.get("genre")!] : sp.get("genres")?.split(",").map(g => g.trim()) || undefined,
    topics: sp.get("topics")?.split(",").map(t => t.trim()) || undefined,
    platforms: sp.get("platforms")?.split(",").map(p => p.trim()) || undefined,
    search: sp.get("q") || undefined,
    sortBy: sp.get("sortBy") || "releaseDate",
    requirePoster: sp.get("requirePoster") === "true",
    minQuality: sp.get("minQuality") ? parseInt(sp.get("minQuality")!) : undefined,
    featured: sp.get("featured") === "true",
    language: sp.get("language") || undefined,
    frenchOnly: sp.get("frenchOnly") === "true",
    includeProvisional: sp.get("includeProvisional") === "1",
  }

  try {
    const result = await fetchSeries(filters)
    return NextResponse.json({
      series: result.items,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error("Series API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch series from database" },
      { status: 500 }
    )
  }
}
