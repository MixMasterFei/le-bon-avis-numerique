"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { seededShuffle, getWeekSeed } from "@/lib/seeded-shuffle"
import { CardRailSection, Em, Band, Wrap, SectionHead } from "./parts"
import type { RedesignCardMedia } from "./RedesignCard"
import { UpcomingCard, type UpcomingItem } from "./UpcomingCard"

type CardType = RedesignCardMedia["type"]

interface ApiMedia {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  contentMetrics?: RedesignCardMedia["contentMetrics"]
  cinemaReleaseBucket?: string
  releaseDate?: string | null
}

function asCardType(t: string | undefined, fallback: CardType): CardType {
  return t === "MOVIE" || t === "TV" || t === "GAME" ? t : fallback
}

function toCard(m: ApiMedia, fallbackType: CardType): RedesignCardMedia {
  return {
    id: m.id,
    type: asCardType(m.type, fallbackType),
    title: m.title,
    posterUrl: m.posterUrl,
    expertAgeRec: m.expertAgeRec ?? null,
    genres: m.genres ?? [],
    contentMetrics: m.contentMetrics ?? null,
    cornerLabel:
      m.cinemaReleaseBucket === "reissue"
        ? "Reprise"
        : m.cinemaReleaseBucket === "upcoming"
          ? "Avant-prem."
          : null,
  }
}

// Per-rail in-memory cache so re-selecting a filter is INSTANT (no refetch),
// and a module-scoped cache survives remounts within the session.
const RAIL_CACHE = new Map<string, RedesignCardMedia[]>()

function useRail(url: string, key: string, fallbackType: CardType) {
  const cacheKey = `${key}@${url}`
  const [items, setItems] = useState<RedesignCardMedia[]>(() => RAIL_CACHE.get(cacheKey) ?? [])
  const [loading, setLoading] = useState(!RAIL_CACHE.has(cacheKey))
  // Skeletons only on the very first load; after that, filter changes keep the
  // current cards visible until the new set arrives (no empty flash).
  const didInit = useRef(RAIL_CACHE.has(cacheKey))

  useEffect(() => {
    const cached = RAIL_CACHE.get(cacheKey)
    if (cached) {
      // Instant: serve from cache (deferred to avoid a synchronous cascade).
      didInit.current = true
      queueMicrotask(() => {
        setItems(cached)
        setLoading(false)
      })
      return
    }
    // Not cached: keep the current cards visible while fetching (loading is
    // already true on the very first load via useState; we don't re-raise it
    // on filter changes, so there's no empty skeleton flash).
    let cancelled = false
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data?.[key]) ? (data[key] as ApiMedia[]) : []
        const mapped = arr.map((m) => toCard(m, fallbackType))
        RAIL_CACHE.set(cacheKey, mapped)
        setItems(mapped)
        didInit.current = true
      })
      .catch(() => { if (!cancelled && !didInit.current) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url, key, fallbackType, cacheKey])
  return { items, loading }
}

// ── Pour ce week-end — age-chip driven, with a "Recharger" reshuffle ──
//
// The hero selection must be MIXED media (films + séries + jeux) and read as
// attractive to a newcomer: roughly half fresh releases + half recognizable,
// quality titles. We blend two pools from the unified /api/db/media endpoint:
//   - quality : sort=popularity + a tmdbVoteCount floor → well-known films/TV
//     (games carry no tmdb votes, so they naturally come from the fresh pool).
//   - fresh   : sort=newest → recent mixed media incl. séries + jeux.
// Both are age-gated (expertAgeRec ≤ the selected family age) and vetted by the
// endpoint's public quality floor. We then weekly-seed-shuffle the blend so the
// row rotates each Monday; "Recharger" reshuffles on demand.
interface MediaApiItem {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  contentMetrics?: RedesignCardMedia["contentMetrics"]
}

function mapMedia(items: unknown): RedesignCardMedia[] {
  if (!Array.isArray(items)) return []
  return (items as MediaApiItem[])
    .filter((it) => it.type === "MOVIE" || it.type === "TV" || it.type === "GAME")
    .map((it) => toCard(it, "MOVIE"))
}

