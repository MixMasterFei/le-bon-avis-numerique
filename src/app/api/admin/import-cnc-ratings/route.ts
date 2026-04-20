/* eslint-disable @typescript-eslint/no-explicit-any */
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

// Convert to CNC-style sentence case: "Les Cousins" → "Les cousins"
// CNC stores titles with only first letter capitalized (French convention)
function toSentenceCase(title: string): string {
  if (!title || title.length < 2) return title
  // Lowercase everything after the first character, preserving first char
  return title.charAt(0) + title.slice(1).replace(/\b[A-ZÀ-Ü]/g, (match, offset) => {
    // Keep first word uppercase, lowercase the rest
    // But keep acronyms and roman numerals (II, III, IV, etc.)
    if (offset === 0) return match // First char already handled
    return match.toLowerCase()
  })
}

const CNC_FETCH_TIMEOUT_MS = 8000
const CNC_INTER_REQUEST_DELAY_MS = 200

// Try fetching from CNC API with a specific query.
// Wraps the underlying fetch with: 8s timeout, one retry on 429/5xx, and
// a small inter-request delay in the caller so we don't blow past
// tabular-api.data.gouv.fr's rate limits.
async function fetchCNC(param: string, value: string, pageSize = 10): Promise<CNCRecord[]> {
  const url = `${CNC_API_BASE}?page=1&page_size=${pageSize}&${param}=${encodeURIComponent(value)}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(CNC_FETCH_TIMEOUT_MS) })
      if (res.ok) {
        const json = await res.json()
        await sleep(CNC_INTER_REQUEST_DELAY_MS)
        return parseCNCRows(json.data || [])
      }
      // Retry once on rate-limit or server error; fall through on other codes.
      if ((res.status === 429 || res.status >= 500) && attempt === 0) {
        await sleep(1000)
        continue
      }
      return []
    } catch {
      if (attempt === 0) {
        await sleep(1000)
        continue
      }
      return []
    }
  }
  return []
}

// Query CNC API for a specific movie title — tries multiple case variants
// since CNC uses sentence case ("Les cousins") while TMDB uses title case ("Les Cousins")
async function searchCNC(title: string): Promise<CNCRecord[]> {
  // 1. Try exact match as-is (works for titles that already match CNC casing)
  let records = await fetchCNC("Titre__exact", title, 20)
  if (records.length > 0) return records

  // 2. Try sentence case version (most common CNC format)
  const sentenceCase = toSentenceCase(title)
  if (sentenceCase !== title) {
    records = await fetchCNC("Titre__exact", sentenceCase, 20)
    if (records.length > 0) return records
  }

  // 3. Try all lowercase (some CNC entries are lowercase)
  const lowerCase = title.toLowerCase()
  if (lowerCase !== title && lowerCase !== sentenceCase) {
    records = await fetchCNC("Titre__exact", lowerCase, 20)
    if (records.length > 0) return records
  }

  // 4. Fallback: contains search with original title (handles partial matches)
  records = await fetchCNC("Titre__contains", title, 10)
  if (records.length > 0) return records

  // 5. Last resort: contains with sentence case
  if (sentenceCase !== title) {
    records = await fetchCNC("Titre__contains", sentenceCase, 10)
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
    // 15 items × up to 5 fetches/item = up to 75 HTTP calls per run, well
    // under data.gouv.fr's rate ceiling after the 200ms inter-request
    // delay added in fetchCNC. Safer than the old 30-item default which
    // pushed us into 429 territory.
    const limit = parseInt(url.searchParams.get("limit") || "15")
    const offset = parseInt(url.searchParams.get("offset") || "0")

    // Get DB movies to match
    // CNC only has films with French visa classification — skip very recent films
    // and prioritize French/European content that's most likely to have a CNC entry
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - 6) // Only films released 6+ months ago

    const whereClause: any = {
      type: "MOVIE",
      // Skip films without a release date or released very recently (CNC lag)
      releaseDate: { lt: cutoffDate },
      // Skip non-latin script titles (Chinese, Japanese, Korean, Arabic, etc.)
      // These are almost never in the CNC database
      originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt", "nl", "da", "sv", "no", "fi", "pl", "cs", "ro", "hu", "el", "tr", "ru"] },
    }
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
        originalLanguage: true,
      },
      skip: offset,
      take: limit,
      // Process French films first (most likely to match), then by quality score
      orderBy: [
        { dataQualityScore: "desc" },
        { releaseDate: "asc" },
      ],
    })

    let matched = 0
    let updated = 0
    let skipped = 0
    let noMatch = 0
    let errors = 0
    const changes: string[] = []

    const debugSamples: string[] = [] // First 10 search attempts for debugging

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

        // Debug: log first 10 search attempts
        if (debugSamples.length < 10) {
          debugSamples.push(
            `"${movie.title}" (${movieYear}) → ${candidates.length} CNC results` +
            (candidates.length > 0 ? ` [first: "${candidates[0].title}" ${candidates[0].decision}]` : "")
          )
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
      } catch {
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
      debugSamples,
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
