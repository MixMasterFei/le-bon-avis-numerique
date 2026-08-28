"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { seededShuffle, getDaySeed } from "@/lib/seeded-shuffle"
import { CardRailSection, Em, Band, Wrap, SectionHead } from "./parts"
import type { RedesignCardMedia } from "./RedesignCard"
import { UpcomingCard, type UpcomingItem } from "./UpcomingCard"
import { homepageRailLabel, type HomepageState } from "@/lib/homepage-time-context"
import { isOutOfSeason } from "@/lib/seasonal"

type CardType = RedesignCardMedia["type"]

interface ApiMedia {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  topics?: string[] | null
  platforms?: string[] | null
  contentMetrics?: RedesignCardMedia["contentMetrics"]
  cinemaReleaseBucket?: string
  releaseDate?: string | null
  /** /api/cinema only: the age is an estimate (not in DB, or not yet enriched). */
  isProvisional?: boolean
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
    provisional: m.isProvisional === true,
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

// SWR-style persistence: a full page refresh paints rails from the previous
// session's sessionStorage snapshot (no spinner, no full re-fetch), then quietly
// revalidates. sessionStorage survives reloads in the same tab and clears when
// the tab closes — so data is never more than a session stale.
const PERSIST_TTL_MS = 6 * 60 * 60 * 1000 // 6h hard cap

function persistGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(`totem:rail:v1:${key}`)
    if (!raw) return null
    const o = JSON.parse(raw) as { t: number; v: T }
    if (!o || typeof o.t !== "number" || Date.now() - o.t > PERSIST_TTL_MS) return null
    return o.v
  } catch {
    return null
  }
}

function persistSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(`totem:rail:v1:${key}`, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    /* quota exceeded or storage disabled — ignore */
  }
}

/**
 * `filterKey` + `filter`: an optional predicate applied to the raw API rows
 * before they become cards. Used for the seasonal gate (no Noël in August).
 * The key is part of the cache key so two rails on the same URL with different
 * filters can't share a cached result.
 */
function useRail(
  url: string,
  key: string,
  fallbackType: CardType,
  opts: { filter?: (m: ApiMedia) => boolean; filterKey?: string } = {},
) {
  const { filter, filterKey = "" } = opts
  const cacheKey = `${key}@${url}#${filterKey}`
  const [items, setItems] = useState<RedesignCardMedia[]>(() => RAIL_CACHE.get(cacheKey) ?? [])
  const [loading, setLoading] = useState(!RAIL_CACHE.has(cacheKey))
  // Skeletons only on the very first load; after that, filter changes keep the
  // current cards visible until the new set arrives (no empty flash).
  const didInit = useRef(RAIL_CACHE.has(cacheKey))

  useEffect(() => {
    let cancelled = false
    const cached = RAIL_CACHE.get(cacheKey)
    if (cached) {
      // Already validated this session: serve from memory, no refetch.
      didInit.current = true
      queueMicrotask(() => {
        if (cancelled) return
        setItems(cached)
        setLoading(false)
      })
      return () => { cancelled = true }
    }
    // No in-memory copy (e.g. a fresh page load): paint instantly from the
    // previous session's sessionStorage snapshot, then revalidate once.
    const persisted = persistGet<RedesignCardMedia[]>(cacheKey)
    if (persisted && persisted.length) {
      didInit.current = true
      queueMicrotask(() => {
        if (cancelled) return
        setItems(persisted)
        setLoading(false)
      })
    }
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data?.[key]) ? (data[key] as ApiMedia[]) : []
        const mapped = (filter ? arr.filter(filter) : arr).map((m) => toCard(m, fallbackType))
        RAIL_CACHE.set(cacheKey, mapped)
        persistSet(cacheKey, mapped)
        setItems(mapped)
        didInit.current = true
      })
      .catch(() => { if (!cancelled && !didInit.current) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // `filter` is recreated per render by callers; `filterKey` is the stable
    // identity that decides when a refetch is actually needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key, fallbackType, cacheKey])
  return { items, loading }
}

/** Month-aware seasonal gate shared by every rail (see @/lib/seasonal). */
function useSeasonalFilter() {
  const month = new Date().getMonth()
  return useMemo(
    () => ({
      filter: (m: ApiMedia) => !isOutOfSeason(m, month),
      filterKey: `season:${month}`,
    }),
    [month],
  )
}

// ── Top picks — time-aware, quality, in-season ("Pour ce soir / ce week-end…") ──
//
// Leads with current theatrical releases (so a big drop surfaces here the week
// it lands, not only in the cinema rail), then fills with quality titles whose
// MIX shifts by moment: the weekend leans films, weeknights lean séries + jeux.
// Everything is age-gated and passes each endpoint's public quality floor, and
// out-of-season holiday titles (no Noël in June) are filtered out.

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
    const ckey = `toppicks:age=${maxAge}`
    // Instant paint from the previous session's snapshot, then revalidate.
    const persisted = persistGet<TopPools>(ckey)
    if (persisted) {
      queueMicrotask(() => {
        if (cancelled) return
        setPools(persisted)
        setLoading(false)
      })
    }
    const age = `maxAge=${maxAge}`
    const month = new Date().getMonth()
    const inSeason = (m: ApiMedia) => !isOutOfSeason(m, month)
    // Watchable in France right now = has FR streaming providers. Drops globally
    // popular but France-unavailable titles (e.g. an Italy-only release that
    // rides its huge home-country vote count into the popularity pool).
    const inFrance = (m: ApiMedia) => Array.isArray(m.platforms) && m.platforms.length > 0
    const relevant = (m: ApiMedia) => inSeason(m) && inFrance(m)
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
        const films = [...list(fq, "items"), ...list(ff, "items")].filter(relevant).map((m) => toCard(m, "MOVIE"))
        const next: TopPools = {
          // Cinema = TMDB now_playing region=FR (already French theatrical), games
          // have no streaming providers — so neither gets the FR-availability gate.
          //
          // Provisional titles are excluded HERE and only here: this rail is the
          // "what should we watch together" recommendation, and a film whose age
          // is still a genre guess (no AI pass, no content analysis) can't be
          // recommended to a family — that is how a thriller stored at "Tous
          // publics" led the rail with no badge at all. Those films still show
          // in the dedicated "À l'affiche au cinéma" rail, which is a factual
          // listing and badges them "à confirmer".
          cinema: list(cin, "movies")
            .filter((m) => m.isProvisional !== true)
            .filter(inSeason)
            .map((m) => toCard(m, "MOVIE")),
          films,
          series: list(tv, "items").filter(relevant).map((m) => toCard(m, "TV")),
          games: list(gm, "games").filter(inSeason).map((m) => toCard(m, "GAME")),
        }
        setPools(next)
        persistSet(ckey, next)
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
    // Top rail rotates DAILY (fresh feel) — the pools are ~30 deep, only 12
    // shown, so a day seed yields a genuinely different selection each day.
    const seed = getDaySeed() + nonce
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
function useUpcoming(maxAge?: number) {
  const [items, setItems] = useState<UpcomingItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    // Family age cap: upcoming titles have no ContentMetrics yet, so neither
    // the score filter nor the blur can protect a young visitor — the age cap
    // is the ONLY gate here. Always send it (the caller defaults to the family
    // cap), or a PEGI 16/18 "coming soon" title fills this rail unbadged.
    const url = `/api/db/upcoming${typeof maxAge === "number" ? `?maxAge=${maxAge}` : ""}`
    fetch(url)
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
  }, [maxAge])
  return { items, loading }
}

