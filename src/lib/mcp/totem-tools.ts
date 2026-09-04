import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { NON_POSTER_URLS, PUBLIC_MEDIA_QUALITY_FLOOR, toMediaRouteId, mediaTypeShortLabels, type MediaType } from "@/lib/media-route"
import { compactTitle, compactSql } from "@/lib/search-normalize"
import { renderMediaMarkdown, mediaAssessment } from "@/lib/markdown/media-md"
import { loadMediaMdInput } from "@/lib/markdown/media-md-data"
import { buildSelectionMarkdown } from "@/lib/markdown/selection-md"
import { shouldHideContentAnalysis } from "@/lib/release-status"
import { toolError, type ToolResponse } from "./result"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"
const SEARCH_TYPE_MAP = { film: "MOVIE", serie: "TV", jeu: "GAME" } as const
export type SearchType = keyof typeof SEARCH_TYPE_MAP
interface SearchRow {
  id: string; title: string; originalTitle: string | null; type: MediaType; releaseDate: Date | null
  expertAgeRec: number | null; isEnriched: boolean; releaseStatus: string | null
}

export async function searchCatalog(query: string, type?: SearchType, take = 10, year?: number): Promise<SearchRow[]> {
  const compact = compactTitle(query.trim())
  if (compact.length < 2) return []
  const ct = Prisma.raw(compactSql("title"))
  const co = Prisma.raw(compactSql("coalesce(original_title, '')"))
  // Apply visibility and type gates BEFORE LIMIT. The normalization mirrors
  // the website; raw SQL fragments contain only fixed column expressions.
  // Every user value is parameterized, including the optional year and type.
  return withPrismaRetry(() => prisma.$queryRaw<SearchRow[]>(Prisma.sql`
    SELECT id, title, original_title AS "originalTitle", type,
      release_date AS "releaseDate", expert_age_rec AS "expertAgeRec",
      is_enriched AS "isEnriched", release_status AS "releaseStatus"
    FROM media_items
    WHERE type::text IN ('MOVIE', 'TV', 'GAME')
      AND poster_url IS NOT NULL AND poster_url NOT IN (${Prisma.join([...NON_POSTER_URLS])})
      AND data_quality_score >= ${PUBLIC_MEDIA_QUALITY_FLOOR}
      ${type ? Prisma.sql`AND type::text = ${SEARCH_TYPE_MAP[type]}` : Prisma.empty}
      ${year ? Prisma.sql`AND release_date >= ${new Date(`${year}-01-01T00:00:00Z`)} AND release_date < ${new Date(`${year + 1}-01-01T00:00:00Z`)}` : Prisma.empty}
      AND (${ct} LIKE '%' || ${compact} || '%' OR ${co} LIKE '%' || ${compact} || '%')
    ORDER BY CASE WHEN ${ct} = ${compact} OR ${co} = ${compact} THEN 0
                  WHEN ${ct} LIKE ${compact} || '%' OR ${co} LIKE ${compact} || '%' THEN 1 ELSE 2 END,
      CASE WHEN release_date >= now() - interval '90 days' THEN 0 ELSE 1 END,
      tmdb_vote_count DESC NULLS LAST, id
    LIMIT ${Math.min(Math.max(take, 1), 10)}
  `))
}

function publicMatch(row: SearchRow) {
  const id = toMediaRouteId(row.type, row.id)
  return { id, title: row.title, type: row.type, year: row.releaseDate?.getUTCFullYear() ?? null,
    age: row.expertAgeRec && row.expertAgeRec > 0 ? row.expertAgeRec : null,
    provisional: shouldHideContentAnalysis(row), url: `${SITE_URL}/media/${id}` }
}
function searchRowLine(row: SearchRow) {
  const m = publicMatch(row)
  return `- \`${m.id}\` — **${m.title}**${m.year ? ` (${m.year})` : ""} · ${mediaTypeShortLabels[m.type]} · ${m.age ? `dès ${m.age} ans${m.provisional ? " (estimation à confirmer)" : ""}` : "âge à confirmer"}`
}
function validQuery(query: string) { return query.trim().length <= 120 && compactTitle(query).length >= 2 }

