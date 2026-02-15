import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 300 // 5 minutes (Vercel Pro limit)

// CNC tabular API for official French film visa data (95K+ records)
const CNC_API_BASE =
  "https://tabular-api.data.gouv.fr/api/resources/1c5075ec-7ce1-49cb-ab89-94f507812daf/data/"

// Map CNC "Décision" values to our internal rating format
function mapCNCDecision(decision: string | null): string | null {
  if (!decision) return null

  const d = decision.trim().toLowerCase()

  if (d === "tout public" || d === "tous publics") return "TOUS_PUBLICS"
  if (d === "avertissement") return "TOUS_PUBLICS" // Warning but still all-audiences

  // -12 and old -13 system both map to CSA_12
  if (d.includes("-12") || d.includes("-13")) return "CSA_12"
  if (d.includes("-16")) return "CSA_16"
  if (d.includes("-18") || d === "interdit mineurs" || d === "censure") return "CSA_18"

  // Combined values like "Censure - Interdit -18 ans"
  if (d.includes("censure") || d.includes("interdit mineurs")) return "CSA_18"

  return null
}

interface CNCRecord {
  title: string
  director: string | null
  year: number | null
  decision: string | null
  internalRating: string | null
  visaNumber: string | null
}

// Query CNC API for a specific movie title
async function searchCNC(title: string): Promise<CNCRecord[]> {
  const url = `${CNC_API_BASE}?page=1&page_size=20&Titre__exact=${encodeURIComponent(title)}`
  const res = await fetch(url)

  if (!res.ok) {
    // Try contains if exact fails (handles slight title variations)
    const fallbackUrl = `${CNC_API_BASE}?page=1&page_size=10&Titre__contains=${encodeURIComponent(title)}`
    const fallbackRes = await fetch(fallbackUrl)
    if (!fallbackRes.ok) return []
    const fallbackJson = await fallbackRes.json()
    return parseCNCRows(fallbackJson.data || [])
  }

  const json = await res.json()
  const records = parseCNCRows(json.data || [])

  // If exact match found nothing, try contains
  if (records.length === 0) {
    const fallbackUrl = `${CNC_API_BASE}?page=1&page_size=10&Titre__contains=${encodeURIComponent(title)}`
    const fallbackRes = await fetch(fallbackUrl)
    if (fallbackRes.ok) {
      const fallbackJson = await fallbackRes.json()
      return parseCNCRows(fallbackJson.data || [])
    }
  }

  return records
}

function parseCNCRows(rows: any[]): CNCRecord[] {
  return rows.map((row: any) => {
    let year: number | null = null
    const dateStr = row["Date"]
    if (dateStr) {
      const yearMatch = String(dateStr).match(/(\d{4})/)
      if (yearMatch) year = parseInt(yearMatch[1])
    }

    return {
      title: row["Titre"] || "",
      director: row["Réalisation"] || null,
      year,
      decision: row["Décision"] || null,
      internalRating: mapCNCDecision(row["Décision"]),
      visaNumber: row["N° de visa"] || null,
    }
  })
}

// Find best CNC match for a given year
function findBestMatch(
  candidates: CNCRecord[],
  year: number | null
): CNCRecord | null {
  if (candidates.length === 0) return null

  // Filter to only those with a rating
  const withRating = candidates.filter((c) => c.internalRating)
  if (withRating.length === 0) return candidates[0] // still return for stats

  // If only one match with rating, use it
  if (withRating.length === 1) return withRating[0]

  // Multiple matches — try to narrow by year (±1 year tolerance)
  if (year) {
    const yearMatch = withRating.find(
      (c) => c.year && Math.abs(c.year - year) <= 1
    )
    if (yearMatch) return yearMatch
  }

  // Fallback: return the most recent one
  const sorted = [...withRating].sort((a, b) => (b.year || 0) - (a.year || 0))
  return sorted[0]
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET() {
  const noRating = await prisma.mediaItem.count({
    where: { type: "MOVIE", officialRating: null },
  })

  const withRating = await prisma.mediaItem.count({
    where: { type: "MOVIE", officialRating: { not: null } },
  })

  return NextResponse.json({
    moviesWithoutRating: noRating,
    moviesWithRating: withRating,
    message: `${noRating} movies without official rating. POST to import from CNC database.`,
    cncApiUrl: CNC_API_BASE,
  })
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const dryRun = url.searchParams.get("dry") === "true"
    const onlyMissing = url.searchParams.get("only_missing") !== "false"
    const limit = parseInt(url.searchParams.get("limit") || "30") // small batches for Vercel 60s limit
    const offset = parseInt(url.searchParams.get("offset") || "0")

    // Get DB movies to match
    const whereClause: any = { type: "MOVIE" }
    if (onlyMissing) {
      whereClause.officialRating = null
    }

    const totalRemaining = await prisma.mediaItem.count({ where: whereClause })

    const movies = await prisma.mediaItem.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        originalTitle: true,
        releaseDate: true,
        officialRating: true,
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "asc" },
    })

    let matched = 0
    let updated = 0
    let skipped = 0
    let noMatch = 0
    let errors = 0
    const changes: string[] = []

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i]
      const movieYear = movie.releaseDate
        ? movie.releaseDate.getFullYear()
        : null

      try {
        // Search CNC by title (try original French title first, then international)
        let candidates = await searchCNC(movie.title)

        // If no results with main title and we have an original title, try that
        if (candidates.length === 0 && movie.originalTitle && movie.originalTitle !== movie.title) {
          candidates = await searchCNC(movie.originalTitle)
        }

        const cncMatch = findBestMatch(candidates, movieYear)

        if (!cncMatch || !cncMatch.internalRating) {
          noMatch++
          continue
        }

        matched++

        // Skip if movie already has this exact rating
        if (movie.officialRating === cncMatch.internalRating) {
          skipped++
          continue
        }

        if (!dryRun) {
          await prisma.mediaItem.update({
            where: { id: movie.id },
            data: { officialRating: cncMatch.internalRating },
          })
        }

        updated++
        const prev = movie.officialRating || "null"
        changes.push(
          `${movie.title} (${movieYear || "?"}): ${prev} → ${cncMatch.internalRating} [visa ${cncMatch.visaNumber}]`
        )
      } catch (err) {
        errors++
      }

      // Rate limit: ~2 requests per movie (exact + contains), keep it gentle
      if ((i + 1) % 10 === 0) {
        await sleep(500)
      }
    }

    const done = movies.length < limit
    const nextOffset = done ? null : offset + limit

    return NextResponse.json({
      success: true,
      dryRun,
      onlyMissing,
      processed: movies.length,
      totalRemaining,
      matched,
      updated,
      skipped,
      noMatch,
      errors,
      done,
      nextOffset,
      changes: changes.slice(0, 50),
    })
  } catch (error) {
    console.error("[CNC Import] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 }
    )
  }
}
