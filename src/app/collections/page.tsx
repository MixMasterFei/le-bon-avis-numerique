"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Sparkles, Loader2, Trophy, CalendarDays } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

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
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
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
      <div
        className="container mx-auto py-16 text-center"
        style={{ background: p.bg }}
      >
        <Loader2
          className="h-10 w-10 mx-auto animate-spin"
          style={{ color: p.accent }}
        />
        <p className="mt-4 text-sm" style={{ color: p.ink2 }}>
          Chargement des collections...
        </p>
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <div
        className="flex-1 py-16 px-4"
        style={{ background: p.bg, color: p.ink }}
      >
        <div className="container mx-auto text-center max-w-lg">
          <Sparkles
            className="h-12 w-12 mx-auto mb-4"
            style={{ color: p.ink2, opacity: 0.4 }}
          />
          <h1
            className={`${serifClass} text-3xl font-medium mb-2`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            Collections
          </h1>
          <p style={{ color: p.ink2 }}>
            Les collections seront bientôt disponibles.
          </p>
        </div>
      </div>
    )
  }

  const topCollections = collections.filter((c) => c.category === "top")
  const seasonalCollections = collections.filter((c) => c.category === "seasonal")

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      <section
        className="py-10 md:py-14"
        style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
      >
        <div className="container mx-auto px-4 md:px-8">
          <div
            className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Découvrir
          </div>
          <h1
            className={`${serifClass} text-3xl md:text-5xl font-medium m-0 leading-[1.05]`}
            style={{ letterSpacing: "-0.02em", color: p.ink }}
          >
            Nos{" "}
            <em className="italic" style={{ color: p.accent }}>
              collections
            </em>
          </h1>
          <p
            className="mt-3 text-sm md:text-base max-w-2xl"
            style={{ color: p.ink2 }}
          >
            Des sélections par thème et par âge pour trouver rapidement le film
            ou le jeu parfait.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 md:px-8">
          {topCollections.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-5">
                <Trophy
                  className="h-5 w-5"
                  style={{ color: p.accent }}
                />
                <h2
                  className={`${serifClass} text-xl md:text-2xl font-medium`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Nos classements
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {topCollections.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            </section>
          )}

          {seasonalCollections.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <CalendarDays
                  className="h-5 w-5"
                  style={{ color: p.accent2 }}
                />
                <h2
                  className={`${serifClass} text-xl md:text-2xl font-medium`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Saisons & occasions
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {seasonalCollections.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  )
}

function CollectionCard({ collection }: { collection: Collection }) {
  const p = APERCU_PALETTE
  const posters = collection.previewPosters || []
  const hasPosters = posters.length >= 4

  return (
    <Link href={`/collections/${collection.id}`}>
      <div
        className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          boxShadow: `0 2px 8px ${p.line}`,
        }}
      >
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
            <div
              className="h-full w-full flex items-center justify-center"
              style={{ background: p.bg2 }}
            >
              <span className="text-5xl">{collection.emoji}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{collection.emoji}</span>
              <h3 className="font-semibold text-white text-sm leading-tight">
                {collection.title}
              </h3>
            </div>
            <p className="text-xs text-white/70">
              {collection.count} titre{collection.count > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="p-4 pt-3">
          <p
            className="text-xs line-clamp-2"
            style={{ color: p.ink2 }}
          >
            {collection.description}
          </p>
        </div>
      </div>
    </Link>
  )
}
