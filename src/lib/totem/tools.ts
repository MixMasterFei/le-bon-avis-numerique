import { tool } from "ai"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isPathAllowed } from "@/lib/totem/nav-allowlist"

export interface TotemToolContext {
  origin: string
  cookieHeader: string | null
  userId: string | null
}

const MEDIA_TYPES = ["MOVIE", "TV", "GAME", "BOOK", "APP"] as const

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
        "Recherche dans le catalogue Totem (films, séries, jeux, livres). Renvoie au maximum 10 titres compacts. Utilise pour trouver un titre par nom ou par filtre (âge, genre).",
      inputSchema: z.object({
        q: z.string().optional().describe("Requête textuelle (titre partiel)."),
        type: z.enum(MEDIA_TYPES).optional().describe("Type de média à filtrer."),
        minAge: z.number().int().min(0).max(18).optional(),
        maxAge: z.number().int().min(0).max(18).optional(),
        genre: z.string().optional().describe("Un genre exact (ex: 'Comédie', 'Animation')."),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ q, type, minAge, maxAge, genre, limit }) => {
        const where: Prisma.MediaItemWhereInput = { type: { not: "MANGA" } }
        if (type) where.type = type
        if (minAge != null || maxAge != null) {
          where.expertAgeRec = {
            gte: minAge ?? 0,
            lte: maxAge ?? 99,
          }
        }
        if (genre) where.genres = { has: genre }
        if (q && q.trim().length > 0) {
          where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { originalTitle: { contains: q, mode: "insensitive" } },
          ]
        }

        const items = await prisma.mediaItem.findMany({
          where,
          orderBy: q
            ? [{ tmdbVoteCount: { sort: "desc", nulls: "last" } }]
            : [{ expertAgeRec: "asc" }, { tmdbVoteCount: { sort: "desc", nulls: "last" } }],
          take: limit ?? 5,
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

        return {
          results: items.map((m) => ({
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
     * Client-resolved tool: the model proposes a navigation, the UI renders
     * a confirm card, and the browser performs router.push only on user
     * click. The server-side execute validates the path against the
     * allowlist as a defence-in-depth.
     */
    proposeNavigation: tool({
      description:
        "Propose à l'utilisateur de naviguer vers une page interne du site (ex: /connexion, /profil, /films, /media/[id]). L'utilisateur voit un bouton de confirmation et peut accepter ou refuser. À utiliser quand la question est fondamentalement de la navigation.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Chemin interne commençant par '/'. Pages autorisées : /, /connexion, /inscription, /profil, /profil/*, /films, /films/*, /series, /series/*, /jeux, /jeux/*, /livres, /livres/*, /recherche, /blog, /blog/*, /news, /news/*, /media/[id]. Aucune URL externe.",
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
