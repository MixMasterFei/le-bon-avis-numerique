"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Loader2, Film, Tv, Gamepad2 } from "lucide-react"
import {
  ApercuMediaCard,
  type ApercuCardMedia,
} from "@/components/home-v2/ApercuMediaCard"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"

type MediaType = "all" | "movie" | "tv" | "game" | "book"

interface DbMediaItem {
  id: string
  title: string
  originalTitle?: string | null
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics?: {
    violence: number
    sexNudity: number
    language: number
    substanceUse: number
  } | null
}

type CardItem = ApercuCardMedia

function RechercheContent() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<MediaType>("all")
  const [results, setResults] = useState<CardItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      const res = await fetch(
        `/api/db/media?q=${encodeURIComponent(searchQuery)}&limit=50`
      )
      if (res.ok) {
        const data = await res.json()
        const items: DbMediaItem[] = data.items || []
        const mapped: CardItem[] = items
          .filter(
            (it): it is DbMediaItem & { type: "MOVIE" | "TV" | "GAME" } =>
              it.type === "MOVIE" || it.type === "TV" || it.type === "GAME"
          )
          .map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            posterUrl: item.posterUrl,
            expertAgeRec: item.expertAgeRec,
            genres: item.genres || [],
            contentMetrics: item.contentMetrics
              ? {
                  violence: item.contentMetrics.violence ?? null,
                  sexNudity: item.contentMetrics.sexNudity ?? null,
                  language: item.contentMetrics.language ?? null,
                  substanceUse: item.contentMetrics.substanceUse ?? null,
                }
              : null,
          }))
        setResults(mapped)
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery)
    }
  }, [initialQuery, performSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(query)}`)
      performSearch(query)
    }
  }

  const filteredResults =
    activeTab === "all"
      ? results
      : results.filter((r) => r.type === activeTab.toUpperCase())

  const counts = {
    all: results.length,
    movie: results.filter((r) => r.type === "MOVIE").length,
    tv: results.filter((r) => r.type === "TV").length,
    game: results.filter((r) => r.type === "GAME").length,
    book: 0,
  }

  const TABS: Array<{
    key: MediaType
    label: string
    icon?: React.ComponentType<{ className?: string }>
    count: number
  }> = [
    { key: "all", label: "Tout", count: counts.all },
    { key: "movie", label: "Films", icon: Film, count: counts.movie },
    { key: "tv", label: "Séries", icon: Tv, count: counts.tv },
    { key: "game", label: "Jeux", icon: Gamepad2, count: counts.game },
  ]

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col flex-1"
        style={{ background: p.bg, color: p.ink }}
      >
        <section
          className="py-8 md:py-12"
          style={{ background: p.bg, borderBottom: `1px solid ${p.line}` }}
        >
          <div className="container mx-auto px-4 md:px-8">
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Catalogue
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl font-medium m-0 leading-[1.05] mb-6`}
              style={{ letterSpacing: "-0.02em", color: p.ink }}
            >
              Recherche{initialQuery && " "}
              {initialQuery && (
                <em className="italic" style={{ color: p.accent }}>
                  « {initialQuery} »
                </em>
              )}
            </h1>

            <form
              onSubmit={handleSearch}
              className="flex gap-3 max-w-2xl"
            >
              <div className="relative flex-1">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5"
                  style={{ color: p.ink2 }}
                />
                <input
                  type="search"
                  placeholder="Rechercher un film, une série, un jeu..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-12 pr-4 py-3 w-full rounded-full text-base outline-none focus:ring-2 focus:ring-offset-1"
                  style={{
                    background: p.card,
                    border: `1px solid ${p.line2}`,
                    color: p.ink,
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: p.ink, color: p.bg }}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Rechercher"
                )}
              </button>
            </form>
          </div>
        </section>

        <section
          className="flex-1 py-8 md:py-12"
          style={{ background: p.bg2 }}
        >
          <div className="container mx-auto px-4 md:px-8">
            {hasSearched ? (
              isLoading ? (
                <div
                  className="flex items-center justify-center py-16"
                  style={{ color: p.ink2 }}
                >
                  <Loader2
                    className="h-8 w-8 animate-spin mr-3"
                    style={{ color: p.accent }}
                  />
                  <span>Recherche en cours...</span>
                </div>
              ) : results.length === 0 ? (
                <div
                  className="text-center py-16 rounded-2xl"
                  style={{ background: p.card, border: `1px solid ${p.line}` }}
                >
                  <Search
                    className="h-12 w-12 mx-auto mb-4"
                    style={{ color: p.ink2, opacity: 0.4 }}
                  />
                  <h2
                    className={`${serifClass} text-2xl font-medium mb-2`}
                    style={{ color: p.ink, letterSpacing: "-0.02em" }}
                  >
                    Aucun résultat trouvé
                  </h2>
                  <p className="text-sm" style={{ color: p.ink2 }}>
                    Ce contenu n&apos;est pas encore dans notre catalogue.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {TABS.map((t) => {
                      const active = activeTab === t.key
                      const Icon = t.icon
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setActiveTab(t.key)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                          style={{
                            background: active ? p.ink : p.card,
                            color: active ? p.bg : p.ink,
                            border: `1px solid ${active ? p.ink : p.line}`,
                          }}
                        >
                          {Icon && <Icon className="h-3.5 w-3.5" />}
                          {t.label}
                          <span
                            className="text-xs"
                            style={{ opacity: 0.7 }}
                          >
                            ({t.count})
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-sm mb-6" style={{ color: p.ink2 }}>
                    {filteredResults.length} résultat
                    {filteredResults.length !== 1 ? "s" : ""}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                    {filteredResults.map((result) => (
                      <ApercuMediaCard
                        key={result.id}
                        media={result}
                        size="sm"
                        serifClass={serifClass}
                      />
                    ))}
                  </div>
                </>
              )
            ) : (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <Search
                  className="h-12 w-12 mx-auto mb-4"
                  style={{ color: p.ink2, opacity: 0.4 }}
                />
                <h2
                  className={`${serifClass} text-2xl font-medium mb-2`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  Recherchez dans le catalogue
                </h2>
                <p className="text-sm" style={{ color: p.ink2 }}>
                  Trouvez des films, séries et jeux analysés pour votre
                  famille.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </FamilyFitProvider>
  )
}

export function RechercheClassic() {
  const p = APERCU_PALETTE
  return (
    <Suspense
      fallback={
        <div
          className="min-h-[60vh] flex items-center justify-center"
          style={{ background: p.bg }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: p.accent }} />
        </div>
      }
    >
      <RechercheContent />
    </Suspense>
  )
}
