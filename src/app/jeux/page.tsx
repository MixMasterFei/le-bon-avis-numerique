import type { Metadata } from "next"
import { fetchGames } from "@/lib/media-queries"
import { ClientGamesPage } from "./ClientGamesPage"

export const revalidate = 300 // 5-min ISR

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18

interface GamesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function get(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key]
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined
}

export async function generateMetadata({ searchParams }: GamesPageProps): Promise<Metadata> {
  const params = await searchParams
  const maxAge = get(params, "maxAge") ? parseInt(get(params, "maxAge")!) : undefined
  const page = get(params, "page") ? parseInt(get(params, "page")!) : 1
  const q = get(params, "q")
  const hasFilters = !!(get(params, "topics") || get(params, "platforms") || get(params, "minAge") || maxAge || q)

  let title = "Jeux Vidéo — Avis PEGI et âges recommandés"
  let description = "Jeux vidéo adaptés à chaque âge : analyses PEGI, microtransactions, contenu en ligne et recommandations parentales."

  if (q) {
    title = `Recherche « ${q} » — Jeux vidéo pour la famille`
  } else if (maxAge && maxAge <= 7) {
    title = "Jeux vidéo pour les enfants — Avis PEGI et âges recommandés"
    description = `Jeux vidéo adaptés aux enfants de ${maxAge} ans et moins.`
  } else if (maxAge) {
    title = `Jeux vidéo pour les ${maxAge} ans et moins`
  }

  if (page > 1) {
    title += ` — Page ${page}`
  }

  let canonical = "/jeux"
  if (!hasFilters && page > 1) {
    canonical = `/jeux?page=${page}`
  }

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Totem Avisé`,
      description,
      images: [{ url: "/icon.png", width: 620, height: 606, alt: "Totem Avisé" }],
    },
  }
}

export default async function JeuxPage({ searchParams }: GamesPageProps) {
  const params = await searchParams

  const page = Math.max(1, parseInt(get(params, "page") || "1") || 1)
  const minAge = get(params, "minAge") ? parseInt(get(params, "minAge")!) : DEFAULT_MIN_AGE
  const maxAge = get(params, "maxAge") ? Math.min(parseInt(get(params, "maxAge")!) || DEFAULT_MAX_AGE, 18) : DEFAULT_MAX_AGE
  const topics = get(params, "topics")?.split(",").filter(Boolean) || []
  const platforms = get(params, "platforms")?.split(",").filter(Boolean) || []
  const search = get(params, "q") || ""
  const sortBy = get(params, "sortBy") || "popularity"

  let initialData = null
  try {
    initialData = await fetchGames({
      page,
      limit: 24,
      minAge: minAge > DEFAULT_MIN_AGE ? minAge : undefined,
      maxAge: maxAge < DEFAULT_MAX_AGE ? maxAge : undefined,
      topics: topics.length > 0 ? topics : undefined,
      platforms: platforms.length > 0 ? platforms : undefined,
      search: search || undefined,
      sortBy,
      requirePoster: true,
    })
  } catch (error) {
    console.error("Games SSR fetch failed:", error)
  }

  return (
    <ClientGamesPage
      initialData={initialData}
      initialFilters={{ minAge, maxAge, topics, platforms, search, sortBy }}
      initialPage={page}
    />
  )
}
