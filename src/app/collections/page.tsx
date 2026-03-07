"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Sparkles,
  Loader2,
  Trophy,
  CalendarDays,
} from "lucide-react"

interface Collection {
  id: string
  title: string
  description: string
  emoji: string
  limit: number
  category: "top" | "seasonal"
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
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-violet-500" />
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
          <p className="text-gray-500">
            Les collections seront bientôt disponibles.
          </p>
        </div>
      </div>
    )
  }

  const topCollections = collections.filter((c) => c.category === "top")
  const seasonalCollections = collections.filter((c) => c.category === "seasonal")

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Collections</h1>
        <p className="text-gray-600 max-w-xl">
          Nos sélections « Top 10 & 15 » pour trouver rapidement le film ou le jeu parfait, par thème et par âge.
        </p>
      </div>

      {/* Top Lists */}
      {topCollections.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold text-gray-900">Nos classements</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topCollections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        </section>
      )}

      {/* Seasonal */}
      {seasonalCollections.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <CalendarDays className="h-5 w-5 text-violet-500" />
            <h2 className="text-xl font-bold text-gray-900">Saisons & occasions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {seasonalCollections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        </section>
      )}
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
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <span className="text-5xl">{collection.emoji}</span>
            </div>
          )}

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Title overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{collection.emoji}</span>
              <h3 className="font-bold text-white text-sm leading-tight group-hover:text-violet-200 transition-colors">
                {collection.title}
              </h3>
            </div>
            <p className="text-xs text-white/70">
              {collection.count} titre{collection.count > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="p-4 pt-3">
          <p className="text-xs text-gray-500 line-clamp-2">
            {collection.description}
          </p>
        </div>
      </div>
    </Link>
  )
}
