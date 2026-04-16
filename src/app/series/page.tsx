import type { Metadata } from "next"
import { fetchSeries } from "@/lib/media-queries"
import { ClientSeriesPage } from "./ClientSeriesPage"

export const revalidate = 300 // 5-min ISR

const DEFAULT_MIN_AGE = 2
const DEFAULT_MAX_AGE = 18

interface SeriesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function get(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key]
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined
}

export async function generateMetadata({ searchParams }: SeriesPageProps): Promise<Metadata> {
  const params = await searchParams
  const maxAge = get(params, "maxAge") ? parseInt(get(params, "maxAge")!) : undefined
  const page = get(params, "page") ? parseInt(get(params, "page")!) : 1
  const q = get(params, "q")
  const hasFilters = !!(get(params, "topics") || get(params, "platforms") || get(params, "minAge") || maxAge || q)

  let title = "Séries TV — Avis et âges recommandés pour la famille"
  let description = "Les meilleures séries TV pour votre famille : analyses de contenu, recommandations d'âge et avis de parents."

  if (q) {
    title = `Recherche « ${q} » — Séries TV pour la famille`
  } else if (maxAge && maxAge <= 7) {
    title = "Séries TV pour les enfants — Avis et âges recommandés"
    description = `Séries TV adaptées aux enfants de ${maxAge} ans et moins.`
  } else if (maxAge) {
    title = `Séries TV pour les ${maxAge} ans et moins`
  }

  if (page > 1) {
    title += ` — Page ${page}`
  }

  // Canonical: base /series for filtered pages, /series?page=N only for unfiltered pagination
  let canonical = "/series"
  if (!hasFilters && page > 1) {
    canonical = `/series?page=${page}`
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

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const params = await searchParams

  const page = Math.max(1, parseInt(get(params, "page") || "1") || 1)
  const minAge = get(params, "minAge") ? parseInt(get(params, "minAge")!) : DEFAULT_MIN_AGE
  const maxAge = get(params, "maxAge") ? Math.min(parseInt(get(params, "maxAge")!) || DEFAULT_MAX_AGE, 18) : DEFAULT_MAX_AGE
  const topics = get(params, "topics")?.split(",").filter(Boolean) || []
  const platforms = get(params, "platforms")?.split(",").filter(Boolean) || []
  const search = get(params, "q") || ""
  const sortBy = get(params, "sortBy") || "releaseDate"

  let initialData = null
  try {
    initialData = await fetchSeries({
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
    })
  } catch (error) {
    console.error("Series SSR fetch failed:", error)
  }

  const baseUrl = "https://totemavise.com"
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Séries", item: `${baseUrl}/series` },
    ],
  }

  const itemListLd = initialData?.items?.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Séries TV pour la famille",
        numberOfItems: initialData.pagination.total,
        itemListElement: initialData.items.slice(0, 20).map((item, idx) => ({
          "@type": "ListItem",
          position: (page - 1) * 24 + idx + 1,
          url: `${baseUrl}/media/tv:${encodeURIComponent(item.id)}`,
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
      <ClientSeriesPage
        initialData={initialData}
        initialFilters={{ minAge, maxAge, topics, platforms, search, sortBy }}
        initialPage={page}
      />
    </>
  )
}
