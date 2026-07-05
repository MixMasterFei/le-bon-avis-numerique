import { tool } from "ai"
import { z } from "zod"
import { Prisma, ReactionType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isPathAllowed } from "@/lib/totem/nav-allowlist"
import { searchPublishedBlogPosts } from "@/lib/totem/sanity-search"
import { matchMediaIdsByTitle, matchMediaIdsByTheme } from "@/lib/search-normalize"
import { getMemberAge } from "@/lib/age-utils"

export interface TotemToolContext {
  origin: string
  cookieHeader: string | null
  userId: string | null
}

const MEDIA_TYPES = ["MOVIE", "TV", "GAME", "BOOK", "APP"] as const

// Reactions that mean a family member has already experienced a title, so
// Totem shouldn't keep proposing it. TOO_YOUNG / TOO_OLD / NOT_FOR_ME are
// pre-watch judgments, not "seen", so they're excluded.
const SEEN_REACTIONS: ReactionType[] = [
  ReactionType.WATCHED,
  ReactionType.LOVED,
  ReactionType.LIKED,
  ReactionType.OK,
  ReactionType.SCARED,
  ReactionType.BORED,
]

/**
 * Media ids at least one member of the connected user's family has already
 * seen. Empty for anonymous users. Used to auto-hide already-seen titles from
 * Totem's proposals (the chatbot kept re-suggesting films the family had
 * watched).
 */
async function getSeenMediaIds(userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set()
  try {
    const rows = await prisma.mediaReaction.findMany({
      where: { familyMember: { userId }, reaction: { in: SEEN_REACTIONS } },
      select: { mediaId: true },
      distinct: ["mediaId"],
    })
    return new Set(rows.map((r) => r.mediaId))
  } catch (error) {
    console.error("[totem] getSeenMediaIds failed", error)
    return new Set()
  }
}

