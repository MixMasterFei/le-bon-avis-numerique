import type { MediaType } from "@/lib/types"

export type { MediaType }

/**
 * Route id format: `<type>:<encodedId>`
 * - type is lowercased ("movie", "tv", ...)
 * - id is encodeURIComponent(...) so it can safely include special chars
 */
export function toMediaRouteId(type: MediaType, id: string): string {
  return `${type.toLowerCase()}:${encodeURIComponent(id)}`
}

export function parseMediaRouteId(routeId: string): { type: MediaType | null; id: string } {
  // Next.js params may provide percent-encoded segments (e.g. "movie%3A123"),
  // so decode the whole segment first, then parse.
  let decodedRouteId = routeId
  try {
    decodedRouteId = decodeURIComponent(routeId)
  } catch {
    // keep raw
  }

  const sepIdx = decodedRouteId.indexOf(":")
  if (sepIdx === -1) return { type: null, id: decodedRouteId }

  const rawType = decodedRouteId.slice(0, sepIdx).toUpperCase()
  const decodedId = decodedRouteId.slice(sepIdx + 1)

  const type =
    rawType === "MOVIE" || rawType === "TV" || rawType === "GAME" || rawType === "BOOK" || rawType === "APP" || rawType === "MANGA"
      ? (rawType as MediaType)
      : null

  return { type, id: decodedId }
}

// Singular labels used in SEO metadata + machine-readable surfaces
// (sitemap, MD layer). The UI variant lives in src/lib/utils.ts as
// `mediaTypeLabels` and uses slightly longer strings ("Série TV", "Jeu Vidéo").
export const mediaTypeShortLabels: Record<MediaType, string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu vidéo",
  BOOK: "Livre",
  APP: "Application",
  MANGA: "Manga",
}

export const mediaTypeCategory: Record<MediaType, { path: string; label: string }> = {
  MOVIE: { path: "/films", label: "Films" },
  TV: { path: "/series", label: "Séries" },
  GAME: { path: "/jeux", label: "Jeux vidéo" },
  BOOK: { path: "/livres", label: "Livres" },
  APP: { path: "/apps", label: "Applications" },
  MANGA: { path: "/mangas", label: "Mangas" },
}

// Section heading used to introduce `whatParentsNeedToKnow` — varies by
// media type so games/apps/books don't get the awkward "regarder" wording.
export function whatParentsSectionLabel(type: MediaType): string {
  switch (type) {
    case "GAME":
    case "APP":
      return "À savoir avant de vous lancer"
    case "BOOK":
    case "MANGA":
      return "À savoir avant de lire"
    case "MOVIE":
    case "TV":
    default:
      return "À savoir avant de regarder"
  }
}

// Shared inclusion predicate for surfaces exposed to crawlers/agents
// (sitemap.xml + /md/media/[id]). Keeps the two in sync so we never
// expose a low-quality fiche to LLMs that the sitemap excludes.
export const PUBLIC_MEDIA_QUALITY_FLOOR = 30

// posterUrl values that are stored but are NOT a real poster. `not: null` alone
// let these through: the house placeholder is a string, so 101 fiches carrying
// it sat in sitemap.xml (and in the MCP/markdown surfaces) as thin pages with a
// grey "Affiche à venir" card — the worst thing to hand a crawler or an LLM.
// Single source of truth: collections.ts filters on the same list.
export const NON_POSTER_URLS = ["/placeholder-poster.jpg", ""] as const

export function isPublicMedia(media: {
  posterUrl?: string | null
  dataQualityScore?: number | null
  type: MediaType
}): boolean {
  if (!media.posterUrl) return false
  if ((NON_POSTER_URLS as readonly string[]).includes(media.posterUrl)) return false
  if ((media.dataQualityScore ?? 0) < PUBLIC_MEDIA_QUALITY_FLOOR) return false
  if (media.type === "MANGA") return false
  return true
}

// Equivalent as a Prisma `where` fragment, for the DB-query callsites.
export const publicMediaWhere = {
  posterUrl: { not: null, notIn: [...NON_POSTER_URLS] },
  dataQualityScore: { gte: PUBLIC_MEDIA_QUALITY_FLOOR },
  type: { not: "MANGA" as const },
}


