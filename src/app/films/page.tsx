import type { Metadata } from "next"
import { fetchMovies } from "@/lib/media-queries"
import { ClientFilmsPage } from "./ClientFilmsPage"

export const revalidate = 300 // 5-min ISR

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18

interface FilmsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function get(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key]
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined
}

export async function generateMetadata({ searchParams }: FilmsPageProps): Promise<Metadata> {
  const params = await searchParams
  const maxAge = get(params, "maxAge") ? parseInt(get(params, "maxAge")!) : undefined
  const sort = get(params, "sort")
  const page = get(params, "page") ? parseInt(get(params, "page")!) : 1
  const q = get(params, "q")
  const hasFilters = !!(get(params, "topics") || get(params, "platforms") || get(params, "minAge") || maxAge || q)

  let title = "Films — Avis et âges recommandés pour la famille"
  let description = "Les meilleurs films pour votre famille : analyses détaillées, violence, langage, messages positifs. Recommandations d'âge par des experts."

  if (sort === "cinema") {
    title = "En ce moment au cinéma — Films pour la famille"
    description = "Les films actuellement en salle adaptés à toute la famille."
  } else if (q) {
    title = `Recherche « ${q} » — Films pour la famille`
  } else if (maxAge && maxAge <= 7) {
    title = "Films pour les enfants — Avis et âges recommandés"
    description = `Films adaptés aux enfants de ${maxAge} ans et moins.`
  } else if (maxAge) {
    title = `Films pour les ${maxAge} ans et moins`
  }

  if (page > 1) {
    title += ` — Page ${page}`
  }

  // Canonical: base /films for filtered pages, /films?page=N only for unfiltered pagination
  let canonical = "/films"
  if (!hasFilters && page > 1) {
    canonical = `/films?page=${page}`
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

export default async function FilmsPage({ searchParams }: FilmsPageProps) {
  const params = await searchParams
  const sort = get(params, "sort")
  const isCinema = sort === "cinema"

  const page = Math.max(1, parseInt(get(params, "page") || "1") || 1)
  const minAge = get(params, "minAge") ? parseInt(get(params, "minAge")!) : DEFAULT_MIN_AGE
  const maxAge = get(params, "maxAge") ? Math.min(parseInt(get(params, "maxAge")!) || DEFAULT_MAX_AGE, 18) : DEFAULT_MAX_AGE
  const topics = get(params, "topics")?.split(",").filter(Boolean) || []
  const platforms = get(params, "platforms")?.split(",").filter(Boolean) || []
  const search = get(params, "q") || ""
  const sortBy = get(params, "sortBy") || "releaseDate"
  const parseMetric = (key: string): number | undefined => {
    const raw = get(params, key)
    if (!raw) return undefined
    const n = parseInt(raw)
    return Number.isFinite(n) ? n : undefined
  }
  const maxViolence = parseMetric("maxViolence")
  const maxSexual = parseMetric("maxSexual")
  const maxLanguage = parseMetric("maxLanguage")
  const maxSubstance = parseMetric("maxSubstance")
  const maxConsumerism = parseMetric("maxConsumerism")

  // Cinema mode: don't SSR data (TMDB API is external, client-only)
  let initialData = null
  if (!isCinema) {
    try {
      initialData = await fetchMovies({
        page,
        limit: 24,
        minAge: minAge > DEFAULT_MIN_AGE ? minAge : undefined,
        maxAge: maxAge < DEFAULT_MAX_AGE ? maxAge : undefined,
        topics: topics.length > 0 ? topics : undefined,
        platforms: platforms.length > 0 ? platforms : undefined,
        search: search || undefined,
        sortBy: sortBy !== "releaseDate" ? sortBy : undefined,
        requirePoster: true,
        language: "fr,en",
        maxViolence,
        maxSexual,
        maxLanguage,
        maxSubstance,
        maxConsumerism,
      })
    } catch (error) {
      console.error("Films SSR fetch failed:", error)
    }
  }

  // JSON-LD: BreadcrumbList + ItemList of currently visible items
  const baseUrl = "https://totemavise.com"
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Films", item: `${baseUrl}/films` },
    ],
  }

  const itemListLd = initialData?.items?.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Films pour la famille",
        numberOfItems: initialData.pagination.total,
        itemListElement: initialData.items.slice(0, 20).map((item, idx) => ({
          "@type": "ListItem",
          position: (page - 1) * 24 + idx + 1,
          url: `${baseUrl}/media/movie:${encodeURIComponent(item.id)}`,
          name: item.title,
        })),
      }
    : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}
      <ClientFilmsPage
        initialData={initialData}
        initialFilters={{ minAge, maxAge, topics, platforms, search, sortBy }}
        initialPage={page}
        isCinema={isCinema}
      />
    </>
  )
}
