"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Star,
  Gift,
  Ghost,
  Sun,
  Heart,
  Wand2,
  Sparkles,
  Film,
  Tv,
  Gamepad2,
  Users,
  GraduationCap,
  Loader2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface Collection {
  id: string
  title: string
  description: string
  count: number
}

// Map collection IDs to icons
const collectionIcons: Record<string, React.ElementType> = {
  "best-movies-2024": Star,
  "best-movies-2025": Star,
  "family-movies": Users,
  "teen-comedy": Heart,
  "christmas-movies": Gift,
  "halloween-movies": Ghost,
  "summer-movies": Sun,
  "disney-classics": Wand2,
  "pixar": Sparkles,
  "studio-ghibli": Wand2,
  "superhero": Sparkles,
  "educational": GraduationCap,
  "animation-kids": Film,
  "adventure": Sparkles,
  "fantasy": Wand2,
  "family-games": Gamepad2,
  "teen-games": Gamepad2,
  "kids-series": Tv,
}

// Map collection IDs to colors
const collectionColors: Record<string, string> = {
  "best-movies-2024": "from-yellow-500 to-orange-500",
  "best-movies-2025": "from-yellow-500 to-orange-500",
  "family-movies": "from-blue-500 to-cyan-500",
  "teen-comedy": "from-pink-500 to-rose-500",
  "christmas-movies": "from-red-500 to-green-500",
  "halloween-movies": "from-orange-500 to-purple-500",
  "summer-movies": "from-yellow-400 to-orange-400",
  "disney-classics": "from-blue-400 to-purple-500",
  "pixar": "from-green-400 to-blue-500",
  "studio-ghibli": "from-green-500 to-teal-500",
  "superhero": "from-red-500 to-blue-500",
  "educational": "from-emerald-500 to-teal-500",
  "animation-kids": "from-purple-400 to-pink-400",
  "adventure": "from-amber-500 to-orange-500",
  "fantasy": "from-violet-500 to-purple-500",
  "family-games": "from-green-500 to-emerald-500",
  "teen-games": "from-blue-600 to-indigo-600",
  "kids-series": "from-cyan-500 to-blue-500",
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
            Les collections seront disponibles une fois que les contenus auront ete enrichis par l&apos;IA.
          </p>
          <Link
            href="/admin/enrich"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Sparkles className="h-5 w-5" />
            Lancer l&apos;enrichissement
          </Link>
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
          {items.map((collection) => {
            const CollectionIcon = collectionIcons[collection.id] || Sparkles
            const gradient = collectionColors[collection.id] || "from-gray-500 to-gray-600"

            return (
              <Link key={collection.id} href={`/collections/${collection.id}`}>
                <Card className="group hover:shadow-lg transition-all cursor-pointer overflow-hidden">
                  <div className={`h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <CollectionIcon className="h-12 w-12 text-white/90 group-hover:scale-110 transition-transform" />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                      {collection.title}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                      {collection.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {collection.count} titre{collection.count > 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Collections</h1>
        <p className="text-gray-600">
          Decouvrez nos selections thematiques pour trouver le contenu parfait pour chaque occasion.
        </p>
      </div>

      {renderCollectionGroup("Films", movieCollections, Film)}
      {renderCollectionGroup("Saisons & Fetes", seasonalCollections, Gift)}
      {renderCollectionGroup("Jeux video", gameCollections, Gamepad2)}
      {renderCollectionGroup("Series TV", tvCollections, Tv)}
    </div>
  )
}
