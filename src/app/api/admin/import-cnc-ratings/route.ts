import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// CNC tabular API for official French film visa data (95K+ records)
const CNC_API_BASE =
  "https://tabular-api.data.gouv.fr/api/resources/1c5075ec-7ce1-49cb-ab89-94f507812daf/data/"
const PAGE_SIZE = 10000

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

// Normalize title for matching: lowercase, remove accents, trim articles, collapse whitespace
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/^(le |la |les |l'|un |une |des |the |a |an )/i, "") // trim articles
    .replace(/[^\w\s]/g, "") // remove punctuation
    .replace(/\s+/g, " ")
    .trim()
}

interface CNCRecord {
  title: string
  normalizedTitle: string
  director: string | null
  year: number | null
  decision: string | null
  internalRating: string | null
  visaNumber: string | null
}

// Fetch all CNC records from the tabular API
async function fetchCNCData(): Promise<CNCRecord[]> {
  const records: CNCRecord[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `${CNC_API_BASE}?page=${page}&page_size=${PAGE_SIZE}`
    const res = await fetch(url)

    if (!res.ok) {
      throw new Error(`CNC API error: ${res.status} ${res.statusText}`)
    }

    const json = await res.json()
    const data = json.data || []

    for (const row of data) {
      const title = row["Titre"]
      if (!title) continue

      // Parse year from "Date" field (format varies: "1988", "01/05/2020", etc.)
      let year: number | null = null
      const dateStr = row["Date"]
      if (dateStr) {
        const yearMatch = dateStr.match(/(\d{4})/)
        if (yearMatch) year = parseInt(yearMatch[1])
      }

      records.push({
        title,
        normalizedTitle: normalizeTitle(title),
        director: row["Réalisation"] || null,
        year,
        decision: row["Décision"] || null,
        internalRating: mapCNCDecision(row["Décision"]),
        visaNumber: row["N° de visa"] || null,
      })
    }

    hasMore = data.length === PAGE_SIZE
    page++
  }

  return records
}

// Build a lookup map from normalized title to CNC records
function buildTitleIndex(records: CNCRecord[]): Map<string, CNCRecord[]> {
  const index = new Map<string, CNCRecord[]>()

  for (const record of records) {
    const existing = index.get(record.normalizedTitle)
    if (existing) {
      existing.push(record)
    } else {
      index.set(record.normalizedTitle, [record])
    }
  }

  return index
}

// Find best CNC match for a DB movie
function findMatch(
  normalizedTitle: string,
  year: number | null,
  index: Map<string, CNCRecord[]>
): CNCRecord | null {
  const candidates = index.get(normalizedTitle)
  if (!candidates || candidates.length === 0) return null

  // If only one match, use it (regardless of year)
  if (candidates.length === 1) return candidates[0]

  // Multiple matches — try to narrow by year (±1 year tolerance)
  if (year) {
    const yearMatch = candidates.find(
      (c) => c.year && Math.abs(c.year - year) <= 1
    )
    if (yearMatch) return yearMatch
  }

  // Fallback: return the most recent one (likely the right version)
  const sorted = [...candidates].sort((a, b) => (b.year || 0) - (a.year || 0))
  return sorted[0]
}

export async function GET() {
  // Show current state: how many movies have no official rating
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
    const onlyMissing = url.searchParams.get("only_missing") !== "false" // default: only update null ratings

    // Step 1: Fetch CNC data
    console.log("[CNC Import] Fetching CNC database...")
    const cncRecords = await fetchCNCData()
    console.log(`[CNC Import] Loaded ${cncRecords.length} CNC records`)

    // Step 2: Build title index
    const titleIndex = buildTitleIndex(cncRecords)
    console.log(`[CNC Import] Built index with ${titleIndex.size} unique titles`)

    // Step 3: Get DB movies to match
    const whereClause: any = { type: "MOVIE" }
    if (onlyMissing) {
      whereClause.officialRating = null
    }

    const movies = await prisma.mediaItem.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        releaseDate: true,
        officialRating: true,
      },
    })

    console.log(`[CNC Import] Matching against ${movies.length} DB movies...`)

    // Step 4: Match and update
    let matched = 0
    let updated = 0
    let skipped = 0
    let noMatch = 0
    const changes: string[] = []

    for (const movie of movies) {
      const normalizedMovieTitle = normalizeTitle(movie.title)
      const movieYear = movie.releaseDate
        ? movie.releaseDate.getFullYear()
        : null

      const cncMatch = findMatch(normalizedMovieTitle, movieYear, titleIndex)

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
        `${movie.title} (${movieYear || "?"}): ${prev} → ${cncMatch.internalRating} [CNC visa ${cncMatch.visaNumber}]`
      )
    }

    return NextResponse.json({
      success: true,
      dryRun,
      onlyMissing,
      cncRecords: cncRecords.length,
      uniqueTitles: titleIndex.size,
      dbMovies: movies.length,
      matched,
      updated,
      skipped,
      noMatch,
      changes: changes.slice(0, 200), // limit response size
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
