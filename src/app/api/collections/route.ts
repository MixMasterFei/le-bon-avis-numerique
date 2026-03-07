import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Thematic collections API — SEO-optimized "Top X" curated lists
// Each collection is capped at 10-15 items, sorted by quality (tmdbRating)

interface Collection {
  id: string
  title: string
  description: string
  intro: string
  emoji: string
  limit: number
  category: "top" | "seasonal"
  query: {
    type?: "MOVIE" | "TV" | "GAME"
    topics?: string[]
    genres?: string[]
    maxAge?: number
    year?: number
  }
}

const COLLECTIONS: Collection[] = [
  // ── Top curated lists (permanent, high SEO value) ──────────────────
  {
    id: "top-films-animation-enfants",
    title: "Top 15 des films d'animation pour enfants",
    description: "Les meilleurs dessins animés pour les tout-petits, des classiques aux pépites récentes.",
    intro: "Certains films d'animation ont ce pouvoir de traverser les époques. Des classiques japonais aux pépites récentes, on a réuni nos 15 préférés pour les enfants, ceux qu'on regarde un mercredi pluvieux ou un dimanche matin sous la couette. Des histoires douces, drôles, parfois émouvantes, mais toujours adaptées aux plus jeunes.",
    emoji: "🎬",
    limit: 15,
    category: "top",
    query: { type: "MOVIE", genres: ["Animation"], maxAge: 10 },
  },
  {
    id: "top-films-famille",
    title: "Top 15 des meilleurs films en famille",
    description: "Les films parfaits pour une soirée ciné en famille : drôles, émouvants et adaptés à tous les âges.",
    intro: "La soirée ciné en famille, c'est sacré. Trouver LE film qui plaît à tout le monde, par contre, c'est un autre sujet. Les petits veulent du dessin animé, les grands veulent de l'action, les ados lèvent les yeux au ciel. Ces 15 films mettent tout le monde d'accord. On les a testés, et on n'a eu aucune mutinerie. Pop-corn non inclus.",
    emoji: "👨‍👩‍👧‍👦",
    limit: 15,
    category: "top",
    query: { type: "MOVIE", genres: ["Familial"], maxAge: 10 },
  },
  {
    id: "top-disney",
    title: "Top 10 des classiques Disney",
    description: "Les grands classiques Disney qui ont marqué des générations.",
    intro: "On connaît les chansons par cœur. On pleure toujours aux mêmes scènes. Et on attend le bon moment pour les montrer à nos enfants, comme si on leur confiait un secret. Les classiques de la Renaissance des années 90 et ceux qui ont renouvelé la magie depuis, le tout en 10 films.",
    emoji: "🏰",
    limit: 10,
    category: "top",
    query: { type: "MOVIE", topics: ["Disney"] },
  },
  {
    id: "top-pixar",
    title: "Top 10 des films Pixar",
    description: "Les chefs-d'œuvre du studio aux films inoubliables.",
    intro: "Depuis le milieu des années 90, ce studio n'a jamais vraiment baissé le niveau. Des films qui mettent des mots sur les émotions de nos enfants, qui parlent du deuil avec justesse, qui font pleurer tout le monde dès les dix premières minutes. Nos 10 préférés, ceux qui touchent autant les parents que les petits.",
    emoji: "🚀",
    limit: 10,
    category: "top",
    query: { type: "MOVIE", topics: ["Pixar"] },
  },
  {
    id: "top-ghibli",
    title: "Top 10 Studio Ghibli",
    description: "L'univers poétique et enchanteur du studio japonais de Hayao Miyazaki.",
    intro: "Fondé en 1985 par deux maîtres de l'animation japonaise, ce studio a produit des films qu'on ne trouve nulle part ailleurs. Des œuvres récompensées aux Oscars et à Berlin, des musiques qui restent en tête pendant des semaines. Des forêts qui respirent, des esprits bienveillants, des héroïnes courageuses. Ça ne ressemble à rien d'autre.",
    emoji: "🌿",
    limit: 10,
    category: "top",
    query: { type: "MOVIE", topics: ["Studio Ghibli"] },
  },
  {
    id: "top-films-aventure",
    title: "Top 10 des films d'aventure pour enfants",
    description: "Action, exploration et découvertes : les meilleurs films d'aventure adaptés aux enfants.",
    intro: "Un bon film d'aventure, et les enfants veulent explorer le jardin dès le générique de fin. Trésors cachés, héros qui se dépassent, territoires inconnus. Ces 10 films font briller les yeux, donnent envie de bouger, et passent le test du « on le remet ? » au moment du dîner.",
    emoji: "🗺️",
    limit: 10,
    category: "top",
    query: { type: "MOVIE", genres: ["Aventure"], maxAge: 12 },
  },
  {
    id: "top-comedies-ados",
    title: "Top 10 des comédies pour ados",
    description: "Les comédies les plus drôles et adaptées aux adolescents.",
    intro: "Faire rire un ado, c'est un art. Trop bébé, il décroche. Trop vulgaire, on n'est pas tranquille en tant que parent. Ces 10 comédies tapent juste. De l'humour qui fait vraiment rire, des personnages auxquels ils s'identifient, et zéro moment gênant quand on regarde ensemble sur le canapé.",
    emoji: "😂",
    limit: 10,
    category: "top",
    query: { type: "MOVIE", genres: ["Comédie"], maxAge: 16 },
  },
  {
    id: "top-super-heros",
    title: "Top 10 des films de super-héros",
    description: "Marvel, DC et autres aventures héroïques pour toute la famille.",
    intro: "Les super-héros, ça fait rêver les enfants. Le problème, c'est que beaucoup de films du genre sont trop sombres ou trop violents pour les plus jeunes. Ces 10-là font rêver sans donner de cauchemars. Du courage, de la solidarité, et des capes qui claquent au vent.",
    emoji: "🦸",
    limit: 10,
    category: "top",
    query: { type: "MOVIE", topics: ["Super-héros"] },
  },
  {
    id: "top-films-educatifs",
    title: "Top 10 des films éducatifs",
    description: "Apprendre en s'amusant : les films qui éveillent la curiosité des enfants.",
    intro: "Le secret d'un bon film éducatif, c'est que l'enfant ne se rend pas compte qu'il apprend. Il est juste captivé. Des documentaires qui rendent curieux, des histoires qui posent des questions, des personnages qui donnent envie de comprendre le monde. On en a retenu 10 qui font ça très bien.",
    emoji: "📚",
    limit: 10,
    category: "top",
    query: { type: "MOVIE", topics: ["Éducatif"] },
  },
  {
    id: "meilleurs-films-2025",
    title: "Meilleurs films 2025 pour les familles",
    description: "Les films sortis en 2025 les mieux notés et adaptés aux familles.",
    intro: "2025 a réservé de bonnes surprises au cinéma pour les familles. On met à jour cette liste au fil de l'année avec les films qui nous ont marqués, ceux qui font parler dans les cours de récré et ceux qu'on recommande sans hésiter.",
    emoji: "⭐",
    limit: 15,
    category: "top",
    query: { type: "MOVIE", year: 2025 },
  },

  // ── Seasonal collections ───────────────────────────────────────────
  {
    id: "films-noel-famille",
    title: "Films de Noël en famille",
    description: "Les classiques et nouveautés pour des fêtes magiques en famille.",
    intro: "Le sapin est monté, les guirlandes clignotent, le chocolat chaud est prêt. Il manque le film. Classiques ou nouveautés, tous les camps trouveront leur bonheur ici, des tout-petits aux grands-parents. De quoi tenir toutes les soirées des vacances de Noël.",
    emoji: "🎄",
    limit: 15,
    category: "seasonal",
    query: { type: "MOVIE", topics: ["Noël"] },
  },
  {
    id: "films-halloween-enfants",
    title: "Films d'Halloween pour enfants",
    description: "Frissons légers et citrouilles : des films d'Halloween adaptés aux enfants, sans cauchemars.",
    intro: "Halloween, c'est l'occasion de se faire un peu peur. Mais juste un peu. Des citrouilles, des fantômes rigolos, des sorcières pas si méchantes. Pile ce qu'il faut pour entrer dans l'ambiance sans que personne ne finisse dans le lit des parents à 3h du matin.",
    emoji: "🎃",
    limit: 10,
    category: "seasonal",
    query: { type: "MOVIE", topics: ["Halloween"], maxAge: 10 },
  },
  {
    id: "films-vacances-ete",
    title: "Films pour les vacances d'été",
    description: "Soleil, aventures et bonne humeur : la sélection parfaite pour les vacances.",
    intro: "Les grandes vacances, c'est aussi les jours de pluie, les après-midi trop chauds pour sortir et les longs trajets en voiture. Ces films sentent bon l'été, l'aventure et la liberté. Pile ce qu'il faut pour les journées où on veut rêver un peu sans bouger du canapé.",
    emoji: "☀️",
    limit: 15,
    category: "seasonal",
    query: { type: "MOVIE", topics: ["Vacances", "Été", "Plage", "Voyage"] },
  },

  // ── Gaming collections ─────────────────────────────────────────────
  {
    id: "top-jeux-famille",
    title: "Top 10 des jeux vidéo en famille",
    description: "Les meilleurs jeux pour jouer ensemble : coopération, fun et fous rires garantis.",
    intro: "Jouer ensemble, c'est quand même mieux que chacun dans son coin avec son écran. On a cherché les jeux où parents et enfants s'amusent vraiment en même temps. Des jeux coopératifs, des jeux où on rigole, des jeux où même papa qui « ne joue jamais aux jeux vidéo » finit par demander une deuxième partie.",
    emoji: "🎮",
    limit: 10,
    category: "top",
    query: { type: "GAME", maxAge: 10 },
  },
  {
    id: "top-jeux-multijoueur-local",
    title: "Top 10 des jeux multijoueur canapé",
    description: "Les meilleurs jeux à partager sur le même écran, parfaits pour les soirées en famille.",
    intro: "Tout le monde sur le canapé, les manettes qui s'échangent, et des fous rires. Du chaos en cuisine, des courses endiablées, des aventures à deux qui ont été élues jeu de l'année. Pas besoin de deux consoles ni de connexion internet. Juste un écran et l'envie de jouer ensemble.",
    emoji: "🛋️",
    limit: 10,
    category: "top",
    query: { type: "GAME", topics: ["Multijoueur local", "Coopération", "Party game"] },
  },
  {
    id: "top-jeux-ados",
    title: "Top 10 des jeux pour ados",
    description: "Sélection de jeux adaptés aux adolescents : aventure, sport et stratégie.",
    intro: "Les ados veulent des jeux qui ne font pas « bébé » mais qui restent adaptés à leur âge. Pas toujours facile de trouver le bon équilibre. Ces 10 jeux cochent les deux cases : assez costauds pour les accrocher, assez clean pour que les parents soient tranquilles.",
    emoji: "🕹️",
    limit: 10,
    category: "top",
    query: { type: "GAME", maxAge: 16 },
  },

  // ── Seasonal gaming ────────────────────────────────────────────────
  {
    id: "jeux-vacances-ete",
    title: "Jeux vidéo pour les vacances d'été 2026",
    description: "Les jeux parfaits pour occuper les enfants pendant les grandes vacances.",
    intro: "Deux mois de vacances, c'est long. Les enfants ont besoin de souffler aussi. Entre deux baignades et une partie de foot, ces jeux vidéo occupent intelligemment sans que les parents s'inquiètent du contenu. Adaptés à l'été, adaptés aux enfants.",
    emoji: "🏖️",
    limit: 10,
    category: "seasonal",
    query: { type: "GAME", maxAge: 12 },
  },
  {
    id: "jeux-noel",
    title: "Jeux vidéo à offrir pour Noël",
    description: "Notre sélection de jeux vidéo à mettre sous le sapin, pour tous les âges.",
    intro: "Trouver le bon jeu vidéo à offrir à Noël, c'est un casse-tête pour beaucoup de parents. Trop violent ? Trop compliqué ? Pas assez fun ? On a fait le tri. 10 jeux qu'on recommande sans hésiter, avec pour chacun l'âge adapté et ce qu'il faut savoir avant d'acheter.",
    emoji: "🎁",
    limit: 10,
    category: "seasonal",
    query: { type: "GAME", maxAge: 12 },
  },
]