function useWeekend(maxAge: number) {
  const [quality, setQuality] = useState<RedesignCardMedia[]>([])
  const [fresh, setFresh] = useState<RedesignCardMedia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const age = `maxAge=${maxAge}`
    Promise.all([
      fetch(`/api/db/media?sort=popularity&minVotes=200&${age}&limit=40`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/db/media?sort=newest&${age}&limit=40`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([q, f]) => {
        if (cancelled) return
        setQuality(mapMedia(q?.items))
        setFresh(mapMedia(f?.items))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [maxAge])

  return { quality, fresh, loading }
}

export function WeekendRail({ maxAge, audience, rankByMemberIds }: { maxAge: number; audience?: string; rankByMemberIds?: string[] }) {
  const { quality, fresh, loading } = useWeekend(maxAge)
  const [nonce, setNonce] = useState(0)

  const shown = useMemo(() => {
    const seed = getWeekSeed() + nonce
    const seen = new Set<string>()
    const take = (arr: RedesignCardMedia[], n: number, s: number) => {
      const out: RedesignCardMedia[] = []
      for (const m of seededShuffle(arr, s)) {
        if (seen.has(m.id)) continue
        seen.add(m.id)
        out.push(m)
        if (out.length >= n) break
      }
      return out
    }
    // ~half fresh, ~half quality, then blend so types/sources interleave.
    const freshHalf = take(fresh, 5, seed)
    const qualityHalf = take(quality, 5, seed + 1)
    return seededShuffle([...freshHalf, ...qualityHalf], seed + 2)
  }, [fresh, quality, nonce])

  return (
    <CardRailSection
      id="weekend"
      eyebrow="Ce week-end"
      title={<>Pour <Em tone="terra">ce week-end</Em> en famille</>}
      lead="Un mélange de nouveautés et de valeurs sûres, prêtes à lancer. Ajustez les âges plus haut pour personnaliser."
      items={shown}
      loading={loading}
      totem="full"
      showType
      audience={audience}
      rankByMemberIds={rankByMemberIds}
      onReload={() => setNonce((n) => n + 1)}
    />
  )
}

// ── Bientôt — prochaines sorties (unreleased media → compact up-cards) ──
function useUpcoming() {
  const [items, setItems] = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    fetch("/api/db/upcoming")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data?.items) ? (data.items as ApiMedia[]) : []
        setItems(
          arr.map((m) => ({
            id: m.id,
            type: asCardType(m.type, "MOVIE"),
            title: m.title,
            posterUrl: m.posterUrl,
            expertAgeRec: m.expertAgeRec ?? null,
            genres: m.genres ?? [],
            releaseDate: m.releaseDate ?? null,
          })),
        )
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { items, loading }
}

export function UpcomingRail() {
  const { items, loading } = useUpcoming()
  if (!loading && items.length === 0) return null
  return (
    <Band alt id="bientot">
      <Wrap>
        <SectionHead
          eyebrow="Bientôt"
          title={<>Les <Em tone="pine">prochaines sorties</Em> à surveiller</>}
          lead="Anticipez vos prochaines séances. L'âge affiché est une estimation, précisée après la sortie."
          action={{ label: "Tout le calendrier", href: "/films" }}
        />
        <div className="v2-row-up">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[232px] animate-pulse rounded-[14px]" style={{ background: "var(--placeholder, #E6DFCE)" }} />
              ))
            : items.slice(0, 12).map((it) => <UpcomingCard key={it.id} item={it} />)}
        </div>
      </Wrap>
    </Band>
  )
}

// ── À l'affiche au cinéma ──
export function CinemaRail({ maxAge, audience, rankByMemberIds }: { maxAge?: number; audience?: string; rankByMemberIds?: string[] }) {
  const url = `/api/cinema${typeof maxAge === "number" ? `?maxAge=${maxAge}` : ""}`
  const { items, loading } = useRail(url, "movies", "MOVIE")
  return (
    <CardRailSection
      id="cinema"
      eyebrow="En ce moment"
      title={<>À l&apos;affiche <Em tone="terra">au cinéma</Em> en France</>}
      action={{ label: "Voir tout", href: "/films?sort=cinema" }}
      items={items.slice(0, 12)}
      loading={loading}
      totem="compact"
      audience={audience}
      rankByMemberIds={rankByMemberIds}
    />
  )
}

// ── Nos coups de cœur ──
export function CoupsDeCoeurRail({ maxAge, audience, rankByMemberIds }: { maxAge?: number; audience?: string; rankByMemberIds?: string[] }) {
  const url = `/api/db/expert-picks?limit=10${typeof maxAge === "number" ? `&maxAge=${maxAge}` : ""}`
  const { items, loading } = useRail(url, "items", "MOVIE")
  return (
    <CardRailSection
      alt
      id="coups-de-coeur"
      eyebrow="Coups de cœur"
      title={<>Nos <Em tone="pine">coups de cœur</Em> du moment</>}
      lead="Sélectionnés à la main par l'équipe. Des valeurs sûres, vues et analysées."
      action={{ label: "Autre sélection", href: "/recherche" }}
      items={items}
      loading={loading}
      totem="full"
      showType
      audience={audience}
      rankByMemberIds={rankByMemberIds}
    />
  )
}

// ── Sortis récemment en jeux vidéo (self-hides < 3) ──
export function GamesRail({ maxAge, audience, rankByMemberIds }: { maxAge?: number; audience?: string; rankByMemberIds?: string[] }) {
  const url = `/api/db/games?sortBy=releaseDate&limit=12&requirePoster=true&minVoteCount=20${typeof maxAge === "number" ? `&maxAge=${maxAge}` : ""}`
  const { items, loading } = useRail(url, "games", "GAME")
  if (!loading && items.length < 3) return null
  return (
    <CardRailSection
      id="jeux"
      eyebrow="Sur les consoles cette semaine"
      title={<>Sortis récemment en <Em tone="terra">jeux vidéo</Em></>}
      action={{ label: "Voir tout", href: "/jeux?sort=releaseDate" }}
      items={items.slice(0, 12)}
      loading={loading}
      totem="compact"
      audience={audience}
      rankByMemberIds={rankByMemberIds}
    />
  )
}
