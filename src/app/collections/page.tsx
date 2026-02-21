"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  Gift,
  Loader2,
} from "lucide-react"

interface Collection {
  id: string
  title: string
  description: string
  count: number
  previewPosters?: string[]
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCollections() {
      try {
        const res = await fetch("/api/collections")
        if (res.ok) {
          const data = await res.json()
          setCollections(data.collections || [])
        }
      } catch (err) {
        console.error("Failed to fetch collections:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchCollections()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-16 text-center">
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-purple-500" />
        <p className="mt-4 text-gray-500">Chargement des collections...</p>
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="text-center">
          <Sparkles className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Collections</h1>
          <p className="text-gray-500 mb-8">
            Les collections seront disponibles une fois que les contenus auront été enrichis par l&apos;IA.
          </p>
          <p className="text-sm text-gray-400">
            Revenez bientôt pour découvrir nos sélections thématiques.
          </p>
        </div>
      </div>
    )
  }

  // Group collections by category
  const movieCollections = collections.filter((c) =>
    ["best-movies-2024", "best-movies-2025", "family-movies", "teen-comedy", "animation-kids", "disney-classics", "pixar", "studio-ghibli", "superhero", "adventure", "fantasy", "educational"].includes(c.id)
  )
  const seasonalCollections = collections.filter((c) =>
    ["christmas-movies", "halloween-movies", "summer-movies"].includes(c.id)
  )
  const gameCollections = collections.filter((c) =>
    c.id.includes("game")
  )
  const tvCollections = collections.filter((c) =>
    c.id.includes("series")
  )

  const renderCollectionGroup = (title: string, items: Collection[], icon: React.ElementType) => {
    if (items.length === 0) return null
    const Icon = icon

    return (
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Icon className="h-6 w-6 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Collections</h1>
        <p className="text-gray-600">
          Découvrez nos sélections thématiques pour trouver le contenu parfait pour chaque occasion.
        </p>
      </div>

      {renderCollectionGroup("Films", movieCollections, Film)}
      {renderCollectionGroup("Saisons & Fêtes", seasonalCollections, Gift)}
      {renderCollectionGroup("Jeux vidéo", gameCollections, Gamepad2)}
      {renderCollectionGroup("Séries TV", tvCollections, Tv)}
    </div>
  )
}

function CollectionCard({ collection }: { collection: Collection }) {
  const posters = collection.previewPosters || []
  const hasPosters = posters.length >= 4

  return (
    <Link href={`/collections/${collection.id}`}>
      <div className="group rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white">
        {/* Poster collage or fallback */}
        <div className="relative aspect-[16/9] overflow-hidden">
          {hasPosters ? (
            <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
              {posters.slice(0, 4).map((url, i) => (
                <div key={i} className="relative overflow-hidden">
                  <Image
                    src={url}
                    alt=""
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-white/80" />
            </div>
          )}

          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-bold text-white text-sm leading-tight group-hover:text-violet-200 transition-colors">
              {collection.title}
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              {collection.count} titre{collection.count > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="p-3 pt-2">
          <p className="text-xs text-gray-500 line-clamp-2">
            {collection.description}
          </p>
        </div>
      </div>
    </Link>
  )
}
