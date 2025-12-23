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
  {
    id: "family-movies",
    title: "Films en famille",
    description: "Les meilleurs films a voir en famille, pour tous les ages",
    query: { type: "MOVIE", maxAge: 10, topics: ["famille"] },
  },
  {
    id: "teen-comedy",
    title: "Comedies pour ados",
    description: "Les meilleures comedies pour les adolescents",
    query: { type: "MOVIE", maxAge: 16, genres: ["Comedie"], topics: ["comedie-ado"] },
  },
  {
    id: "christmas-movies",
    title: "Films de Noel",
    description: "Les classiques et nouveautes pour les fetes",
    query: { type: "MOVIE", topics: ["noel"] },
  },
  {
    id: "halloween-movies",
    title: "Films d'Halloween",
    description: "Frissons et citrouilles pour toute la famille",
    query: { type: "MOVIE", topics: ["halloween"] },
  },
  {
    id: "summer-movies",
    title: "Films d'ete",
    description: "Les blockbusters et films de vacances",
    query: { type: "MOVIE", topics: ["ete"] },
  },
  {
    id: "disney-classics",
    title: "Classiques Disney",
    description: "Les grands classiques Disney pour petits et grands",
    query: { type: "MOVIE", topics: ["disney", "classique"] },
  },
  {
    id: "pixar",
    title: "Films Pixar",
    description: "Tous les chefs-d'oeuvre du studio Pixar",
    query: { type: "MOVIE", topics: ["pixar"] },
  },
  {
    id: "studio-ghibli",
    title: "Studio Ghibli",
    description: "L'univers poetique du studio japonais",
    query: { type: "MOVIE", topics: ["studio-ghibli"] },
  },
  {
    id: "superhero",
    title: "Super-heros",
    description: "Marvel, DC et autres aventures heroiques",
    query: { type: "MOVIE", topics: ["super-heros"] },
  },
  {
    id: "educational",
    title: "Films educatifs",
    description: "Apprendre en s'amusant",
    query: { type: "MOVIE", topics: ["educatif"] },
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
    query: { type: "MOVIE", topics: ["aventure"], genres: ["Aventure"] },
  },
  {
    id: "fantasy",
    title: "Films fantastiques",
    description: "Magie et mondes imaginaires",
    query: { type: "MOVIE", topics: ["fantastique"], genres: ["Fantastique", "Fantasy"] },
  },
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

  // If no collection ID, return list of all collections with counts
  if (!collectionId) {
    const collectionsWithCounts = await Promise.all(
      COLLECTIONS.map(async (collection) => {
        const count = await getCollectionCount(collection.query)
        return {
          ...collection,
          count,
          query: undefined, // Don't expose query details
        }
      })
    )

    return NextResponse.json({
      collections: collectionsWithCounts.filter((c) => c.count > 0),
    })
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

  // Only show items that have been enriched (have content metrics)
  where.contentMetrics = { isNot: null }

  return where
}
