"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { seededShuffle, getWeekSeed } from "@/lib/seeded-shuffle"
import { CardRailSection, Em, Band, Wrap, SectionHead } from "./parts"
import type { RedesignCardMedia } from "./RedesignCard"
import { UpcomingCard, type UpcomingItem } from "./UpcomingCard"
import { homepageRailLabel, type HomepageState } from "@/lib/homepage-time-context"

type CardType = RedesignCardMedia["type"]

interface ApiMedia {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  topics?: string[] | null
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

// ── Top picks — time-aware, quality, in-season ("Pour ce soir / ce week-end…") ──
//
// Leads with current theatrical releases (so a big drop surfaces here the week
// it lands, not only in the cinema rail), then fills with quality titles whose
// MIX shifts by moment: the weekend leans films, weeknights lean séries + jeux.
// Everything is age-gated and passes each endpoint's public quality floor, and
// out-of-season holiday titles (no Noël in June) are filtered out.

const SEASONAL = {
  christmas: /(no[eë]l|christmas|santa|p[eè]re no[eë]l)/,
  halloween: /halloween/,
}

/** Drop holiday-themed titles when we're not in their season. */
function isOutOfSeason(m: ApiMedia, month0: number): boolean {
  const hay = `${m.title} ${(m.genres ?? []).join(" ")} ${(m.topics ?? []).join(" ")}`.toLowerCase()
  const decSeason = month0 === 10 || month0 === 11 // nov–déc
  const octSeason = month0 === 9 // oct
  if (!decSeason && SEASONAL.christmas.test(hay)) return true
  if (!octSeason && SEASONAL.halloween.test(hay)) return true
  return false
}

interface TopPools {
  cinema: RedesignCardMedia[]
  films: RedesignCardMedia[]
  series: RedesignCardMedia[]
  games: RedesignCardMedia[]
}

function useTopPicks(maxAge: number) {
  const [pools, setPools] = useState<TopPools>({ cinema: [], films: [], series: [], games: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const age = `maxAge=${maxAge}`
    const month = new Date().getMonth()
    const inSeason = (m: ApiMedia) => !isOutOfSeason(m, month)
    const getJson = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    const list = (data: unknown, key: string): ApiMedia[] => {
      const d = data as Record<string, unknown> | null
      return d && Array.isArray(d[key]) ? (d[key] as ApiMedia[]) : []
    }

    Promise.all([
      getJson(`/api/cinema?${age}`),
      getJson(`/api/db/media?type=MOVIE&sort=popularity&minVotes=200&${age}&limit=30`),
      getJson(`/api/db/media?type=MOVIE&sort=newest&minVotes=80&${age}&limit=30`),
      getJson(`/api/db/media?type=TV&sort=popularity&minVotes=80&${age}&limit=30`),
      getJson(`/api/db/games?sortBy=releaseDate&minVoteCount=20&requirePoster=true&${age}&limit=20`),
    ])
      .then(([cin, fq, ff, tv, gm]) => {
        if (cancelled) return
        const films = [...list(fq, "items"), ...list(ff, "items")].filter(inSeason).map((m) => toCard(m, "MOVIE"))
        setPools({
          cinema: list(cin, "movies").filter(inSeason).map((m) => toCard(m, "MOVIE")),
          films,
          series: list(tv, "items").filter(inSeason).map((m) => toCard(m, "TV")),
          games: list(gm, "games").filter(inSeason).map((m) => toCard(m, "GAME")),
        })
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [maxAge])

  return { pools, loading }
}

// How many of each type to show, by moment. Cinema always leads (1–2) so a big
// new release surfaces first; the rest is the quality fill.
const TOP_MIX: Record<HomepageState, { cinema: number; films: number; series: number; games: number }> = {
  weekend: { cinema: 2, films: 6, series: 1, games: 1 },
  holidays: { cinema: 2, films: 4, series: 3, games: 3 },
  tonight: { cinema: 1, films: 3, series: 4, games: 3 },
  default: { cinema: 1, films: 4, series: 3, games: 2 },
}

export function TopPicksRail({ maxAge, audience, rankByMemberIds, state }: { maxAge: number; audience?: string; rankByMemberIds?: string[]; state: HomepageState }) {
  const { pools, loading } = useTopPicks(maxAge)
  const [nonce, setNonce] = useState(0)
  const label = homepageRailLabel(state)

  const shown = useMemo(() => {
    const seed = getWeekSeed() + nonce
    const mix = TOP_MIX[state]
    const pick = (arr: RedesignCardMedia[], n: number, s: number) => seededShuffle(arr, s).slice(0, n)
    // Cinema leads (big new releases first); the rest is shuffled together so
    // films / séries / jeux interleave instead of sitting in type blocks.
    const lead = pools.cinema.slice(0, mix.cinema)
    const rest = seededShuffle(
      [
        ...pick(pools.films, mix.films, seed),
        ...pick(pools.series, mix.series, seed + 1),
        ...pick(pools.games, mix.games, seed + 2),
      ],
      seed + 3,
    )
    const seen = new Set<string>()
    const out: RedesignCardMedia[] = []
    for (const c of [...lead, ...rest]) {
      if (c && !seen.has(c.id)) {
        seen.add(c.id)
        out.push(c)
      }
    }
    return out.slice(0, 12)
  }, [pools, state, nonce])

  return (
    <CardRailSection
      id="weekend"
      eyebrow={label.eyebrow}
      title={<>{label.prefix}<Em tone="terra">{label.emphasis}</Em>{label.suffix}</>}
      lead={`${label.lead} Ajustez les âges plus haut pour personnaliser.`}
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
