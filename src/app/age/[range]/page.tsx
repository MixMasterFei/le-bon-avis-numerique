/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, use } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users, Loader2 } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { Pagination } from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import type { MediaItem as MockMediaItem } from "@/lib/types"

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
}

export default function AgePage({ params }: AgePageProps) {
  const { range } = use(params)
  const ageRange = ageRanges[range]

  const [currentPage, setCurrentPage] = useState(1)
  const [dbItems, setDbItems] = useState<MockMediaItem[]>([])
  const [dbTotalPages, setDbTotalPages] = useState(1)
  const [dbTotalResults, setDbTotalResults] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch from database
  useEffect(() => {
    if (!ageRange) return

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      try {
        const dbParams = new URLSearchParams({
          page: currentPage.toString(),
          limit: ITEMS_PER_PAGE.toString(),
          minAge: ageRange.min.toString(),
          maxAge: ageRange.max.toString(),
          sort: "popularity",
          minVotes: "50",
        })

        const dbRes = await fetch(`/api/db/media?${dbParams}`, { signal: controller.signal })
        if (dbRes.ok) {
          const dbData = await dbRes.json()
          if (dbData.items && dbData.items.length > 0) {
            const mapped: MockMediaItem[] = dbData.items.map((item: any) => ({
              id: String(item.id),
              title: String(item.title || ""),
              originalTitle: item.originalTitle ? String(item.originalTitle) : undefined,
              type: item.type,
              releaseDate: item.releaseDate ?? null,
              posterUrl: String(item.posterUrl || ""),
              synopsisFr: item.synopsisFr ?? null,
              officialRating: item.officialRating ?? null,
              expertAgeRec: item.expertAgeRec ?? null,
              communityAgeRec: item.communityAgeRec ?? null,
              genres: item.genres || [],
              platforms: item.platforms || [],
              topics: item.topics || [],
              contentMetrics: item.contentMetrics || null,
              reviews: [],
              reviewCount: item.reviewCount || 0,
              reviewAvgRating: item.reviewAvgRating ?? null,
              tmdbRating: item.tmdbRating ?? null,
              tmdbVoteCount: item.tmdbVoteCount ?? null,
            }))

            if (!cancelled) {
              setDbItems(mapped)
              setDbTotalPages(dbData.pagination?.totalPages || 1)
              setDbTotalResults(dbData.pagination?.total || mapped.length)
            }
            return
          }
        }

        // No results from DB
        if (!cancelled) {
          setDbItems([])
          setDbTotalPages(1)
          setDbTotalResults(0)
        }
      } catch {
        if (!cancelled) {
          setDbItems([])
          setDbTotalPages(1)
          setDbTotalResults(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [currentPage, ageRange])

  if (!ageRange) {
    notFound()
  }

  const displayItems = dbItems
  const totalPages = dbTotalPages
  const totalCount = dbTotalResults ?? dbItems.length

  return (
    <div className="container mx-auto px-4 py-8">
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
        <div className="flex items-center gap-2">
          <p className="text-gray-600">
            {totalCount} résultat{totalCount !== 1 ? "s" : ""} pour cette tranche d&apos;âge
          </p>
        </div>
        {totalPages > 1 && (
          <p className="text-sm text-gray-500">
            Page {currentPage} sur {totalPages}
          </p>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-500">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
          <p className="text-lg font-medium">Chargement...</p>
          <p className="text-sm">Récupération du catalogue</p>
        </div>
      ) : displayItems.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {displayItems.map((item) => (
              <MediaCard key={item.id} media={item} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              className="mt-8"
            />
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