export function UpcomingRail({ maxAge }: { maxAge?: number }) {
  const { items, loading } = useUpcoming(maxAge)
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
  // "Recharger" re-rolls the editorial picks in place via the API's seed param
  // (same pattern as the "Pour ce soir" rail). This used to be an "Autre
  // sélection" link to /recherche — an empty search box, which read as a
  // broken page with no movies.
  const [seed, setSeed] = useState<number | null>(null)
  // Over-fetch (14 for a 10-card row) so the seasonal gate can drop a couple of
  // Noël titles without leaving a short row.
  const url = `/api/db/expert-picks?limit=14${typeof maxAge === "number" ? `&maxAge=${maxAge}` : ""}${seed !== null ? `&seed=${seed}` : ""}`
  const season = useSeasonalFilter()
  const { items, loading } = useRail(url, "items", "MOVIE", season)
  return (
    <CardRailSection
      alt
      id="coups-de-coeur"
      eyebrow="Coups de cœur"
      title={<>Nos <Em tone="pine">coups de cœur</Em> du moment</>}
      lead="Des valeurs sûres pour la famille, avec un âge conseillé et une analyse du contenu."
      onReload={() => setSeed(Math.floor(Math.random() * 1_000_000))}
      items={items.slice(0, 10)}
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
  // Say the cap out loud. This rail is age-capped like every other browse rail
  // (default: the youngest child in the family), so a household with a 10-year
  // old legitimately never sees the PEGI 12/16 releases of the last few weeks —
  // and without this line that reads as "the catalogue is out of date" rather
  // than "these are filtered for your family".
  const capNote =
    typeof maxAge === "number" && maxAge < 18
      ? ` Filtré pour les moins de ${maxAge + 1} ans — les sorties PEGI plus élevées sont sur la page Jeux vidéo.`
      : ""
  return (
    <CardRailSection
      id="jeux"
      eyebrow="Sur les consoles cette semaine"
      title={<>Sortis récemment en <Em tone="terra">jeux vidéo</Em></>}
      lead={`Les dernières sorties consoles, avec l'âge conseillé et les points de vigilance.${capNote}`}
      action={{ label: "Voir tout", href: "/jeux?sort=releaseDate" }}
      items={items.slice(0, 12)}
      loading={loading}
      totem="compact"
      audience={audience}
      rankByMemberIds={rankByMemberIds}
    />
  )
}
