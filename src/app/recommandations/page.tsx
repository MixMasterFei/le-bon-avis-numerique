"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Users } from "lucide-react"
import {
  ApercuMediaCard,
  type ApercuCardMedia,
} from "@/components/home-v2/ApercuMediaCard"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

type WizardType = "all" | "movie" | "tv" | "game" | "book" | "app"

const questionChips = [
  { key: "violence", label: "Peu de violence", max: 2 },
  { key: "language", label: "Peu de langage grossier", max: 2 },
  { key: "sexNudity", label: "Peu de nudité", max: 1 },
  { key: "substanceUse", label: "Pas d'alcool/drogues", max: 1 },
] as const

type ChipKey = (typeof questionChips)[number]["key"]

interface DbMedia {
  id: string
  title: string
  posterUrl: string | null
  type: string
  expertAgeRec?: number | null
  genres?: string[]
  contentMetrics?: {
    violence: number
    sexNudity: number
    language: number
    substanceUse: number
  } | null
}

type CardItem = ApercuCardMedia & {
  contentMetricsFull: {
    violence: number
    sexNudity: number
    language: number
    substanceUse: number
  } | null
}

function mapDb(media: DbMedia): CardItem | null {
  if (media.type !== "MOVIE" && media.type !== "TV" && media.type !== "GAME") {
    return null
  }
  return {
    id: media.id,
    type: media.type,
    title: media.title,
    posterUrl: media.posterUrl,
    expertAgeRec: media.expertAgeRec ?? null,
    genres: media.genres || [],
    contentMetrics: media.contentMetrics
      ? {
          violence: media.contentMetrics.violence,
          sexNudity: media.contentMetrics.sexNudity,
          language: media.contentMetrics.language,
          substanceUse: media.contentMetrics.substanceUse,
        }
      : null,
    contentMetricsFull: media.contentMetrics
      ? {
          violence: media.contentMetrics.violence,
          sexNudity: media.contentMetrics.sexNudity,
          language: media.contentMetrics.language,
          substanceUse: media.contentMetrics.substanceUse,
        }
      : null,
  }
}

