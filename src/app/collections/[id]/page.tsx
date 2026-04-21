"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, Film, ArrowRight } from "lucide-react"
import { toMediaRouteId } from "@/lib/media-route"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

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
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
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
      <div
        className="container mx-auto py-16 text-center"
        style={{ background: p.bg }}
      >
        <Loader2
          className="h-10 w-10 mx-auto animate-spin"
          style={{ color: p.accent }}
        />
        <p className="mt-4 text-sm" style={{ color: p.ink2 }}>
          Chargement de la collection...
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        className="flex-1 py-16 px-4 text-center"
        style={{ background: p.bg, color: p.ink }}
      >
        <h1
          className={`${serifClass} text-2xl font-medium mb-4`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Collection non trouvée
        </h1>
        <p className="mb-8 text-sm" style={{ color: p.ink2 }}>
          {error}
        </p>
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-sm hover:opacity-70"
          style={{ color: p.accent }}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux collections
        </Link>
      </div>
    )
  }

  const { collection, items } = data

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="max-w-3xl mx-auto py-8 px-4 w-full">
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 text-sm hover:opacity-70 mb-8"
          style={{ color: p.ink2 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Toutes les collections
        </Link>

        <header className="mb-10">
          <span className="text-4xl mb-4 block">{collection.emoji}</span>
          <h1
            className={`${serifClass} text-3xl md:text-5xl font-medium leading-[1.05] mb-3`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {collection.title}
          </h1>
          <p className="text-base md:text-lg mb-3" style={{ color: p.ink }}>
            {collection.description}
          </p>
          {collection.intro && (
            <p className="leading-relaxed text-sm md:text-base" style={{ color: p.ink2 }}>
              {collection.intro}
            </p>
          )}
          <div
            className="mt-6 flex items-center gap-3 text-xs"
            style={{ color: p.ink2 }}
          >
            <span>
              {data.total} titre{data.total > 1 ? "s" : ""} sélectionnés
            </span>
            <span>·</span>
            <span>
              {collection.lastUpdated
                ? `Mis à jour en ${new Date(collection.lastUpdated + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
                : "Mis à jour régulièrement"}
            </span>
          </div>
          <hr
            className="mt-6"
            style={{ borderColor: p.line }}
          />
        </header>

        {items.length > 0 ? (
          <div className="space-y-10">
            {items.map((item, index) => {
              const mediaUrl = `/media/${toMediaRouteId(item.type as "MOVIE" | "TV" | "GAME", item.id)}`
              const year = item.releaseDate
                ? new Date(item.releaseDate).getFullYear()
                : null

              return (
                <article key={item.id} className="group">
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`${serifClass} text-3xl font-medium`}
                      style={{
                        color: p.accent,
                        opacity: 0.4,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="h-px flex-1" style={{ background: p.line }} />
                  </div>

                  <Link href={mediaUrl} className="block">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                      <div
                        className="relative w-full sm:w-48 aspect-[2/3] sm:aspect-auto sm:h-72 rounded-xl overflow-hidden shrink-0"
                        style={{
                          background: p.placeholder,
                          boxShadow: `0 4px 12px ${p.line}`,
                        }}
                      >
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
                            <Film className="h-12 w-12" style={{ color: p.ink2, opacity: 0.4 }} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 py-1">
                        <h2
                          className={`${serifClass} text-xl md:text-2xl font-medium leading-snug mb-2 group-hover:opacity-70 transition-opacity`}
                          style={{ color: p.ink, letterSpacing: "-0.02em" }}
                        >
                          {item.title}
                        </h2>

                        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                          {item.expertAgeRec !== null && (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold text-xs"
                              style={{ background: p.bg2, color: p.accent2 }}
                            >
                              Dès {item.expertAgeRec} ans
                            </span>
                          )}
                          {year && (
                            <span style={{ color: p.ink2 }}>{year}</span>
                          )}
                          {item.type === "GAME" && (
                            <span style={{ color: p.ink2 }}>Jeu vidéo</span>
                          )}
                        </div>

                        {item.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {item.genres.slice(0, 4).map((genre) => (
                              <span
                                key={genre}
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: p.bg2, color: p.ink2 }}
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.synopsisFr && (
                          <p
                            className="text-sm leading-relaxed line-clamp-3 mb-4"
                            style={{ color: p.ink2 }}
                          >
                            {item.synopsisFr}
                          </p>
                        )}

                        <span
                          className="inline-flex items-center gap-1.5 text-sm font-semibold group-hover:opacity-70 transition-opacity"
                          style={{ color: p.accent }}
                        >
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
          <div
            className="text-center py-16 rounded-2xl"
            style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink2 }}
          >
            <p className="text-lg">
              Aucun contenu dans cette collection pour le moment.
            </p>
            <p className="text-sm mt-2">Revenez bientôt !</p>
          </div>
        )}

        <div
          className="mt-12 pt-8 text-center border-t"
          style={{ borderColor: p.line }}
        >
          <p className="text-sm mb-4" style={{ color: p.ink2 }}>
            Cette sélection est éditée et vérifiée par notre équipe.
          </p>
          <Link
            href="/collections"
            className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-70"
            style={{ color: p.accent }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voir toutes les collections
          </Link>
        </div>
      </div>
    </div>
  )
}
