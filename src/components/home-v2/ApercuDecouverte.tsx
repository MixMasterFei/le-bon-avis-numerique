"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { RefreshCw, Plus } from "lucide-react"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuNewsHeroCard } from "./ApercuNewsHeroCard"
import { ApercuNewsCard, type ApercuNewsCardData } from "./ApercuNewsCard"
import {
  NEWS_CATEGORY_LABEL,
  NEWS_CATEGORY_ORDER,
  type NewsCategoryKey,
} from "./apercuNewsLabels"
import { APERCU_PALETTE } from "./apercuTheme"

interface ApercuDecouverteProps {
  stories: ApercuNewsCardData[]
  activeCategory: NewsCategoryKey
  serifClass: string
  /** Only admins see the Rafraîchir button — refresh endpoint is admin-gated. */
  canRefresh?: boolean
  /** Cursor for the next "Charger plus" page — null means no more pages. */
  initialNextCursor?: string | null
}

export function ApercuDecouverte({
  stories,
  activeCategory,
  serifClass,
  canRefresh = false,
  initialNextCursor = null,
}: ApercuDecouverteProps) {
  const p = APERCU_PALETTE
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const [, startTransition] = useTransition()

  // Pagination state — extra pages appended after the initial server-side load.
  const [extra, setExtra] = useState<ApercuNewsCardData[]>([])
  const [cursor, setCursor] = useState<string | null>(initialNextCursor)
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset pagination state whenever the category or initial dataset changes
  // (server re-render delivers a fresh first page on category switch).
  const initialCursorRef = useRef(initialNextCursor)
  useEffect(() => {
    setExtra([])
    setCursor(initialNextCursor)
    initialCursorRef.current = initialNextCursor
  }, [activeCategory, initialNextCursor])

  const allStories = [...stories, ...extra]
  const [hero, ...rest] = allStories

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({ cursor })
      if (activeCategory !== "ALL") params.set("cat", activeCategory)
      const res = await fetch(`/api/news?${params}`)
      if (!res.ok) return
      const data = (await res.json()) as {
        stories: ApercuNewsCardData[]
        nextCursor: string | null
      }
      setExtra((prev) => [...prev, ...data.stories])
      setCursor(data.nextCursor)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }

  function setCategory(cat: NewsCategoryKey) {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    if (cat === "ALL") params.delete("cat")
    else params.set("cat", cat)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  async function onRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetch("/api/admin/news-discover/refresh", { method: "POST" })
    } catch (err) {
      console.error(err)
    } finally {
      startTransition(() => router.refresh())
      setRefreshing(false)
    }
  }

  return (
    <div
      className="flex flex-col min-h-screen overflow-x-hidden"
      style={{ background: p.bg, color: p.ink }}
    >
      <ApercuPreviewBanner />
      <ApercuNav />

      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: p.accent }}
              >
                Découverte
              </div>
              <h1
                className={`${serifClass} text-3xl md:text-4xl font-medium leading-[1.05]`}
                style={{ color: p.ink, letterSpacing: "-0.02em" }}
              >
                L&apos;actualité qui compte pour les familles
              </h1>
            </div>
            {canRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
                style={{ background: p.ink, color: p.bg }}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Synthèse en cours…" : "Rafraîchir"}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {NEWS_CATEGORY_ORDER.map((cat) => {
              const active = cat === activeCategory
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: active ? p.ink : p.card,
                    color: active ? p.bg : p.ink,
                    border: `1px solid ${active ? p.ink : p.line}`,
                  }}
                >
                  {NEWS_CATEGORY_LABEL[cat]}
                </button>
              )
            })}
          </div>

          {stories.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <div className={`${serifClass} text-xl mb-2`} style={{ color: p.ink }}>
                Aucune actualité pour l&apos;instant
              </div>
              <div className="text-sm mb-4" style={{ color: p.ink2 }}>
                {canRefresh
                  ? "Lance une synthèse pour peupler cette rubrique."
                  : "Revenez plus tard — de nouvelles actualités sont synthétisées chaque jour."}
              </div>
              {canRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{ background: p.accent, color: "#FFFFFF" }}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                  {refreshing ? "Synthèse en cours…" : "Lancer une synthèse"}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {hero && <ApercuNewsHeroCard story={hero} serifClass={serifClass} />}
              {rest.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rest.map((s) => (
                    <ApercuNewsCard key={s.slug} story={s} serifClass={serifClass} />
                  ))}
                </div>
              )}
              {cursor && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: p.ink, color: p.bg }}
                  >
                    <Plus className={`w-4 h-4 ${loadingMore ? "animate-spin" : ""}`} />
                    {loadingMore ? "Chargement…" : "Charger plus"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 text-xs" style={{ color: p.ink2 }}>
            Les synthèses sont générées automatiquement à partir de sources tierces.{" "}
            <Link href="/apercu" className="underline">
              Retour à l&apos;aperçu
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