function trimText(s: string | null, max: number): string | null {
  if (!s) return null
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export function buildTotemTools(ctx: TotemToolContext) {
  return {
    /**
     * Search the catalogue for titles matching a query / filters.
     */
    searchMedia: tool({
      description:
        "Recherche dans le catalogue Totem (films, séries, jeux, livres). Renvoie au maximum 10 titres compacts. Trois usages : (1) par TITRE → passe 'q' (insensible aux accents : 'amelie' trouve 'Amélie') ; (2) par SUJET/THÈME (ex: 'un film sur l'histoire', 'sur l'amitié', 'sur l'espace') → passe 'theme', PAS 'q' ni 'genre' — 'theme' classe par pertinence thématique alors que 'q'/défaut classent par notoriété et renvoient des blockbusters hors-sujet ; (3) par filtre (âge, genre exact). IMPORTANT : pour 'le dernier', 'le plus récent', 'la dernière sortie', 'la dernière saison' — passe sort='newest'. Les résultats excluent déjà les titres que la famille a marqués comme déjà vus.",
      inputSchema: z.object({
        q: z.string().optional().describe("Requête par TITRE (titre partiel, insensible aux accents et à la casse)."),
        theme: z
          .string()
          .optional()
          .describe(
            "Requête par SUJET/THÈME plutôt que par titre : ex 'histoire', 'amitié', 'nature', 'espace', 'seconde guerre mondiale', 'écologie'. Cherche dans les genres, thèmes et synopsis, classé par pertinence thématique. Utilise CECI (pas 'q') dès que l'utilisateur décrit un sujet/type d'histoire plutôt qu'un titre précis.",
          ),
        type: z.enum(MEDIA_TYPES).optional().describe("Type de média à filtrer."),
        minAge: z.number().int().min(0).max(18).optional(),
        maxAge: z.number().int().min(0).max(18).optional(),
        genre: z.string().optional().describe("Un genre exact (ex: 'Comédie', 'Animation')."),
        sort: z
          .enum(["popular", "newest"])
          .optional()
          .describe(
            "Ordre de tri. 'popular' (défaut) trie par notoriété TMDB. 'newest' trie par date de sortie décroissante — à utiliser pour 'le dernier X', 'le plus récent', 'la dernière sortie'. (Ignoré quand 'theme' est fourni : le tri thématique prime.)",
          ),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ q, theme, type, minAge, maxAge, genre, sort, limit }) => {
        const cap = limit ?? 5
        const where: Prisma.MediaItemWhereInput = { type: { not: "MANGA" } }
        if (type) where.type = type
        if (minAge != null || maxAge != null) {
          where.expertAgeRec = {
            gte: minAge ?? 0,
            lte: maxAge ?? 99,
          }
        }
        if (genre) where.genres = { has: genre }

        // Resolve a thematic or title query to an ordered id list — both
        // accent-insensitive. 'theme' also matches genres/topics/synopsis and
        // is ranked by relevance (not raw popularity), which is what stops
        // "films historiques pour enfants" from returning Avengers first.
        let orderedIds: string[] | null = null
        if (theme && theme.trim().length >= 2) {
          orderedIds = await matchMediaIdsByTheme(theme, { limit: 40 })
        } else if (q && q.trim().length > 0) {
          orderedIds = await matchMediaIdsByTitle(q, { limit: 40 })
        }

        // Auto-hide titles the family has already seen.
        const seen = await getSeenMediaIds(ctx.userId)

        let filteredIds: string[] | null = null
        if (orderedIds) {
          filteredIds = seen.size ? orderedIds.filter((id) => !seen.has(id)) : orderedIds
          where.id = { in: filteredIds }
        } else if (seen.size) {
          where.NOT = { id: { in: [...seen] } }
        }

        // 'theme' owns the ranking; for a plain title/browse we let Postgres
        // order. When we resolved ids we re-rank in JS to preserve their
        // order — except for sort='newest', where date order must win.
        const useRelevanceOrder = !!orderedIds && sort !== "newest"

        let orderBy: Prisma.MediaItemOrderByWithRelationInput[]
        if (sort === "newest") {
          orderBy = [
            { releaseDate: { sort: "desc", nulls: "last" } },
            { tmdbVoteCount: { sort: "desc", nulls: "last" } },
          ]
        } else if (orderedIds) {
          orderBy = [{ tmdbVoteCount: { sort: "desc", nulls: "last" } }]
        } else {
          orderBy = [{ expertAgeRec: "asc" }, { tmdbVoteCount: { sort: "desc", nulls: "last" } }]
        }

        const fetchTake = orderedIds ? Math.min(filteredIds?.length ?? 0, 40) : cap
        const items =
          orderedIds && (filteredIds?.length ?? 0) === 0
            ? []
            : await prisma.mediaItem.findMany({
                where,
                orderBy,
                take: fetchTake,
                select: {
                  id: true,
                  title: true,
                  originalTitle: true,
                  type: true,
                  releaseDate: true,
                  posterUrl: true,
                  expertAgeRec: true,
                  communityAgeRec: true,
                  genres: true,
                  synopsisFr: true,
                },
              })

        let ranked = items
        if (useRelevanceOrder && orderedIds) {
          const pos = new Map(orderedIds.map((id, i) => [id, i]))
          ranked = [...items].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9))
        }

        return {
          results: ranked.slice(0, cap).map((m) => ({
            id: m.id,
            title: m.title,
            type: m.type,
            year: m.releaseDate ? new Date(m.releaseDate).getFullYear() : null,
            posterUrl: m.posterUrl,
            recommendedAge: m.expertAgeRec,
            communityAge: m.communityAgeRec,
            genres: m.genres.slice(0, 3),
            shortPitch: trimText(m.synopsisFr, 220),
          })),
        }
      },
    }),

    /**
     * Full details for one title — used after searchMedia to get content metrics.
     */
    getMediaDetails: tool({
      description:
        "Détails complets d'un titre du catalogue (synopsis, âge conseillé, métriques de contenu, genres, plateformes). À appeler après searchMedia avec l'id retourné.",
      inputSchema: z.object({
        mediaId: z.string().describe("L'identifiant du média (id renvoyé par searchMedia)."),
      }),
      execute: async ({ mediaId }) => {
        const media = await prisma.mediaItem.findUnique({
          where: { id: mediaId },
          include: { contentMetrics: true },
        })

        if (!media) {
          return { found: false, reason: "Titre introuvable dans le catalogue." }
        }

        return {
          found: true,
          id: media.id,
          title: media.title,
          type: media.type,
          year: media.releaseDate ? new Date(media.releaseDate).getFullYear() : null,
          synopsis: trimText(media.synopsisFr, 600),
          recommendedAge: media.expertAgeRec,
          communityAge: media.communityAgeRec,
          genres: media.genres,
          platforms: media.platforms,
          topics: media.topics?.slice(0, 12) ?? [],
          duration: media.duration,
          director: media.director,
          contentMetrics: media.contentMetrics
            ? {
                violence: media.contentMetrics.violence,
                sexNudity: media.contentMetrics.sexNudity,
                language: media.contentMetrics.language,
                substanceUse: media.contentMetrics.substanceUse,
                positiveMessages: media.contentMetrics.positiveMessages,
                roleModels: media.contentMetrics.roleModels,
                whatParentsNeedToKnow: (media.contentMetrics.whatParentsNeedToKnow ?? []).slice(0, 6),
                toneTags: ((media.contentMetrics.toneTags as string[] | null) ?? []).slice(0, 6),
                emotionalThemes: ((media.contentMetrics.emotionalThemes as string[] | null) ?? []).slice(0, 6),
                pacing: media.contentMetrics.pacing,
              }
            : null,
        }
      },
    }),

    /**
     * Aggregated user-submitted content scores + community age rec.
     */
    getCommunityConsensus: tool({
      description:
        "Consensus de la communauté de parents sur un titre : âge conseillé moyen voté, et moyennes des évaluations parentales (violence, peur, etc., 0-5).",
      inputSchema: z.object({
        mediaId: z.string(),
      }),
      execute: async ({ mediaId }) => {
        const [media, userMetrics] = await Promise.all([
          prisma.mediaItem.findUnique({
            where: { id: mediaId },
            select: { expertAgeRec: true, communityAgeRec: true, title: true },
          }),
          prisma.userContentMetrics.findMany({ where: { mediaId } }),
        ])

        if (!media) return { found: false }

        if (userMetrics.length === 0) {
          return {
            found: true,
            title: media.title,
            recommendedAge: media.expertAgeRec,
            communityAge: media.communityAgeRec,
            sampleSize: 0,
            averages: null,
          }
        }

        const sum = userMetrics.reduce(
          (acc, m) => ({
            violence: acc.violence + m.violence,
            sexNudity: acc.sexNudity + m.sexNudity,
            language: acc.language + m.language,
            substanceUse: acc.substanceUse + m.substanceUse,
            positiveMessages: acc.positiveMessages + m.positiveMessages,
            roleModels: acc.roleModels + m.roleModels,
          }),
          { violence: 0, sexNudity: 0, language: 0, substanceUse: 0, positiveMessages: 0, roleModels: 0 },
        )
        const n = userMetrics.length
        const round = (x: number) => Math.round((x / n) * 10) / 10

        return {
          found: true,
          title: media.title,
          recommendedAge: media.expertAgeRec,
          communityAge: media.communityAgeRec,
          sampleSize: n,
          averages: {
            violence: round(sum.violence),
            sexNudity: round(sum.sexNudity),
            language: round(sum.language),
            substanceUse: round(sum.substanceUse),
            positiveMessages: round(sum.positiveMessages),
            roleModels: round(sum.roleModels),
          },
        }
      },
    }),

    /**
     * Per-member fit score 0-100 with reason. Auth required.
     */
    getFamilyFit: tool({
      description:
        "Score d'adéquation famille (0-100) par membre du foyer pour un titre donné. Disponible UNIQUEMENT pour un utilisateur connecté avec au moins un membre famille — sinon, renvoie le statut correspondant.",
      inputSchema: z.object({
        mediaId: z.string(),
      }),
      execute: async ({ mediaId }) => {
        if (!ctx.userId) {
          return {
            status: "not_logged_in",
            hint: "L'utilisateur n'est pas connecté — propose-lui de créer un compte si pertinent.",
          }
        }

        try {
          const headers: HeadersInit = {}
          if (ctx.cookieHeader) headers.cookie = ctx.cookieHeader
          const res = await fetch(`${ctx.origin}/api/media/${encodeURIComponent(mediaId)}/family-fit`, {
            headers,
            cache: "no-store",
          })
          if (!res.ok) return { status: "error", code: res.status }
          const data = (await res.json()) as {
            status: string
            members?: Array<{
              name: string
              age: number | null
              score: number
              level: string
              reason: string
              hasPreferences: boolean
              affinity?: { hasConnection: boolean; affinityReason?: string }
            }>
          }
          if (data.status !== "ok" && data.status !== "family_warning") {
            return { status: data.status }
          }
          return {
            status: data.status,
            members: (data.members ?? []).map((m) => ({
              name: m.name,
              age: m.age,
              score: m.score,
              level: m.level,
              reason: m.reason,
              hasPreferences: m.hasPreferences,
              affinityReason: m.affinity?.affinityReason ?? null,
            })),
          }
        } catch (err) {
          console.error("[totem] getFamilyFit fetch failed", err)
          return { status: "error" }
        }
      },
    }),

    /**
     * Curated discovery rails — same content the homepage surfaces, in
     * compact form, with the canonical "voir tout" URL the model can
     * pass straight to proposeNavigation.
     *
     * One unified tool so the model picks the rail by user intent
     * instead of guessing filter combinations:
     *   - cinema:        live TMDB now_playing (FR) → /films?sort=cinema
     *   - newest:        derniers ajouts au catalogue → /films?sort=newest
     *   - by-age:        films adaptés à un âge donné → /films?maxAge=N
     *   - by-platform:   sur une plateforme de streaming → /films/recherche?platforms=X
     *   - by-genre:      films d'un genre donné → /films/recherche?genres=X
     *   - recent-games:  jeux vidéo récents → /jeux?sort=releaseDate
     */
    getDiscoveryRail: tool({
      description:
        "Récupère une sélection curatée du site (mêmes rails que la page d'accueil) avec l'URL canonique de la page complète. Utilise pour répondre à des intentions de découverte plutôt qu'à une recherche par titre. Choisis le rail en fonction de l'utilisateur : 'cinema' pour 'au ciné/en salle', 'newest' pour 'nouveautés/derniers ajouts', 'by-age' pour 'pour un enfant de N ans', 'by-platform' pour 'sur Netflix/Disney+', 'by-genre' pour 'films de comédie/aventure', 'recent-games' pour 'des jeux récents'. Termine en proposant proposeNavigation vers le seeAllUrl renvoyé.",
      inputSchema: z.object({
        rail: z.enum(["cinema", "newest", "by-age", "by-platform", "by-genre", "recent-games"]),
        age: z
          .number()
          .int()
          .min(0)
          .max(18)
          .optional()
          .describe("Âge maximum (REQUIS pour rail='by-age', optionnel filtre pour les autres)."),
        platform: z
          .string()
          .optional()
          .describe("Nom de plateforme (REQUIS pour rail='by-platform'). Ex: 'Netflix', 'Disney+', 'Prime Video', 'Canal+', 'Apple TV+'."),
        genre: z
          .string()
          .optional()
          .describe("Genre exact (REQUIS pour rail='by-genre'). Ex: 'Aventure', 'Animation', 'Comédie', 'Fantastique', 'Drame'."),
        limit: z.number().int().min(1).max(10).default(6),
      }),
      execute: async ({ rail, age, platform, genre, limit }) => {
        const cap = limit ?? 6
        // Auto-hide titles the family has already seen from every rail.
        const seen = await getSeenMediaIds(ctx.userId)

        // ---- cinema: live TMDB ----------------------------------
        if (rail === "cinema") {
          try {
            const headers: HeadersInit = {}
            if (ctx.cookieHeader) headers.cookie = ctx.cookieHeader
            const res = await fetch(`${ctx.origin}/api/cinema`, { headers, cache: "no-store" })
            if (!res.ok) return { rail, status: "error", code: res.status, results: [] }
            const data = (await res.json()) as {
              movies?: Array<{
                id: string
                title: string
                posterUrl: string | null
                releaseDate: string
                expertAgeRec: number | null
                communityAgeRec: number | null
                genres: string[]
                inDatabase: boolean
              }>
            }
            let movies = data.movies ?? []
            if (typeof age === "number") {
              movies = movies.filter((m) => m.expertAgeRec == null || m.expertAgeRec <= age)
            }
            if (seen.size) {
              movies = movies.filter((m) => !seen.has(m.id))
            }
            // Honour the age cap in the canonical "see all" URL so the
            // user lands on a pre-filtered films page, not the raw
            // cinema list.
            const seeAllUrl =
              typeof age === "number" ? `/films?sort=cinema&maxAge=${age}` : "/films?sort=cinema"
            return {
              rail,
              status: "ok",
              results: movies.slice(0, cap).map((m) => ({
                id: m.id,
                title: m.title,
                type: "MOVIE",
                year: m.releaseDate ? new Date(m.releaseDate).getFullYear() : null,
                posterUrl: m.posterUrl,
                recommendedAge: m.expertAgeRec,
                communityAge: m.communityAgeRec,
                genres: m.genres.slice(0, 3),
                inCatalog: m.inDatabase,
              })),
              seeAllUrl,
              seeAllLabel:
                typeof age === "number"
                  ? `En ce moment au cinéma (jusqu'à ${age} ans)`
                  : "En ce moment au cinéma",
            }
          } catch (err) {
            console.error("[totem] getDiscoveryRail(cinema) failed", err)
            return { rail, status: "error", results: [] }
          }
        }

        // ---- catalog rails (Prisma) ----------------------------
        const where: Prisma.MediaItemWhereInput = { type: { not: "MANGA" } }
        let orderBy: Prisma.MediaItemOrderByWithRelationInput[] = [
          { tmdbVoteCount: { sort: "desc", nulls: "last" } },
        ]
        let seeAllUrl = "/films"
        let seeAllLabel = "Le catalogue"

        if (rail === "newest") {
          orderBy = [{ createdAt: "desc" }]
          seeAllUrl = "/films?sort=newest"
          seeAllLabel = "Derniers ajouts"
        } else if (rail === "by-age") {
          if (typeof age !== "number") {
            return { rail, status: "missing_param", error: "age is required for by-age" }
          }
          where.expertAgeRec = { lte: age, gte: 0 }
          orderBy = [{ expertAgeRec: "asc" }, { tmdbVoteCount: { sort: "desc", nulls: "last" } }]
          seeAllUrl = `/films?maxAge=${age}`
          seeAllLabel = `Films adaptés jusqu'à ${age} ans`
        } else if (rail === "by-platform") {
          if (!platform || platform.trim().length === 0) {
            return { rail, status: "missing_param", error: "platform is required for by-platform" }
          }
          where.platforms = { has: platform }
          where.type = { in: ["MOVIE", "TV"] }
          orderBy = [{ tmdbVoteCount: { sort: "desc", nulls: "last" } }]
          seeAllUrl = `/films/recherche?platforms=${encodeURIComponent(platform)}&maxAge=10`
          seeAllLabel = `Sur ${platform}`
        } else if (rail === "by-genre") {
          if (!genre || genre.trim().length === 0) {
            return { rail, status: "missing_param", error: "genre is required for by-genre" }
          }
          where.genres = { has: genre }
          orderBy = [{ tmdbVoteCount: { sort: "desc", nulls: "last" } }]
          seeAllUrl = `/films/recherche?genres=${encodeURIComponent(genre)}`
          seeAllLabel = `Films ${genre.toLowerCase()}`
        } else if (rail === "recent-games") {
          where.type = "GAME"
          orderBy = [{ releaseDate: { sort: "desc", nulls: "last" } }]
          seeAllUrl = "/jeux?sort=releaseDate"
          seeAllLabel = "Jeux récents"
        }

        // Optional age cap on rails that aren't by-age (e.g. "des films
        // de comédie pour mes 7 ans" → rail=by-genre, age=7).
        if (rail !== "by-age" && typeof age === "number") {
          where.expertAgeRec = { lte: age, gte: 0 }
          seeAllUrl += seeAllUrl.includes("?") ? `&maxAge=${age}` : `?maxAge=${age}`
        }

        // Don't re-propose titles the family has already seen.
        if (seen.size) {
          where.NOT = { id: { in: [...seen] } }
        }

        const items = await prisma.mediaItem.findMany({
          where,
          orderBy,
          take: cap,
          select: {
            id: true,
            title: true,
            type: true,
            posterUrl: true,
            releaseDate: true,
            expertAgeRec: true,
            communityAgeRec: true,
            genres: true,
          },
        })

        return {
          rail,
          status: "ok",
          results: items.map((m) => ({
            id: m.id,
            title: m.title,
            type: m.type,
            year: m.releaseDate ? new Date(m.releaseDate).getFullYear() : null,
            posterUrl: m.posterUrl,
            recommendedAge: m.expertAgeRec,
            communityAge: m.communityAgeRec,
            genres: m.genres.slice(0, 3),
          })),
          seeAllUrl,
          seeAllLabel,
        }
      },
    }),

    /**
     * Search the parental blog (Sanity-backed). Use for *parenting topics*
     * — screen time, gaming guidelines, helping a child cope with scary
     * content. Not for searching media titles (use searchMedia instead).
     */
    searchBlog: tool({
      description:
        "Recherche dans le blog Totem Avisé (parentalité numérique : temps d'écran, jeux, séries, accompagnement). Pour des conseils thématiques aux parents — pas pour chercher un titre du catalogue.",
      inputSchema: z.object({
        q: z.string().min(1).describe("Requête textuelle (mots-clés du sujet, ex: 'temps d'écran ado')."),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ q, limit }) => {
        const posts = await searchPublishedBlogPosts(q, limit)
        return {
          posts: posts.map((p) => ({
            slug: p.slug,
            url: `/blog/${p.slug}`,
            title: p.title,
            excerpt: trimText(p.excerpt, 200),
            category: p.category,
            publishedAt: p.publishedAt,
          })),
        }
      },
    }),

    /**
     * Search Totem's news stories (NewsStory). Match strategy: title +
     * summary first; fall back to body only when zero matches AND query
     * has length >= 4 (avoids body-LIKE flood on short queries).
     */
    searchNews: tool({
      description:
        "Recherche dans les actualités Totem Avisé (sorties cinéma, polémiques, nouveautés streaming). Renvoie au maximum 5 articles publiés.",
      inputSchema: z.object({
        q: z.string().optional().describe("Requête textuelle (mots-clés)."),
        category: z.string().optional().describe("Filtre par catégorie d'actualité."),
        limit: z.number().int().min(1).max(5).default(3),
      }),
      execute: async ({ q, category, limit }) => {
        const baseWhere: Prisma.NewsStoryWhereInput = { status: "PUBLISHED" }
        if (category) baseWhere.category = category as Prisma.NewsStoryWhereInput["category"]

        const trimmedQ = q?.trim() ?? ""

        async function runMatch(matchOnBody: boolean) {
          if (trimmedQ.length === 0) {
            return prisma.newsStory.findMany({
              where: baseWhere,
              orderBy: { publishedAt: "desc" },
              take: limit ?? 3,
              select: {
                slug: true,
                title: true,
                summary: true,
                category: true,
                publishedAt: true,
                relatedMediaIds: true,
              },
            })
          }

          const fields: Prisma.NewsStoryWhereInput[] = [
            { title: { contains: trimmedQ, mode: "insensitive" } },
            { summary: { contains: trimmedQ, mode: "insensitive" } },
          ]
          if (matchOnBody) {
            fields.push({ body: { contains: trimmedQ, mode: "insensitive" } })
          }

          return prisma.newsStory.findMany({
            where: { ...baseWhere, OR: fields },
            orderBy: { publishedAt: "desc" },
            take: limit ?? 3,
            select: {
              slug: true,
              title: true,
              summary: true,
              category: true,
              publishedAt: true,
              relatedMediaIds: true,
            },
          })
        }

        let stories = await runMatch(false)
        // Fallback: only widen to body when the cheap query came up dry
        // AND the query string is long enough to keep noise low.
        if (stories.length === 0 && trimmedQ.length >= 4) {
          stories = await runMatch(true)
        }

        return {
          stories: stories.map((s) => ({
            slug: s.slug,
            // News routing lives at /apercudecouverte/[slug] — never
            // /news/* or /actualites/*. Format the path here so the
            // model copies the right URL into proposeNavigation.
            url: `/apercudecouverte/${s.slug}`,
            title: s.title,
            summary: trimText(s.summary, 240),
            category: s.category,
            publishedAt: s.publishedAt,
            citedMediaIds: s.relatedMediaIds.slice(0, 5),
          })),
        }
      },
    }),

    /**
     * Richer family snapshot for logged-in users. Allows Totem to look
     * up details on demand (instead of bloating every system prompt).
     * Output capped at ~2 KB — last 5 reactions per member, top 5
     * favourite genres, max 3 avoid topics. Auth-only.
     */
    getUserFamilyContext: tool({
      description:
        "Détails complets sur les membres du foyer connecté : prénoms, âges, sensibilités, genres préférés, sujets à éviter, et 5 dernières réactions par membre (films/séries vus, aimés, etc.). Disponible UNIQUEMENT pour un utilisateur connecté.",
      inputSchema: z.object({}).describe("Pas de paramètre — renvoie le foyer du compte connecté."),
      execute: async () => {
        if (!ctx.userId) {
          return {
            status: "not_logged_in",
            hint: "Pas de compte connecté — propose-lui d'en créer un si pertinent.",
          }
        }

        const members = await prisma.familyMember.findMany({
          where: { userId: ctx.userId },
          take: 10,
          include: {
            reactions: {
              orderBy: { createdAt: "desc" },
              take: 5,
              include: {
                media: { select: { title: true, type: true } },
              },
            },
          },
        })

        if (members.length === 0) {
          return { status: "no_family", hint: "Le compte est connecté mais aucun membre famille n'est créé." }
        }

        return {
          status: "ok",
          members: members.map((m) => ({
            id: m.id,
            name: m.name,
            age: getMemberAge(m.birthYear, m.birthMonth),
            avatarEmoji: m.avatarEmoji,
            favoriteGenres: m.favoriteGenres.slice(0, 5),
            dislikedGenres: m.dislikedGenres.slice(0, 3),
            avoidTopics: m.avoidTopics.slice(0, 3),
            interests: m.interests.slice(0, 5),
            sensitivities: {
              violence: m.sensitivityViolence,
              scary: m.sensitivityScary,
              sexual: m.sensitivitySexual,
              language: m.sensitivityLanguage,
              substances: m.sensitivitySubstances,
            },
            useCustomSettings: m.useCustomSettings,
            recentReactions: m.reactions.map((r) => ({
              mediaTitle: r.media.title,
              mediaType: r.media.type,
              reaction: r.reaction,
              at: r.createdAt.toISOString(),
            })),
          })),
        }
      },
    }),

    /**
     * Client-resolved: propose adding a media to the user's watchlist.
     * The existing endpoint TOGGLES, so the client must check current
     * state first to avoid silently removing.
     */
    proposeAddToWatchlist: tool({
      description:
        "Propose à l'utilisateur d'ajouter un titre à sa liste 'à voir plus tard'. L'utilisateur voit un bouton de confirmation. Disponible uniquement pour un utilisateur connecté.",
      inputSchema: z.object({
        mediaId: z.string(),
        mediaTitle: z.string().describe("Titre exact tel qu'il apparaît dans le catalogue."),
      }),
      // No execute — resolved client-side.
    }),

    /**
     * Client-resolved: propose recording a reaction (loved/liked/etc) for
     * a specific family member. Totem must use a real familyMemberId
     * obtained via getUserFamilyContext — never invent one.
     */
    proposeReaction: tool({
      description:
        "Propose d'enregistrer une réaction (LOVED, LIKED, WATCHED, OK, SCARED, BORED, TOO_YOUNG, TOO_OLD) d'un membre du foyer pour un titre. À utiliser quand le parent décrit explicitement l'expérience d'un enfant ('Léa a adoré'). N'invente JAMAIS un familyMemberId — utilise un id réel renvoyé par getUserFamilyContext.",
      inputSchema: z.object({
        mediaId: z.string(),
        mediaTitle: z.string(),
        familyMemberId: z.string().describe("Id réel d'un membre, obtenu via getUserFamilyContext."),
        familyMemberName: z.string().describe("Prénom du membre, pour l'affichage utilisateur."),
        reaction: z.enum([
          "LOVED",
          "LIKED",
          "WATCHED",
          "OK",
          "SCARED",
          "BORED",
          "TOO_YOUNG",
          "TOO_OLD",
        ]),
      }),
      // No execute — resolved client-side.
    }),

    /**
     * Client-resolved tool: the model proposes a navigation, the UI renders
     * a confirm card, and the browser performs router.push only on user
     * click. The server-side execute validates the path against the
     * allowlist as a defence-in-depth.
     */
    proposeNavigation: tool({
      description:
        "Propose à l'utilisateur de naviguer vers une page interne du site (ex: /connexion, /profil, /films, /media/<type>:<id>). L'utilisateur voit un bouton de confirmation et peut accepter ou refuser. À utiliser quand la question est fondamentalement de la navigation.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Chemin interne commençant par '/'. Pages autorisées : /, /connexion, /inscription, /profil, /profil/*, /films, /films/*, /series, /series/*, /jeux, /jeux/*, /livres, /livres/*, /recherche, /blog, /blog/*, /apercudecouverte/*, /media/<type>:<id> (ex: /media/movie:<uuid>). Aucune URL externe — surtout pas /news ni /actualites (n'existent pas).",
          ),
        label: z.string().describe("Libellé court de la destination, en français (ex: 'Page de connexion')."),
        reason: z
          .string()
          .describe("Phrase courte adressée à l'utilisateur expliquant pourquoi cette page est utile. Vouvoiement."),
      }),
      // No execute() — this tool is resolved client-side. The chat route
      // streams the call; the browser shows a confirm card and posts the
      // result back. We DO add a server-side validator below for
      // defence-in-depth via a separate helper.
    }),
  }
}

// Defence-in-depth: client must call this before performing router.push.
export function validateProposedNavigation(path: unknown): { ok: true; path: string } | { ok: false; reason: string } {
  if (typeof path !== "string") return { ok: false, reason: "path_must_be_string" }
  if (!isPathAllowed(path)) return { ok: false, reason: "path_not_allowed" }
  return { ok: true, path }
}
