import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Thematic collections API
// Returns curated lists of media based on themes, seasons, or criteria

interface Collection {
  id: string
  title: string
  description: string
  query: {
    type?: "MOVIE" | "TV" | "GAME"
    topics?: string[]
    genres?: string[]
    maxAge?: number
    minRating?: number
    year?: number
  }
}

const COLLECTIONS: Collection[] = [
  // Year-based (reliable — all movies have release dates)
  {
    id: "best-movies-2024",
    title: "Meilleurs films 2024",
    description: "Les films les mieux notes sortis en 2024",
    query: { type: "MOVIE", year: 2024 },
  },
  {
    id: "best-movies-2025",
    title: "Meilleurs films 2025",
    description: "Les films les mieux notes sortis en 2025",
    query: { type: "MOVIE", year: 2025 },
  },
  // Genre-based (reliable — all movies have genres from TMDB fr-FR)
  {
    id: "family-movies",
    title: "Films en famille",
    description: "Les meilleurs films a voir en famille, pour tous les ages",
    query: { type: "MOVIE", maxAge: 10, genres: ["Familial"] },
  },
  {
    id: "teen-comedy",
    title: "Comedies pour ados",
    description: "Les meilleures comedies pour les adolescents",
    query: { type: "MOVIE", maxAge: 16, genres: ["Comédie"] },
  },
  {
    id: "animation-kids",
    title: "Animation pour enfants",
    description: "Les meilleurs dessins animes pour les plus jeunes",
    query: { type: "MOVIE", maxAge: 7, genres: ["Animation"] },
  },
  {
    id: "adventure",
    title: "Films d'aventure",
    description: "Action et exploration pour toute la famille",
    query: { type: "MOVIE", genres: ["Aventure"] },
  },
  {
    id: "fantasy",
    title: "Films fantastiques",
    description: "Magie et mondes imaginaires",
    query: { type: "MOVIE", genres: ["Fantastique"] },
  },
  // Studio-based (topics from AI enrichment — exact casing matters)
  {
    id: "disney-classics",
    title: "Classiques Disney",
    description: "Les grands classiques Disney pour petits et grands",
    query: { type: "MOVIE", topics: ["Disney"] },
  },
  {
    id: "pixar",
    title: "Films Pixar",
    description: "Tous les chefs-d'oeuvre du studio Pixar",
    query: { type: "MOVIE", topics: ["Pixar"] },
  },
  {
    id: "studio-ghibli",
    title: "Studio Ghibli",
    description: "L'univers poetique du studio japonais",
    query: { type: "MOVIE", topics: ["Studio Ghibli"] },
  },
  // Theme-based (topics from enrichment)
  {
    id: "superhero",
    title: "Super-heros",
    description: "Marvel, DC et autres aventures heroiques",
    query: { type: "MOVIE", topics: ["Super-héros"] },
  },
  {
    id: "educational",
    title: "Films educatifs",
    description: "Apprendre en s'amusant",
    query: { type: "MOVIE", topics: ["Éducatif"] },
  },
  // Seasonal (topics from enrichment)
  {
    id: "christmas-movies",
    title: "Films de Noel",
    description: "Les classiques et nouveautes pour les fetes",
    query: { type: "MOVIE", topics: ["Noël"] },
  },
  {
    id: "halloween-movies",
    title: "Films d'Halloween",
    description: "Frissons et citrouilles pour toute la famille",
    query: { type: "MOVIE", topics: ["Halloween"] },
  },
  // Games (maxAge-based — reliable)
  {
    id: "family-games",
    title: "Jeux en famille",
    description: "Les meilleurs jeux video pour jouer ensemble",
    query: { type: "GAME", maxAge: 10 },
  },
  {
    id: "teen-games",
    title: "Jeux pour ados",
    description: "Selection de jeux adaptes aux adolescents",
    query: { type: "GAME", maxAge: 16 },
  },
  // TV (maxAge-based — reliable)
  {
    id: "kids-series",
    title: "Series pour enfants",
    description: "Les meilleures series TV pour les petits",
    query: { type: "TV", maxAge: 10 },
  },
]

