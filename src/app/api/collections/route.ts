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
  const searchParams = request.nextUrl.searchParams
  const collectionId = searchParams.get("id")
  const limit = parseInt(searchParams.get("limit") || "20")

  // If no collection ID, return list of all collections with counts + preview posters
  if (!collectionId) {
    const weekNumber = Math.floor(Date.now() / 604800000)

    // Run all queries in parallel — one findMany per collection (gets posters + count)
    const collectionsData = await Promise.all(
      COLLECTIONS.map(async (collection) => {
        const where = buildWhereClause(collection.query)
        // Single query: fetch 12 items with posters (enough for rotation)
        // Plus a count query — both run in parallel per collection
        const [posterPool, count] = await Promise.all([
          prisma.mediaItem.findMany({
            where: { ...where, posterUrl: { not: null } },
            select: { posterUrl: true },
            take: 12,
            orderBy: { createdAt: "desc" },
          }),
          prisma.mediaItem.count({ where }),
        ])

        // Weekly rotation: offset changes every ~7 days
        const offset = (weekNumber * 4) % Math.max(posterPool.length, 1)
        const rotated = [...posterPool.slice(offset), ...posterPool.slice(0, offset)]
        const previewPosters = rotated.slice(0, 4).map((p) => p.posterUrl)

        return {
          id: collection.id,
          title: collection.title,
          description: collection.description,
          count,
          previewPosters,
        }
      })
    )

    const collectionsWithCounts = collectionsData

    const response = NextResponse.json({
      collections: collectionsWithCounts.filter((c) => c.count > 0),
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
