import { fetchMovies, fetchSeries, fetchGames, type TransformedMediaItem } from "@/lib/media-queries"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

// Shared "sélection par âge" markdown builder — single source for the
// /md/selection/[type]/[age] route AND the MCP recommend_for_age tool, so an
// answer engine reading the md layer and an assistant calling the MCP server
// get the exact same curated list with the same wording.

export const SELECTION_MIN_AGE = 3
export const SELECTION_MAX_AGE = 16

export const SELECTION_TYPES: Record<
  string,
  {
    label: string
    childLabel: string
    mediaType: MediaType
    htmlPath: string
    fetch: typeof fetchMovies
  }
> = {
  films: {
    label: "Films",
    childLabel: "film",
    mediaType: "MOVIE",
    htmlPath: "/films",
    fetch: fetchMovies,
  },
  series: {
    label: "Séries",
    childLabel: "série",
    mediaType: "TV",
    htmlPath: "/series",
    fetch: fetchSeries,
  },
  jeux: {
    label: "Jeux vidéo",
    childLabel: "jeu vidéo",
    mediaType: "GAME",
    htmlPath: "/jeux",
    fetch: fetchGames,
  },
}

function itemLine(item: TransformedMediaItem, mediaType: MediaType): string {
  const canonical = `${SITE_URL}/media/${toMediaRouteId(mediaType, item.id)}`
  const age = item.expertAgeRec ? `dès ${item.expertAgeRec} ans` : "âge à confirmer"
  const year = item.releaseDate ? ` (${item.releaseDate.slice(0, 4)})` : ""
  const themes = item.topics.slice(0, 3).join(", ")
  const themesPart = themes ? ` — thèmes : ${themes}` : ""
  return `- **${item.title}**${year} — ${age}${themesPart} — [fiche](${canonical})`
}

export interface SelectionMarkdown {
  body: string
  htmlUrl: string
  items: Array<{ id: string; title: string; type: MediaType; year: number | null; age: number | null; provisional: boolean; url: string }>
}

/**
 * Builds the curated age-selection markdown, or null when type/age is invalid.
 * Throws only on DB errors (callers decide how to surface those).
 */
export async function buildSelectionMarkdown(
  type: string,
  age: number,
  options: { limit?: number } = {},
): Promise<SelectionMarkdown | null> {
  const config = Object.hasOwn(SELECTION_TYPES, type) ? SELECTION_TYPES[type] : undefined
  if (!config || !Number.isInteger(age) || age < SELECTION_MIN_AGE || age > SELECTION_MAX_AGE) {
    return null
  }

  const limit = Math.min(Math.max(options.limit ?? 20, 1), 20)
  const result = await config.fetch({
    maxAge: age,
    sortBy: "quality",
    limit,
    requirePoster: true,
    minQuality: 50,
  })
  // Keep the explicit promise true even if a browse-page exception changes.
  const items = result.items.filter((item) => item.expertAgeRec != null && item.expertAgeRec > 0 && item.expertAgeRec <= age && !item.isProvisional)

  const htmlUrl = `${SITE_URL}${config.htmlPath}?maxAge=${age}`

  const lines: string[] = []
  lines.push(`# ${config.label} conseillés pour un enfant de ${age} ans`, "")
  lines.push(`URL canonique: ${htmlUrl}`)
  lines.push(`Langue: français`)
  lines.push(`Source: Totem Avisé — repères issus d'une analyse automatisée du catalogue, susceptibles d'être corrigés par les retours des familles.`)
  lines.push("")
  lines.push(
    `Chaque ${config.childLabel} ci-dessous a un âge conseillé Totem Avisé inférieur ou égal à ${age} ans. ` +
      `L'âge conseillé est un repère indépendant, souvent plus prudent que la classification officielle ; ` +
      `la fiche de chaque titre détaille les dimensions de contenu (violence, langage, peur…) et le pourquoi de l'âge.`,
    "",
  )

  if (items.length === 0) {
    lines.push(`Aucun titre évalué ne correspond actuellement à ce filtre. Voir ${htmlUrl} pour la recherche complète.`, "")
  } else {
    lines.push(`## Sélection (${items.length} titres, qualité décroissante)`, "")
    for (const item of items) {
      lines.push(itemLine(item, config.mediaType))
    }
    lines.push("")
  }

  lines.push("## Adapter cette sélection à votre enfant", "")
  lines.push(
    `Cette liste est filtrée par âge uniquement. Avec un compte famille gratuit, Totem Avisé personnalise les recommandations ` +
      `selon les sensibilités (peur, violence…), les goûts et les réactions de chaque enfant : ${SITE_URL}/inscription`,
    "",
  )

  lines.push("## Pages liées", "")
  lines.push(`- [Recherche complète avec filtres](${htmlUrl})`)
  lines.push(`- [Notre méthode](${SITE_URL}/notre-methode)`)
  lines.push(`- [Index Markdown](${SITE_URL}/md)`)
  lines.push("")

  return { body: lines.join("\n"), htmlUrl, items: items.map((item) => {
    const id = toMediaRouteId(config.mediaType, item.id)
    return { id, title: item.title, type: config.mediaType, year: item.releaseDate ? Number(item.releaseDate.slice(0, 4)) : null,
      age: item.expertAgeRec, provisional: false, url: `${SITE_URL}/media/${id}` }
  }) }
}
