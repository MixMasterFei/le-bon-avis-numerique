"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, Film, ArrowRight } from "lucide-react"
import { toMediaRouteId } from "@/lib/media-route"

interface CollectionData {
  collection: {
    id: string
    title: string
    description: string
    intro: string
    emoji: string
    limit: number
    category: string
    lastUpdated?: string
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
        const res = await fetch(`/api/collections?id=${collectionId}`)
        if (!res.ok) {
          throw new Error("Collection non trouvée")
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
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-violet-500" />
        <p className="mt-4 text-gray-500">Chargement de la collection...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Collection non trouvée</h1>
        <p className="text-gray-500 mb-8">{error}</p>
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-violet-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux collections
        </Link>
      </div>
    )
  }

  const { collection, items } = data

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Back link */}
      <Link
        href="/collections"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Toutes les collections
      </Link>

      {/* Editorial Header */}
      <header className="mb-10">
        <span className="text-4xl mb-4 block">{collection.emoji}</span>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-3">
          {collection.title}
        </h1>
        <p className="text-lg text-gray-600 mb-4">
          {collection.description}
        </p>
        {collection.intro && (
          <p className="text-gray-500 leading-relaxed">
            {collection.intro}
          </p>
        )}
        <div className="mt-6 flex items-center gap-3 text-sm text-gray-400">
          <span>{data.total} titre{data.total > 1 ? "s" : ""} sélectionnés</span>
          <span>·</span>
          <span>
            {collection.lastUpdated
              ? `Mis à jour en ${new Date(collection.lastUpdated + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
              : "Mis à jour régulièrement"}
          </span>
        </div>
        <hr className="mt-6 border-gray-200" />
      </header>

      {/* Editorial List */}
      {items.length > 0 ? (
        <div className="space-y-10">
          {items.map((item, index) => {
            const mediaUrl = `/media/${toMediaRouteId(item.type as "MOVIE" | "TV" | "GAME", item.id)}`
            const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null

            return (
              <article key={item.id} className="group">
                {/* Rank number */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-black text-violet-200">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>

                {/* Content */}
                <Link href={mediaUrl} className="block">
                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Poster */}
                    <div className="relative w-full sm:w-48 aspect-[2/3] sm:aspect-auto sm:h-72 rounded-xl overflow-hidden shrink-0 bg-gray-100 shadow-md group-hover:shadow-xl transition-shadow duration-300">
                      {item.posterUrl ? (
                        <Image
                          src={item.posterUrl}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, 192px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-12 w-12 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-1">
                      <h2 className="text-xl font-bold text-gray-900 group-hover:text-violet-700 transition-colors leading-snug mb-2">
                        {item.title}
                      </h2>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                        {item.expertAgeRec !== null && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-xs">
                            Dès {item.expertAgeRec} ans
                          </span>
                        )}
                        {year && (
                          <span className="text-gray-400">{year}</span>
                        )}
                        {item.type === "GAME" && (
                          <span className="text-gray-400">Jeu vidéo</span>
                        )}
                      </div>

                      {/* Genres */}
                      {item.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {item.genres.slice(0, 4).map((genre) => (
                            <span key={genre} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Synopsis */}
                      {item.synopsisFr && (
                        <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-4">
                          {item.synopsisFr}
                        </p>
                      )}

                      {/* CTA */}
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 group-hover:text-violet-800 transition-colors">
                        Voir la fiche complète
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">Aucun contenu dans cette collection pour le moment.</p>
          <p className="text-sm mt-2">Revenez bientôt !</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200 text-center">
        <p className="text-sm text-gray-400 mb-4">
          Cette sélection est éditée et vérifiée par notre équipe.
        </p>
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voir toutes les collections
        </Link>
      </div>
    </div>
  )
}
