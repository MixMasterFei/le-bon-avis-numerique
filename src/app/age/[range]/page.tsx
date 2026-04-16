import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Users } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaItem } from "@/lib/types"
import type { Prisma } from "@prisma/client"

export const revalidate = 1800 // 30-min ISR

const ITEMS_PER_PAGE = 24

const ageRanges: Record<string, { min: number; max: number; label: string; description: string }> = {
  "2-4": {
    min: 2,
    max: 4,
    label: "2-4 ans",
    description: "Contenu adapté aux tout-petits avec des histoires simples et colorées.",
  },
  "5-7": {
    min: 5,
    max: 7,
    label: "5-7 ans",
    description: "Aventures pour les jeunes enfants avec des thèmes d'amitié et de découverte.",
  },
  "8-10": {
    min: 8,
    max: 10,
    label: "8-10 ans",
    description: "Histoires plus complexes avec des héros attachants et des défis à surmonter.",
  },
  "11-12": {
    min: 11,
    max: 12,
    label: "11-12 ans",
    description: "Contenu pour les pré-adolescents avec des thèmes plus matures et nuancés.",
  },
  "13-15": {
    min: 13,
    max: 15,
    label: "13-15 ans",
    description: "Contenu pour adolescents abordant des sujets complexes adaptés à leur âge.",
  },
  "16-plus": {
    min: 16,
    max: 18,
    label: "16+ ans",
    description: "Contenu pour grands adolescents et jeunes adultes.",
  },
}

interface AgePageProps {
  params: Promise<{ range: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function fetchAgeRangeMedia(min: number, max: number, page: number) {
  const skip = (page - 1) * ITEMS_PER_PAGE

  const where: Prisma.MediaItemWhereInput = {
    expertAgeRec: { gte: min, lte: max },
    posterUrl: { not: null, startsWith: "http" },
    isEnriched: true,
    AND: [{ tmdbVoteCount: { gte: 50 } }],
  }

  const [rawItems, total] = await Promise.all([
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where,
        orderBy: [{ expertAgeRec: "asc" }, { tmdbRating: { sort: "desc", nulls: "last" } }],
        skip,
        take: ITEMS_PER_PAGE,
        include: {
          contentMetrics: true,
          reviews: { select: { rating: true } },
        },
      })
    ),
    withPrismaRetry(() => prisma.mediaItem.count({ where })).catch(() => skip + ITEMS_PER_PAGE),
  ])

  const items: MediaItem[] = rawItems.map((item) => ({
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle || undefined,
    type: item.type as MediaItem["type"],
    releaseDate: item.releaseDate?.toISOString().split("T")[0] || null,
    posterUrl: item.posterUrl || "",
    synopsisFr: item.synopsisFr,
    officialRating: item.officialRating,
    expertAgeRec: item.expertAgeRec,
    communityAgeRec: item.communityAgeRec,
    genres: item.genres || [],
    platforms: item.platforms || [],
    topics: item.topics || [],
    contentMetrics: item.contentMetrics
      ? {
          violence: item.contentMetrics.violence,
          sexNudity: item.contentMetrics.sexNudity,
          language: item.contentMetrics.language,
          consumerism: item.contentMetrics.consumerism,
          substanceUse: item.contentMetrics.substanceUse,
          positiveMessages: item.contentMetrics.positiveMessages,
          roleModels: item.contentMetrics.roleModels,
          whatParentsNeedToKnow: item.contentMetrics.whatParentsNeedToKnow || [],
        }
      : {
          violence: 0,
          sexNudity: 0,
          language: 0,
          consumerism: 0,
          substanceUse: 0,
          positiveMessages: 0,
          roleModels: 0,
          whatParentsNeedToKnow: [],
        },
    reviews: [],
    reviewCount: item.reviews.length,
    reviewAvgRating:
      item.reviews.length > 0
        ? item.reviews.reduce((acc, r) => acc + r.rating, 0) / item.reviews.length
        : null,
    tmdbRating: item.tmdbRating,
    tmdbVoteCount: item.tmdbVoteCount,
  }))

  return { items, total, totalPages: Math.ceil(total / ITEMS_PER_PAGE) }
}

export default async function AgePage({ params, searchParams }: AgePageProps) {
  const { range } = await params
  const sp = await searchParams
  const ageRange = ageRanges[range]

  if (!ageRange) {
    notFound()
  }

  const pageParam = typeof sp.page === "string" ? sp.page : Array.isArray(sp.page) ? sp.page[0] : "1"
  const currentPage = Math.max(1, parseInt(pageParam || "1") || 1)

  const { items, total, totalPages } = await fetchAgeRangeMedia(
    ageRange.min,
    ageRange.max,
    currentPage
  )

  const baseUrl = "https://totemavise.com"

  // BreadcrumbList JSON-LD
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      { "@type": "ListItem", position: 2, name: `Contenus ${ageRange.label}`, item: `${baseUrl}/age/${range}` },
    ],
  }

  // ItemList JSON-LD
  const itemListLd =
    items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Contenus pour les ${ageRange.label}`,
          description: ageRange.description,
          numberOfItems: total,
          itemListElement: items.slice(0, 20).map((item, idx) => ({
            "@type": "ListItem",
            position: (currentPage - 1) * ITEMS_PER_PAGE + idx + 1,
            url: `${baseUrl}/media/${toMediaRouteId(item.type, item.id)}`,
            name: item.title,
          })),
        }
      : null

  return (
    <div className="container mx-auto px-4 py-8">
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

      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 bg-primary/10 rounded-2xl">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Contenu pour les {ageRange.label}
            </h1>
            <p className="text-gray-600 mt-1">{ageRange.description}</p>
          </div>
        </div>

        {/* Age Navigation */}
        <div className="flex flex-wrap gap-2 mt-6">
          {Object.entries(ageRanges).map(([key, value]) => (
            <Button
              key={key}
              variant={key === range ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link href={`/age/${key}`}>{value.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-600">
          {total} résultat{total !== 1 ? "s" : ""} pour cette tranche d&apos;âge
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-gray-500">
            Page {currentPage} sur {totalPages}
          </p>
        )}
      </div>

      {/* Content */}
      {items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {items.map((item) => (
              <MediaCard key={item.id} media={item} />
            ))}
          </div>

          {/* Server-rendered pagination (URL-based) */}
          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              {currentPage > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/age/${range}${currentPage - 1 > 1 ? `?page=${currentPage - 1}` : ""}`}
                    rel="prev"
                  >
                    Précédent
                  </Link>
                </Button>
              )}
              <span className="px-3 text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              {currentPage < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/age/${range}?page=${currentPage + 1}`} rel="next">
                    Suivant
                  </Link>
                </Button>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Aucun contenu disponible
          </h2>
          <p className="text-gray-500">
            Nous n&apos;avons pas encore de contenu pour cette tranche d&apos;âge.
          </p>
        </div>
      )}

    </div>
  )
}
