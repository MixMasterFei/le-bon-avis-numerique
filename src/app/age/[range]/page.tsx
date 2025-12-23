"use client"

import { useEffect, useState, use } from "react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Users, Database, Loader2 } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import { Pagination } from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import { mockMediaItems, type MockMediaItem } from "@/lib/mock-data"

const ITEMS_PER_PAGE = 20

const ageRanges: Record<string, { min: number; max: number; label: string; description: string }> = {
  "2-4": {
    min: 2,
    max: 4,
    label: "2-4 ans",
    description: "Contenu adapte aux tout-petits avec des histoires simples et colorees.",
  },
  "5-7": {
    min: 5,
    max: 7,
    label: "5-7 ans",
    description: "Aventures pour les jeunes enfants avec des themes d'amitie et de decouverte.",
  },
  "8-9": {
    min: 8,
    max: 9,
    label: "8-9 ans",
    description: "Histoires plus complexes avec des heros attachants et des defis a surmonter.",
  },
  "10-12": {
    min: 10,
    max: 12,
    label: "10-12 ans",
    description: "Contenu pour les pre-adolescents avec des themes plus matures et nuances.",
  },
  "13-plus": {
    min: 13,
    max: 18,
    label: "13+ ans",
    description: "Contenu pour adolescents abordant des sujets complexes adaptes a leur age.",
  },
}

interface AgePageProps {
  params: Promise<{ range: string }>
}

export default function AgePage({ params }: AgePageProps) {
  const { range } = use(params)
  const ageRange = ageRanges[range]

  const [currentPage, setCurrentPage] = useState(1)
  const [source, setSource] = useState<"db" | "mock">("mock")
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
            }))

            if (!cancelled) {
              setSource("db")
              setDbItems(mapped)
              setDbTotalPages(dbData.pagination?.totalPages || 1)
              setDbTotalResults(dbData.pagination?.total || mapped.length)
            }
            return
          }
        }

        // Fallback to mock data
        if (!cancelled) {
          setSource("mock")
        }
      } catch {
        if (!cancelled) {
          setSource("mock")
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

  // Mock data fallback
  const mockItems = mockMediaItems.filter(
    (item) =>
      item.expertAgeRec !== null && item.expertAgeRec >= ageRange.min && item.expertAgeRec <= ageRange.max
  )

  const displayItems = source === "db" ? dbItems : mockItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const totalPages = source === "db" ? dbTotalPages : Math.ceil(mockItems.length / ITEMS_PER_PAGE)
  const totalCount = source === "db" ? (dbTotalResults ?? dbItems.length) : mockItems.length

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour a l&apos;accueil
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
          {source === "db" && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              <Database className="h-3 w-3" /> Base locale
            </span>
          )}
          <p className="text-gray-600">
            {totalCount} resultat{totalCount !== 1 ? "s" : ""} pour cette tranche d&apos;age
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
          <p className="text-sm">Recuperation du catalogue</p>
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
            Nous n&apos;avons pas encore de contenu pour cette tranche d&apos;age.
          </p>
        </div>
      )}
    </div>
  )
}