export async function searchMedia(query: string, type?: SearchType, limit = 5): Promise<ToolResponse> {
  if (!validQuery(query)) return toolError("invalid_input", "Précisez au moins deux lettres ou chiffres du titre recherché (120 caractères maximum).")
  const rows = await searchCatalog(query, type, limit)
  return {
    text: rows.length ? [
      `Titres correspondant à « ${query.trim()} » dans le catalogue Totem Avisé :`, "", ...rows.map(searchRowLine), "",
      "Pour les repères d'un titre, appelez `get_age_verdict` avec son identifiant. En cas d'hésitation, demandez au parent de préciser le titre ou l'année.",
    ].join("\n") : `Aucun titre ne correspond à « ${query.trim()} » dans le catalogue public. Essayez une autre formulation : ${SITE_URL}/recherche.`,
    data: { schemaVersion: 1, status: rows.length ? "ok" : "not_found", result: { kind: "search", query: query.trim(), matches: rows.map(publicMatch) } },
  }
}

export async function ageVerdict(params: { id?: string; title?: string; type?: SearchType; year?: number }): Promise<ToolResponse> {
  let resolvedId = params.id?.trim()
  if (!resolvedId && (!params.title || !validQuery(params.title))) {
    return toolError("invalid_input", "Précisez l'identifiant renvoyé par `search_media`, ou un titre d'au moins deux lettres ou chiffres.")
  }
  if (!resolvedId && params.title) {
    const rows = await searchCatalog(params.title, params.type, 10, params.year)
    const compact = compactTitle(params.title)
    const exact = rows.filter((r) => compactTitle(r.title) === compact || (r.originalTitle && compactTitle(r.originalTitle) === compact))
    const candidates = exact.length ? exact : rows
    if (candidates.length !== 1) {
      return {
        text: candidates.length ? ["Plusieurs titres correspondent. Demandez au parent lequel il cherche avant de donner un âge conseillé :", "", ...candidates.map(searchRowLine), "", "Relancez `get_age_verdict` avec l'identifiant choisi, ou précisez `year` et `type`."].join("\n")
          : `Aucun titre trouvé. Essayez la recherche avec une autre formulation : ${SITE_URL}/recherche.`,
        data: { schemaVersion: 1, status: candidates.length ? "ambiguous" : "not_found", result: { kind: "verdict", media: null, candidates: candidates.map(publicMatch) } },
      }
    }
    resolvedId = toMediaRouteId(candidates[0].type, candidates[0].id)
  }
  const input = await loadMediaMdInput(resolvedId!)
  if (!input) return { text: "Identifiant introuvable ou invalide. Utilisez l'identifiant exact renvoyé par `search_media`. Les identifiants numériques nécessitent un préfixe `movie:`, `tv:` ou `game:`.",
    data: { schemaVersion: 1, status: "not_found", result: { kind: "verdict", media: null, candidates: [] } } }
  if ((params.type && input.type !== SEARCH_TYPE_MAP[params.type]) || (params.year && input.releaseDate?.slice(0, 4) !== String(params.year))) {
    return toolError("invalid_input", "L'identifiant ne correspond pas au type ou à l'année indiqués. Vérifiez le titre avec `search_media`.")
  }
  const id = toMediaRouteId(input.type, input.id)
  return { text: renderMediaMarkdown(input), data: { schemaVersion: 1, status: "ok", result: { kind: "verdict", candidates: [], media: {
    id, title: input.title, type: input.type, year: input.releaseDate ? Number(input.releaseDate.slice(0, 4)) : null,
    age: input.expertAgeRec && input.expertAgeRec > 0 ? input.expertAgeRec : null, provisional: shouldHideContentAnalysis(input), url: `${SITE_URL}/media/${id}`,
    updatedAt: input.updatedAt.toISOString(), classification: { value: input.officialRating, country: null, authority: null }, assessment: mediaAssessment(input),
  } } } }
}

export async function recommendForAge(age: number, type = "films", limit = 10): Promise<ToolResponse> {
  const selection = await buildSelectionMarkdown(type, age, { limit })
  if (!selection) return toolError("invalid_input", "Indiquez films, series ou jeux, et un âge entier de 3 à 16 ans.")
  return { text: selection.body, data: { schemaVersion: 1, status: "ok", result: { kind: "selection", age, type: type as "films" | "series" | "jeux", url: selection.htmlUrl, items: selection.items } } }
}
