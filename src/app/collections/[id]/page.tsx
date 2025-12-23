"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { MediaCard } from "@/components/media/MediaCard"
import type { MockMediaItem } from "@/lib/mock-data"

interface CollectionData {
  collection: {
    id: string
    title: string
    description: string
  }
  items: Array<{
    id: string
    title: string
    originalTitle: string | null
    type: string
    posterUrl: string | null
    releaseDate: string | null
    expertAgeRec: number | null
    genres: string[]
    synopsisFr: string | null
    contentMetrics: {
      violence: number
      positiveMessages: number
    } | null
  }>
  total: number
}

export default function CollectionPage() {
  const params = useParams()
  const collectionId = params.id as string

  const [data, setData] = useState<CollectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCollection() {
      try {
        const res = await fetch(`/api/collections?id=${collectionId}&limit=50`)
        if (!res.ok) {
          throw new Error("Collection non trouvee")
        }
        const data = await res.json()
        setData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur")
      } finally {
        setLoading(false)
      }
    }

    if (collectionId) {
      fetchCollection()
    }
  }, [collectionId])

  if (loading) {
    return (
      <div className="container mx-auto py-16 text-center">
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-500" />
        <p className="mt-4 text-gray-500">Chargement de la collection...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Collection non trouvee</h1>
        <p className="text-gray-500 mb-8">{error}</p>
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-purple-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux collections
        </Link>
      </div>
    )
  }

  // Transform items to MockMediaItem format for MediaCard
  const mediaItems: MockMediaItem[] = data.items.map((item) => ({
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle || undefined,
    type: item.type as "MOVIE" | "TV" | "GAME" | "BOOK" | "APP",
    releaseDate: item.releaseDate,
    posterUrl: item.posterUrl || "",
    synopsisFr: item.synopsisFr,
    officialRating: null,
    expertAgeRec: item.expertAgeRec,
    communityAgeRec: null,
    genres: item.genres,
    platforms: [],
    topics: [],
    contentMetrics: item.contentMetrics ? {
      violence: item.contentMetrics.violence,
      sexNudity: 0,
      language: 0,
      consumerism: 0,
      substanceUse: 0,
      positiveMessages: item.contentMetrics.positiveMessages,
      roleModels: 0,
      whatParentsNeedToKnow: [],
    } : {
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
  }))

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Back link */}
      <Link
        href="/collections"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Toutes les collections
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {data.collection.title}
        </h1>
        <p className="text-gray-600">{data.collection.description}</p>
        <p className="text-sm text-gray-400 mt-2">
          {data.total} titre{data.total > 1 ? "s" : ""}
        </p>
      </div>

      {/* Items Grid */}
      {mediaItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {mediaItems.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">Aucun contenu dans cette collection pour le moment.</p>
          <p className="text-sm mt-2">
            Les contenus apparaitront apres l&apos;enrichissement IA.
          </p>
        </div>
      )}
    </div>
  )
}