export async function GET(request: NextRequest) {
  try {
  const searchParams = request.nextUrl.searchParams
  const collectionId = searchParams.get("id")
  const limit = parseInt(searchParams.get("limit") || "20")

  // If no collection ID, return list of all collections with counts + preview posters
  if (!collectionId) {
    const weekNumber = Math.floor(Date.now() / 604800000)

    // Single DB query — fetch minimal fields for all items, then filter in JS.
    // This avoids 34+ separate queries that exhaust the connection pool (limit=1).
    const allItems = await prisma.mediaItem.findMany({
      select: {
        type: true,
        genres: true,
        topics: true,
        expertAgeRec: true,
        releaseDate: true,
        posterUrl: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const collectionsWithCounts = COLLECTIONS.map((collection) => {
      const matching = allItems.filter((item) => matchesQuery(item, collection.query))
      const posters = matching
        .filter((item) => item.posterUrl)
        .slice(0, 12)
        .map((item) => item.posterUrl)

      // Weekly rotation
      const offset = (weekNumber * 4) % Math.max(posters.length, 1)
      const rotated = [...posters.slice(offset), ...posters.slice(0, offset)]

      return {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        count: matching.length,
        previewPosters: rotated.slice(0, 4),
      }
    }).filter((c) => c.count > 0)

    const response = NextResponse.json({
      collections: collectionsWithCounts,
    })
    // Cache for 1 hour — collections rarely change
    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200")
    return response
  }

  // Find the collection
  const collection = COLLECTIONS.find((c) => c.id === collectionId)
  if (!collection) {
    return NextResponse.json(
      { error: "Collection not found" },
      { status: 404 }
    )
  }

  // Build the query
  const items = await getCollectionItems(collection.query, limit)

  return NextResponse.json({
    collection: {
      id: collection.id,
      title: collection.title,
      description: collection.description,
    },
    items,
    total: await getCollectionCount(collection.query),
  })
  } catch (error) {
    console.error("Collections API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch collections", details: String(error) },
      { status: 500 }
    )
  }
}

async function getCollectionCount(query: Collection["query"]): Promise<number> {
  return prisma.mediaItem.count({
    where: buildWhereClause(query),
  })
}

async function getCollectionItems(query: Collection["query"], limit: number) {
  const items = await prisma.mediaItem.findMany({
    where: buildWhereClause(query),
    include: { contentMetrics: true },
    orderBy: [
      { expertAgeRec: "asc" },
      { createdAt: "desc" },
    ],
    take: limit,
  })

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    type: item.type,
    posterUrl: item.posterUrl,
    releaseDate: item.releaseDate?.toISOString().split("T")[0],
    expertAgeRec: item.expertAgeRec,
    genres: item.genres,
    synopsisFr: item.synopsisFr,
    contentMetrics: item.contentMetrics ? {
      violence: item.contentMetrics.violence,
      positiveMessages: item.contentMetrics.positiveMessages,
    } : null,
  }))
}

function buildWhereClause(query: Collection["query"]) {
  const where: Record<string, unknown> = {}

  if (query.type) {
    where.type = query.type
  }

  if (query.maxAge) {
    where.OR = [
      { expertAgeRec: { lte: query.maxAge } },
      { expertAgeRec: null },
    ]
  }

  if (query.year) {
    where.releaseDate = {
      gte: new Date(`${query.year}-01-01`),
      lt: new Date(`${query.year + 1}-01-01`),
    }
  }

  if (query.topics && query.topics.length > 0) {
    where.topics = { hasSome: query.topics }
  }

  if (query.genres && query.genres.length > 0) {
    where.genres = { hasSome: query.genres }
  }

  return where
}

// JS-side filter matching the same logic as buildWhereClause (used for single-query approach)
function matchesQuery(
  item: { type: string; genres: string[]; topics: string[]; expertAgeRec: number | null; releaseDate: Date | null },
  query: Collection["query"]
): boolean {
  if (query.type && item.type !== query.type) return false

  if (query.maxAge != null) {
    if (item.expertAgeRec !== null && item.expertAgeRec > query.maxAge) return false
  }

  if (query.year) {
    if (!item.releaseDate) return false
    const year = item.releaseDate.getFullYear()
    if (year !== query.year) return false
  }

  if (query.topics && query.topics.length > 0) {
    if (!query.topics.some((t) => item.topics.includes(t))) return false
  }

  if (query.genres && query.genres.length > 0) {
    if (!query.genres.some((g) => item.genres.includes(g))) return false
  }

  return true
}