export async function GET(request: NextRequest) {
  try {
  const searchParams = request.nextUrl.searchParams
  const collectionId = searchParams.get("id")

  // If no collection ID, return list of all collections with counts + preview posters
  if (!collectionId) {
    const weekNumber = Math.floor(Date.now() / 604800000)

    // Single DB query — fetch minimal fields for all items, then filter in JS.
    const allItems = await prisma.mediaItem.findMany({
      select: {
        type: true,
        genres: true,
        topics: true,
        expertAgeRec: true,
        releaseDate: true,
        posterUrl: true,
        tmdbRating: true,
      },
      where: {
        // Quality gate: require real poster (not placeholder), age rating, and already released
        posterUrl: { not: null, notIn: ["/placeholder-poster.jpg", ""] },
        expertAgeRec: { not: null },
        releaseDate: { lte: new Date() },
      },
      orderBy: { tmdbRating: "desc" },
    })

    const collectionsWithCounts = COLLECTIONS.map((collection) => {
      const matching = allItems
        .filter((item) => matchesQuery(item, collection.query))
        .sort((a, b) => (b.tmdbRating ?? 7.0) - (a.tmdbRating ?? 7.0))
        .slice(0, collection.limit)
      const posters = matching
        .filter((item) => item.posterUrl)
        .slice(0, 8)
        .map((item) => item.posterUrl)

      // Weekly rotation for poster variety
      const offset = (weekNumber * 4) % Math.max(posters.length, 1)
      const rotated = [...posters.slice(offset), ...posters.slice(0, offset)]

      return {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        emoji: collection.emoji,
        limit: collection.limit,
        category: collection.category,
        count: matching.length,
        previewPosters: rotated.slice(0, 4),
      }
    }).filter((c) => c.count >= 3) // Only show collections with at least 3 items

    const response = NextResponse.json({
      collections: collectionsWithCounts,
    })
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

  // Build the query with quality gates
  const items = await getCollectionItems(collection.query, collection.limit)

  return NextResponse.json({
    collection: {
      id: collection.id,
      title: collection.title,
      description: collection.description,
      intro: collection.intro,
      emoji: collection.emoji,
      limit: collection.limit,
      category: collection.category,
    },
    items,
    total: items.length,
  })
  } catch (error) {
    console.error("Collections API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch collections", details: String(error) },
      { status: 500 }
    )
  }
}

