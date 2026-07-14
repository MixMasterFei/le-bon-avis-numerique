import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import {
  publicMediaWhere,
  toMediaRouteId,
  mediaTypeShortLabels,
  type MediaType,
} from "@/lib/media-route"
import { renderMediaMarkdown } from "@/lib/markdown/media-md"
import { loadMediaMdInput } from "@/lib/markdown/media-md-data"
import { buildSelectionMarkdown } from "@/lib/markdown/selection-md"
import { pickBestTitleMatch } from "@/lib/mcp/title-match"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

// Tool implementations for the public Totem MCP server (/api/mcp).
//
// Design rule (funnel-safe freemium): anonymous tools describe the MEDIA —
// verdict, dimensions, reasoning, same wording as the /md layer — and always
// end on the honest per-child pointer. Anything that describes the FAMILY
// (per-child fit scores) stays behind a Totem account; v1 links out to the
// site, a future authenticated v2 may expose it in-chat.

const SEARCH_TYPE_MAP: Record<string, MediaType> = {
  film: "MOVIE",
  serie: "TV",
  jeu: "GAME",
}

interface SearchRow {
  id: string
  title: string
  type: string
  releaseDate: Date | null
  expertAgeRec: number | null
  isEnriched: boolean
  dataQualityScore: number
}

async function searchCatalog(query: string, type?: string, take = 5): Promise<SearchRow[]> {
  const q = query.trim()
  return withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        ...publicMediaWhere,
        ...(type && SEARCH_TYPE_MAP[type] ? { type: SEARCH_TYPE_MAP[type] } : {}),
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { originalTitle: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        releaseDate: true,
        expertAgeRec: true,
        isEnriched: true,
        dataQualityScore: true,
      },
      orderBy: { dataQualityScore: "desc" },
      take,
    }),
  )
}

function searchRowLine(row: SearchRow): string {
  const routeId = toMediaRouteId(row.type as MediaType, row.id)
  const label = mediaTypeShortLabels[row.type as MediaType] ?? row.type
  const year = row.releaseDate ? ` (${row.releaseDate.toISOString().slice(0, 4)})` : ""
  const age =
    row.expertAgeRec && row.expertAgeRec > 0
      ? `dès ${row.expertAgeRec} ans${row.isEnriched ? "" : " (estimation à confirmer)"}`
      : "âge à confirmer"
  return `- \`${routeId}\` — **${row.title}**${year} · ${label} · ${age}`
}

export async function searchMediaText(query: string, type?: string, limit = 5): Promise<string> {
  const take = Math.min(Math.max(limit, 1), 10)
  const rows = await searchCatalog(query, type, take)

  if (rows.length === 0) {
    return (
      `Aucun titre du catalogue Totem Avisé ne correspond à « ${query.trim()} ».\n\n` +
      `Le catalogue couvre plus de 11 000 films, séries et jeux vidéo, mais pas encore tout. ` +
      `Recherche complète sur le site : ${SITE_URL}/recherche — les parents peuvent aussi y demander l'ajout d'un titre manquant.`
    )
  }

  const lines = [
    `Titres correspondant à « ${query.trim()} » dans le catalogue Totem Avisé :`,
    "",
    ...rows.map(searchRowLine),
    "",
    "Pour le verdict complet d'un titre (âge conseillé, 8 dimensions de contenu, « Pourquoi cet âge ? »), appelez `get_age_verdict` avec son identifiant.",
  ]
  return lines.join("\n")
}

export async function ageVerdictText(params: { id?: string; title?: string }): Promise<string> {
  let resolvedId = params.id?.trim()
  let alternates: SearchRow[] = []

  if (!resolvedId && params.title) {
    const rows = await searchCatalog(params.title, undefined, 5)
    if (rows.length === 0) {
      return (
        `Aucun titre du catalogue Totem Avisé ne correspond à « ${params.title.trim()} ». ` +
        `Essayez \`search_media\` avec une autre orthographe, ou la recherche du site : ${SITE_URL}/recherche.`
      )
    }
    // Exact-title collisions resolve to the most recent release, not the
    // best-enriched fiche (see title-match.ts — the "L'Odyssée" 2016/2026 case).
    const best = pickBestTitleMatch(rows, params.title)!
    resolvedId = toMediaRouteId(best.type as MediaType, best.id)
    alternates = rows.filter((r) => r.id !== best.id).slice(0, 2)
  }

  if (!resolvedId) {
    return "Précisez un identifiant (`id`, ex. `movie:abc123`) ou un titre (`title`)."
  }

  const input = await loadMediaMdInput(resolvedId)
  if (!input) {
    return (
      `Identifiant « ${resolvedId} » introuvable dans le catalogue public Totem Avisé. ` +
      `Utilisez \`search_media\` pour trouver l'identifiant exact.`
    )
  }

  // Same render as /md/media/[id]: verdict, 8 dimensions, "Pourquoi cet âge ?",
  // and the per-child account pointer.
  let text = renderMediaMarkdown(input)

  if (alternates.length > 0) {
    text +=
      `\n## Autres correspondances possibles\n\n` +
      alternates.map(searchRowLine).join("\n") +
      "\n"
  }

  return text
}

export async function recommendForAgeText(age: number, type = "films", limit = 10): Promise<string> {
  const selection = await buildSelectionMarkdown(type, age, { limit })
  if (!selection) {
    return "Paramètres invalides : `type` doit être `films`, `series` ou `jeux`, et `age` un entier entre 3 et 16."
  }
  return selection.body
}
