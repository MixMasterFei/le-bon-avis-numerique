"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, Loader2, Film, Tv, Gamepad2, BookOpen } from "lucide-react"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { v2FontVars } from "@/components/home-redesign/fonts"
import { Em } from "@/components/home-redesign/parts"
import { RedesignCard, type RedesignCardMedia } from "@/components/home-redesign/RedesignCard"
import { AdminVariantToggle } from "@/components/home-redesign/AdminVariantToggle"

type Tab = "all" | "movie" | "tv" | "game" | "book"

interface DbMediaItem {
  id: string
  title: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics?: {
    violence?: number | null
    sexNudity?: number | null
    language?: number | null
    substanceUse?: number | null
    consumerism?: number | null
  } | null
}

function RechercheV2Content() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get("q") || ""

  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [results, setResults] = useState<RedesignCardMedia[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([])
      return
    }
    setIsLoading(true)
    setHasSearched(true)
    try {
      const res = await fetch(`/api/db/media?q=${encodeURIComponent(q)}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        const items: DbMediaItem[] = data.items || []
        setResults(
          items
            .filter(
              (it): it is DbMediaItem & { type: "MOVIE" | "TV" | "GAME" } =>
                it.type === "MOVIE" || it.type === "TV" || it.type === "GAME",
            )
            .map((it) => ({
              id: it.id,
              type: it.type,
              title: it.title,
              posterUrl: it.posterUrl,
              expertAgeRec: it.expertAgeRec,
              genres: it.genres || [],
              contentMetrics: it.contentMetrics
                ? {
                    violence: it.contentMetrics.violence ?? null,
                    sexNudity: it.contentMetrics.sexNudity ?? null,
                    language: it.contentMetrics.language ?? null,
                    substanceUse: it.contentMetrics.substanceUse ?? null,
                    consumerism: it.contentMetrics.consumerism ?? null,
                  }
                : null,
            })),
        )
      } else setResults([])
    } catch {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery) performSearch(initialQuery)
  }, [initialQuery, performSearch])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(query)}`)
      performSearch(query)
    }
  }

  const filtered = activeTab === "all" ? results : results.filter((r) => r.type === activeTab.toUpperCase())
  const counts = {
    all: results.length,
    movie: results.filter((r) => r.type === "MOVIE").length,
    tv: results.filter((r) => r.type === "TV").length,
    game: results.filter((r) => r.type === "GAME").length,
    book: 0,
  }
  const TABS: Array<{ key: Tab; label: string; icon?: React.ComponentType<{ className?: string }>; count: number }> = [
    { key: "all", label: "Tout", count: counts.all },
    { key: "movie", label: "Films", icon: Film, count: counts.movie },
    { key: "tv", label: "Séries", icon: Tv, count: counts.tv },
    { key: "game", label: "Jeux", icon: Gamepad2, count: counts.game },
    { key: "book", label: "Livres", icon: BookOpen, count: counts.book },
  ]

  return (
    <FamilyFitProvider>
      <div
        data-home="v2"
        className={`${v2FontVars} flex flex-1 flex-col overflow-x-hidden`}
        style={{ background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--font-hanken), system-ui, sans-serif" }}
      >
        {/* search hero */}
        <section className="border-b py-8 md:py-12" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto max-w-[1240px] px-5 sm:px-7">
            <div className="flex items-center gap-2.5 text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--terra)" }} />
              Catalogue
            </div>
            <h1 className="mt-2.5 text-[clamp(30px,4vw,52px)] font-bold leading-[1.03]" style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}>
              Recherche{initialQuery && " "}
              {initialQuery && <Em tone="terra">« {initialQuery} »</Em>}
            </h1>
            <form onSubmit={onSubmit} className="mt-6 flex max-w-2xl gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: "var(--ink-2)" }} />
                <input
                  type="search"
                  placeholder="Rechercher un film, une série, un jeu…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full py-3 pl-12 pr-4 text-base outline-none"
                  style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink)" }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--ink)", color: "var(--paper)" }}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
              </button>
            </form>
          </div>
        </section>

        <section className="flex-1 py-8 md:py-12" style={{ background: "var(--paper-2)" }}>
          <div className="mx-auto max-w-[1240px] px-5 sm:px-7">
            {!hasSearched ? (
              <EmptyCard title="Recherchez dans le catalogue" sub="Trouvez des films, séries et jeux analysés pour votre famille." />
            ) : isLoading ? (
              <div className="flex items-center justify-center py-16" style={{ color: "var(--ink-2)" }}>
                <Loader2 className="mr-3 h-8 w-8 animate-spin" style={{ color: "var(--terra)" }} />
                <span>Recherche en cours…</span>
              </div>
            ) : results.length === 0 ? (
              <EmptyCard title="Aucun résultat trouvé" sub="Ce contenu n'est pas encore dans notre catalogue." />
            ) : (
              <>
                <div className="mb-6 flex flex-wrap gap-2">
                  {TABS.map((t) => {
                    const active = activeTab === t.key
                    const Icon = t.icon
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors"
                        style={{
                          background: active ? "var(--ink)" : "var(--card)",
                          color: active ? "var(--paper)" : "var(--ink)",
                          border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                        }}
                      >
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                        {t.label}
                        <span className="text-xs opacity-70">({t.count})</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mb-6 text-sm" style={{ color: "var(--ink-2)" }}>
                  {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
                </p>
                <div className="grid grid-cols-2 gap-x-5 gap-y-[30px] md:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((r) => (
                    <RedesignCard key={r.id} media={r} totem="compact" familyVariant="meter" />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <AdminVariantToggle variant="v2" route="/recherche" currentQuery={initialQuery ? `q=${encodeURIComponent(initialQuery)}` : ""} />
      </div>
    </FamilyFitProvider>
  )
}

function EmptyCard({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-[var(--r-lg)] py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
      <Search className="mx-auto mb-4 h-12 w-12" style={{ color: "var(--ink-3)", opacity: 0.5 }} />
      <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-bricolage)", color: "var(--ink)", letterSpacing: "-0.02em" }}>{title}</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-2)" }}>{sub}</p>
    </div>
  )
}

export function RechercheV2() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" style={{ background: "var(--paper, #F4ECDE)" }} />}>
      <RechercheV2Content />
    </Suspense>
  )
}