function RecosInner() {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const sp = useSearchParams()
  const router = useRouter()

  const initialAge = Number(sp.get("age") || 8)
  const initialType = (sp.get("type") || "all").toLowerCase() as WizardType
  const initialChips = new Set<ChipKey>(
    (sp.get("chips") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as ChipKey[]
  )

  const [age, setAge] = useState(
    Number.isFinite(initialAge) ? Math.min(Math.max(initialAge, 2), 18) : 8
  )
  const [type, setType] = useState<WizardType>(initialType)
  const [chips, setChips] = useState<Set<ChipKey>>(initialChips)
  const [allMedia, setAllMedia] = useState<CardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(24)

  useEffect(() => {
    async function fetchMedia() {
      try {
        const res = await fetch("/api/db/media?limit=100")
        if (!res.ok) throw new Error("DB error")
        const data = await res.json()
        if (Array.isArray(data?.media)) {
          const mapped = (data.media as DbMedia[])
            .map(mapDb)
            .filter((x): x is CardItem => x !== null)
          setAllMedia(mapped)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchMedia()
  }, [])

  useEffect(() => {
    const qs = new URLSearchParams()
    qs.set("age", String(age))
    qs.set("type", type)
    if (chips.size > 0) qs.set("chips", Array.from(chips).join(","))
    router.replace(`/recommandations?${qs.toString()}`, { scroll: false })
  }, [age, chips, router, type])

  const filtered = useMemo(() => {
    setDisplayCount(24)
    let items = allMedia

    if (type !== "all") {
      const t = type.toUpperCase()
      items = items.filter((m) => m.type === t)
    }

    items = items.filter((m) => (m.expertAgeRec ?? 99) <= age)

    for (const chip of questionChips) {
      if (chips.has(chip.key)) {
        items = items.filter(
          (m) => (m.contentMetricsFull?.[chip.key] ?? 99) <= chip.max
        )
      }
    }

    return items
  }, [allMedia, age, chips, type])

  const toggleChip = (key: ChipKey) => {
    setChips((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const TYPE_TABS: { key: WizardType; label: string }[] = [
    { key: "all", label: "Tout" },
    { key: "movie", label: "Films" },
    { key: "tv", label: "Séries" },
    { key: "game", label: "Jeux" },
    { key: "book", label: "Livres" },
    { key: "app", label: "Apps" },
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
              Personnalisé
            </div>
            <h1
              className={`${serifClass} text-3xl md:text-5xl font-medium m-0 leading-[1.05]`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Nos{" "}
              <em className="italic" style={{ color: p.accent }}>
                recommandations
              </em>
            </h1>
            <p
              className="mt-3 text-sm md:text-base max-w-2xl"
              style={{ color: p.ink2 }}
            >
              Sélection basée sur l&apos;âge et vos critères.
            </p>
          </div>
        </section>

        <section className="flex-1 py-8 md:py-12" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <div className="grid lg:grid-cols-[280px_1fr] gap-6 lg:gap-10 items-start">
              <aside
                className="rounded-2xl p-5 lg:sticky lg:top-24"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line}`,
                }}
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: p.ink }}
                    >
                      Âge
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: p.ink, color: p.bg }}
                    >
                      {age} ans
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={18}
                    step={1}
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value))}
                    className="w-full accent-[#1E1A15]"
                  />
                  <div
                    className="flex justify-between mt-2 text-xs"
                    style={{ color: p.ink2 }}
                  >
                    <span>2</span>
                    <span>18</span>
                  </div>
                </div>

                <div className="mb-6">
                  <span
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: p.ink }}
                  >
                    Catégorie
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {TYPE_TABS.map((t) => {
                      const active = type === t.key
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setType(t.key)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                          style={{
                            background: active ? p.ink : p.bg2,
                            color: active ? p.bg : p.ink,
                            border: `1px solid ${active ? p.ink : p.line}`,
                          }}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <span
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: p.ink }}
                  >
                    Préférences
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {questionChips.map((chip) => {
                      const active = chips.has(chip.key)
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={() => toggleChip(chip.key)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                          style={{
                            background: active ? p.accent : p.bg2,
                            color: active ? "#fff" : p.ink,
                            border: `1px solid ${active ? p.accent : p.line}`,
                          }}
                        >
                          {chip.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {chips.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setChips(new Set())}
                    className="inline-flex items-center justify-center gap-1 w-full px-3 py-2 rounded-full text-xs font-semibold transition-opacity hover:opacity-70"
                    style={{
                      background: "transparent",
                      color: p.ink,
                      border: `1px solid ${p.line2}`,
                    }}
                  >
                    Réinitialiser
                  </button>
                )}
              </aside>

              <div>
                <div className="flex items-center justify-between mb-5">
                  <p className="text-sm" style={{ color: p.ink2 }}>
                    {filtered.length} résultat
                    {filtered.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-[2/3] rounded-xl animate-pulse"
                        style={{ background: p.placeholder }}
                      />
                    ))}
                  </div>
                ) : filtered.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                      {filtered.slice(0, displayCount).map((m) => (
                        <ApercuMediaCard
                          key={`${m.type}:${m.id}`}
                          media={m}
                          size="sm"
                          serifClass={serifClass}
                        />
                      ))}
                    </div>
                    {displayCount < filtered.length && (
                      <div className="flex justify-center mt-8">
                        <button
                          type="button"
                          onClick={() =>
                            setDisplayCount((prev) => prev + 24)
                          }
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
                          style={{
                            background: "transparent",
                            color: p.ink,
                            border: `1px solid ${p.line2}`,
                          }}
                        >
                          Voir plus ({filtered.length - displayCount} restants)
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    className="text-center py-16 rounded-2xl"
                    style={{
                      background: p.card,
                      border: `1px solid ${p.line}`,
                    }}
                  >
                    <Users
                      className="h-12 w-12 mx-auto mb-4"
                      style={{ color: p.ink2, opacity: 0.4 }}
                    />
                    <p
                      className={`${serifClass} text-xl font-medium mb-2`}
                      style={{ color: p.ink, letterSpacing: "-0.02em" }}
                    >
                      Aucun résultat
                    </p>
                    <p className="text-sm" style={{ color: p.ink2 }}>
                      Essayez d&apos;augmenter l&apos;âge ou de retirer un
                      critère.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </FamilyFitProvider>
  )
}

export default function RecommandationsPage() {
  const p = APERCU_PALETTE
  return (
    <Suspense
      fallback={
        <div
          className="container mx-auto px-4 py-8"
          style={{ background: p.bg }}
        />
      }
    >
      <RecosInner />
    </Suspense>
  )
}
