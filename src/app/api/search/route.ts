import { NextRequest, NextResponse } from "next/server"
import { sanitizeSearchQuery, getClientIdentifier, checkRateLimit, RATE_LIMITS, rateLimitHeaders } from "@/lib/security"

type MediaType = "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"

interface AggregatedItem {
  id: string
  title: string
  originalTitle?: string
  synopsisFr: string | null
  posterUrl: string
  releaseDate: string | null
  rating: number | null
  type: MediaType
  source: "TMDB" | "IGDB" | "GOOGLE_BOOKS"
}

function normalizeItems(key: "movies" | "shows" | "games" | "books", data: any): AggregatedItem[] {
  const list = Array.isArray(data?.[key]) ? data[key] : []
  return list.map((item: any) => ({
    id: String(item.id),
    title: String(item.title || ""),
    originalTitle: item.originalTitle ? String(item.originalTitle) : undefined,
    synopsisFr: item.synopsisFr ?? null,
    posterUrl: String(item.posterUrl || ""),
    releaseDate: item.releaseDate ?? null,
    rating: item.rating ?? null,
    type: (item.type as MediaType) || "MOVIE",
    source: key === "movies" || key === "shows" ? "TMDB" : key === "games" ? "IGDB" : "GOOGLE_BOOKS",
  }))
}

export async function GET(request: NextRequest) {
  const clientId = getClientIdentifier(request)
  const rl = checkRateLimit(`search:${clientId}`, RATE_LIMITS.search)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many search requests. Please try again shortly." },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
    )
  }

  const sp = request.nextUrl.searchParams
  const rawQuery = sp.get("q")
  const rawTypes = sp.get("types") // comma-separated: movie,tv,game,book

  if (!rawQuery) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400, headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
    )
  }

  const query = sanitizeSearchQuery(rawQuery)
  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400, headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
    )
  }

  const requested = new Set(
    (rawTypes ? rawTypes.split(",") : ["movie", "tv", "game", "book"])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  )

  const calls: Array<Promise<Response>> = []
  const keys: Array<"movies" | "shows" | "games" | "books"> = []

  if (requested.has("movie")) {
    keys.push("movies")
    calls.push(fetch(`${request.nextUrl.origin}/api/movies/search?q=${encodeURIComponent(query)}`))
  }
  if (requested.has("tv")) {
    keys.push("shows")
    calls.push(fetch(`${request.nextUrl.origin}/api/tv/search?q=${encodeURIComponent(query)}`))
  }
  if (requested.has("game")) {
    keys.push("games")
    calls.push(fetch(`${request.nextUrl.origin}/api/games/search?q=${encodeURIComponent(query)}`))
  }
  if (requested.has("book")) {
    keys.push("books")
    calls.push(fetch(`${request.nextUrl.origin}/api/books/search?q=${encodeURIComponent(query)}`))
  }

  const settled = await Promise.allSettled(calls)

  const items: AggregatedItem[] = []
  const errors: Record<string, string> = {}

  for (let i = 0; i < settled.length; i++) {
    const key = keys[i]
    const res = settled[i]
    if (res.status !== "fulfilled") {
      errors[key] = "Request failed"
      continue
    }

    if (!res.value.ok) {
      try {
        const data = await res.value.json()
        errors[key] = data?.error || `HTTP ${res.value.status}`
      } catch {
        errors[key] = `HTTP ${res.value.status}`
      }
      continue
    }

    try {
      const data = await res.value.json()
      items.push(...normalizeItems(key, data))
    } catch {
      errors[key] = "Invalid response"
    }
  }

  // Deduplicate by (type,id)
  const seen = new Set<string>()
  const unique = items.filter((it) => {
    const k = `${it.type}:${it.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return NextResponse.json(
    {
      query,
      results: unique,
      errors,
      totalResults: unique.length,
    },
    { headers: rateLimitHeaders(rl.remaining, rl.resetIn) }
  )
}