async function getCollectionItems(query: Collection["query"], limit: number) {
  const where = buildWhereClause(query)

  // Quality gates: require real poster (not placeholder), age rating, and already released
  where.posterUrl = { not: null, notIn: ["/placeholder-poster.jpg", ""] }
  where.expertAgeRec = { not: null }
  where.releaseDate = { ...((where.releaseDate as object) || {}), lte: new Date() }

  // Fetch more than needed so we can sort nulls properly in JS
  const raw = await prisma.mediaItem.findMany({
    where,
    include: { contentMetrics: true },
    orderBy: [
      { tmdbRating: { sort: "desc", nulls: "last" } },
      { releaseDate: "desc" },
    ],
    take: limit * 3,
  })

  // Re-sort: treat null tmdbRating as 7.0 (decent default) so popular
  // films without a backfilled rating don't get excluded
  const items = raw
    .sort((a, b) => (b.tmdbRating ?? 7.0) - (a.tmdbRating ?? 7.0))
    .slice(0, limit)

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

  if (query.maxAge != null) {
    // Strict: only items WITH an age rating at or below maxAge (no nulls)
    where.expertAgeRec = { lte: query.maxAge }
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
    // Strict: require age rating AND must be ≤ maxAge
    if (item.expertAgeRec === null || item.expertAgeRec > query.maxAge) return false
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
