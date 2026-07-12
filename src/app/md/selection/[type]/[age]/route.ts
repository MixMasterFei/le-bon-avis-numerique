import { fetchMovies, fetchSeries, fetchGames, type TransformedMediaItem } from "@/lib/media-queries"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://totemavise.com"

export const revalidate = 3600

// Markdown recommendation lists for AI agents — the other half of parent
// prompts. /md/media answers "ce titre convient-il à N ans ?"; this layer
// answers "recommande-moi un film/une série/un jeu pour un enfant de N ans".
// Same curated queries as the browse pages (enriched-only, quality-sorted):
// no parallel editorial, no drift.

const TYPE_CONFIG: Record<
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

const MIN_AGE = 3
const MAX_AGE = 16

interface RouteParams {
  params: Promise<{ type: string; age: string }>
}

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
    },
  })
}

function itemLine(item: TransformedMediaItem, mediaType: MediaType): string {
  const canonical = `${baseUrl}/media/${toMediaRouteId(mediaType, item.id)}`
  const age = item.expertAgeRec ? `dès ${item.expertAgeRec} ans` : "âge à confirmer"
  const year = item.releaseDate ? ` (${item.releaseDate.slice(0, 4)})` : ""
  const themes = item.topics.slice(0, 3).join(", ")
  const themesPart = themes ? ` — thèmes : ${themes}` : ""
  return `- **${item.title}**${year} — ${age}${themesPart} — [fiche](${canonical})`
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { type, age: ageParam } = await params

  const config = TYPE_CONFIG[type]
  const age = parseInt(ageParam, 10)
  if (!config || Number.isNaN(age) || age < MIN_AGE || age > MAX_AGE || String(age) !== ageParam) {
    return notFoundResponse()
  }

  let items: TransformedMediaItem[]
  try {
    const result = await config.fetch({
      maxAge: age,
      sortBy: "quality",
      limit: 20,
      requirePoster: true,
      minQuality: 50,
    })
    items = result.items
  } catch (error) {
    console.error("[md/selection] query failed:", error instanceof Error ? error.message : error)
    return notFoundResponse()
  }

  const htmlUrl = `${baseUrl}${config.htmlPath}?maxAge=${age}`

  const lines: string[] = []
  lines.push(`# ${config.label} conseillés pour un enfant de ${age} ans`, "")
  lines.push(`URL canonique: ${htmlUrl}`)
  lines.push(`Langue: français`)
  lines.push(`Source: Totem Avisé — sélection issue du catalogue évalué (âge conseillé indépendant, dimensions de contenu vérifiées).`)
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
      `selon les sensibilités (peur, violence…), les goûts et les réactions de chaque enfant : ${baseUrl}/inscription`,
    "",
  )

  lines.push("## Pages liées", "")
  lines.push(`- [Recherche complète avec filtres](${htmlUrl})`)
  lines.push(`- [Notre méthode](${baseUrl}/notre-methode)`)
  lines.push(`- [Index Markdown](${baseUrl}/md)`)
  lines.push("")

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Robots-Tag": "noindex, follow",
      "Link": `<${htmlUrl}>; rel="canonical"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  })
}
