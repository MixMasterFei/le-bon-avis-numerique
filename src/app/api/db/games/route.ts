import { NextRequest, NextResponse } from "next/server"
import { fetchGames, type MediaQueryFilters } from "@/lib/media-queries"

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
    platforms: sp.get("platform") ? [sp.get("platform")!] : sp.get("platforms")?.split(",").map(p => p.trim()) || undefined,
    search: sp.get("q") || undefined,
    sortBy: sp.get("sortBy") || "popularity",
    requirePoster: sp.get("requirePoster") === "true",
    minQuality: sp.get("minQuality") ? parseInt(sp.get("minQuality")!) : undefined,
    featured: sp.get("featured") === "true",
    includeAll: sp.get("includeAll") === "true",
    consoleOnly: sp.get("consoleOnly") !== "false",
  }

  try {
    const result = await fetchGames(filters)
    return NextResponse.json({
      games: result.items,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error("Games API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch games from database" },
      { status: 500 }
    )
  }
}
