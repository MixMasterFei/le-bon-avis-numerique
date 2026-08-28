import { unstable_cache } from "next/cache"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withPrismaRetry } from "@/lib/prisma-retry"
import { getHolidayCalendar } from "@/lib/school-holidays"
import {
  resolveHomepageTimeContext,
  type HomepageState,
  type HomepageTimeContext,
} from "@/lib/homepage-time-context"
import { getDaySeed, seededShuffle } from "@/lib/seeded-shuffle"
import { APERCU_PALETTE } from "./apercuTheme"
import { ApercuMediaCard, type ApercuCardMedia } from "./ApercuMediaCard"
import { getNowPlayingTmdbIds } from "@/lib/cinema"
import { inSeason } from "@/lib/seasonal"

interface HeroLink {
  label: string
  href: string
}

interface HeroData {
  cards: ApercuCardMedia[]
  links: HeroLink[]
}

const POPULAR_PROVIDERS = ["Netflix", "Disney+", "Prime Video", "Canal+", "Apple TV+"]

const baseSelect = {
  id: true,
  type: true,
  title: true,
  posterUrl: true,
  expertAgeRec: true,
  genres: true,
  topics: true,
  isEnriched: true,
  trendingScore: true,
  contentMetrics: {
    select: {
      violence: true,
      sexNudity: true,
      language: true,
      substanceUse: true,
    },
  },
} as const

type DBRow = Prisma.MediaItemGetPayload<{ select: typeof baseSelect }>

function toCard(row: DBRow): ApercuCardMedia {
  return {
    id: row.id,
    type: (row.type === "MOVIE" || row.type === "TV" || row.type === "GAME"
      ? row.type
      : "MOVIE") as "MOVIE" | "TV" | "GAME",
    title: row.title,
    posterUrl: row.posterUrl,
    expertAgeRec: row.expertAgeRec,
    isProvisional: !row.isEnriched && row.expertAgeRec != null,
    genres: row.genres,
    contentMetrics: row.contentMetrics,
  }
}

// Hard ceiling for the "en famille" rail. Even with no family context
// — and even if the family has only teenagers — the rail never shows
// content above this age, since the framing is co-viewing. Older
// siblings discover more mature content elsewhere on the site.
const FAMILY_AGE_CAP = 12

// Pool size the rotating slots shuffle over. Large enough that the daily
// seed yields visible variety; small enough to stay above the quality
// floor (the pool is still ordered by votes/recency before shuffling).
const ROTATION_POOL = 24

// Pick that LEADS with what's trending right now, then day-rotates the
// rest for variety. The pool arrives ordered `trendingScore desc nulls
// last, then votes`, so currently-trending titles sit at the front.
//
//  - Lead slots go to those trending titles (most-trending first) — this
//    is what makes the rail feel "du moment" instead of pinning the same
//    evergreen blockbusters (Les Simpson, Forza…) every day.
//  - Remaining slots are filled by a day-seeded shuffle of the non-
//    trending quality pool, so when little is trending the rail still
//    rotates a fresh family pick daily (cache key includes the Paris day).
function dayPick(rows: DBRow[], take: number): DBRow[] {
  const trending = rows.filter((r) => r.trendingScore != null)
  const rest = rows.filter((r) => r.trendingScore == null)
  const lead = trending.slice(0, take)
  const remaining = take - lead.length
  if (remaining <= 0) return lead
  const rotated = seededShuffle(rest, getDaySeed()).slice(0, remaining)
  return [...lead, ...rotated]
}

// Streaming fallback when the new-on-streaming query returns nothing
// (e.g. availableFrom not yet backfilled on most rows). Returns
// recently added titles that have at least one streaming provider, age-
// capped, sorted by createdAt so the rail still feels fresh.
async function fetchStreamingFallback(ageCap: number, take: number): Promise<DBRow[]> {
  return withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: { in: ["MOVIE", "TV"] },
        posterUrl: { not: null, startsWith: "http" },
        platforms: { isEmpty: false },
        isEnriched: true,
        expertAgeRec: { not: null, lte: ageCap },
        tmdbVoteCount: { gte: 200 },
        NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
      },
      orderBy: [{ createdAt: "desc" }],
      take,
      select: baseSelect,
    }),
  )
}

// Family-friendly TV series for "tonight" / "weekend" — bingeable
// episodes paired with a film hero.
async function fetchFamilyTV(ageCap: number, take: number): Promise<DBRow[]> {
  const pool = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "TV",
        posterUrl: { not: null, startsWith: "http" },
        isEnriched: true,
        expertAgeRec: { not: null, lte: ageCap },
        tmdbVoteCount: { gte: 300 },
        NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
      },
      orderBy: [{ trendingScore: { sort: "desc", nulls: "last" } }, { tmdbVoteCount: "desc" }],
      take: ROTATION_POOL,
      select: baseSelect,
    }),
  )
  return dayPick(pool.filter(inSeason()), take)
}

// Minimum recognizability floor — for games this is the IGDB rating
// count (stored in `tmdbVoteCount`, see media-queries.ts). Keeps obscure
// titles nobody recognizes out of the "what to play" rail.
const GAME_MIN_VOTES = 80

// Games for the rail — popular and family-friendly. Ordered by rating
// count (notoriety) first so unknown titles don't surface; recency is
// the tiebreaker so the pool still rotates as new well-known games land.
async function fetchFamilyGames(ageCap: number, take: number): Promise<DBRow[]> {
  const pool = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "GAME",
        posterUrl: { not: null, startsWith: "http" },
        isEnriched: true,
        expertAgeRec: { not: null, lte: ageCap },
        tmdbVoteCount: { gte: GAME_MIN_VOTES },
      },
      orderBy: [
        { trendingScore: { sort: "desc", nulls: "last" } },
        { tmdbVoteCount: { sort: "desc", nulls: "last" } },
        { releaseDate: { sort: "desc", nulls: "last" } },
      ],
      take: ROTATION_POOL,
      select: baseSelect,
    }),
  )
  return dayPick(pool.filter(inSeason()), take)
}

// Family-friendly streaming films for "tonight" — popular-platform movies,
// day-rotated over a quality pool so it isn't always the single top-voted
// title. (Replaces the old inline `tmdbVoteCount desc` take-1 query.)
async function fetchStreamingFilms(ageCap: number, take: number): Promise<DBRow[]> {
  const pool = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "MOVIE",
        posterUrl: { not: null, startsWith: "http" },
        platforms: { hasSome: POPULAR_PROVIDERS },
        isEnriched: true,
        expertAgeRec: { not: null, lte: ageCap },
        tmdbVoteCount: { gte: 200 },
        NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
      },
      orderBy: [{ trendingScore: { sort: "desc", nulls: "last" } }, { tmdbVoteCount: "desc" }],
      take: ROTATION_POOL,
      select: baseSelect,
    }),
  )
  return dayPick(pool.filter(inSeason()), take)
}

// High-quality family films for the holidays rail — day-rotated over a
// quality-floored pool instead of pinning the single top-voted title.
async function fetchQualityFilms(ageCap: number, take: number): Promise<DBRow[]> {
  const pool = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "MOVIE",
        posterUrl: { not: null, startsWith: "http" },
        isEnriched: true,
        expertAgeRec: { not: null, lte: ageCap },
        dataQualityScore: { gte: 70 },
        tmdbVoteCount: { gte: 500 },
        NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
      },
      orderBy: [{ trendingScore: { sort: "desc", nulls: "last" } }, { tmdbVoteCount: "desc" }],
      take: ROTATION_POOL,
      select: baseSelect,
    }),
  )
  return dayPick(pool.filter(inSeason()), take)
}

async function fetchTonight(ageCap: number): Promise<HeroData> {
  // "Pour ce soir" = what to watch AT HOME tonight, so no cinema (you
  // can't stream a film that's still in theaters tonight). Mix: 2
  // streaming films + 2 streaming series. Tonight is movie/episode-
  // coded, not game-coded. 4 cards.
  const [streamingFilms, series] = await Promise.all([
    fetchStreamingFilms(ageCap, 2),
    fetchFamilyTV(ageCap, 2),
  ])

  return {
    cards: dedupeAndCap(
      [...streamingFilms.map(toCard), ...series.map(toCard)],
      4,
    ),
    links: [
      { label: "Streaming films", href: `/films/recherche?maxAge=${ageCap}` },
      { label: "Séries", href: `/series?maxAge=${ageCap}` },
    ],
  }
}

async function fetchWeekend(ageCap: number): Promise<HeroData> {
  // Mix: 2 cinema + 1 series + 1 game = 4 cards. Weekends bring out
  // longer formats (series binge, gaming session).
  const [cinema, series, games] = await Promise.all([
    fetchCinemaSlice(2, ageCap),
    fetchFamilyTV(ageCap, 1),
    fetchFamilyGames(ageCap, 1),
  ])

  // Streaming fallback if either series or games came back empty.
  let extras: ApercuCardMedia[] = []
  if (series.length === 0 || games.length === 0) {
    const fallback = await fetchStreamingFallback(ageCap, 2)
    extras = fallback.filter(inSeason()).map(toCard)
  }

  return {
    cards: dedupeAndCap(
      [...cinema, ...series.map(toCard), ...games.map(toCard), ...extras],
      4,
    ),
    links: [
      { label: "Au cinéma", href: `/films?sort=cinema&maxAge=${ageCap}` },
      { label: "Séries", href: `/series?maxAge=${ageCap}` },
      { label: "Jeux", href: `/jeux?maxAge=${ageCap}` },
    ],
  }
}

function dedupeAndCap(cards: ApercuCardMedia[], cap: number): ApercuCardMedia[] {
  const seen = new Set<string>()
  const out: ApercuCardMedia[] = []
  for (const c of cards) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
    if (out.length >= cap) break
  }
  return out
}

async function fetchHolidays(ageCap: number): Promise<HeroData> {
  // Holidays = time-rich. Mix all four pillars: 1 series marathon, 1
  // film, 1 game, 1 cinema for a one-stop "what to do" rail.
  const [series, films, games, cinema] = await Promise.all([
    fetchFamilyTV(ageCap, 1),
    fetchQualityFilms(ageCap, 1),
    fetchFamilyGames(ageCap, 1),
    fetchCinemaSlice(1, ageCap),
  ])

  return {
    cards: dedupeAndCap(
      [...series.map(toCard), ...films.map(toCard), ...games.map(toCard), ...cinema],
      4,
    ),
    links: [
      { label: "Séries", href: `/series?maxAge=${ageCap}` },
      { label: "Films", href: `/films?maxAge=${ageCap}` },
      { label: "Jeux", href: `/jeux?maxAge=${ageCap}` },
    ],
  }
}

async function fetchDefault(ageCap: number): Promise<HeroData> {
  // Trending-led mix of editorial + new arrivals across all media types.
  // The pool is ordered trending-first so `dayPick` leads "La sélection
  // du jour" with what's hot right now, then day-rotates the rest.
  const [pool, newest] = await Promise.all([
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: { in: ["MOVIE", "TV", "GAME"] },
          posterUrl: { not: null, startsWith: "http" },
          isEnriched: true,
          dataQualityScore: { gte: 70 },
          expertAgeRec: { not: null, lte: ageCap },
          tmdbVoteCount: { gte: 500 },
          NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
        },
        orderBy: [{ trendingScore: { sort: "desc", nulls: "last" } }, { tmdbVoteCount: "desc" }],
        take: 60,
        select: baseSelect,
      }),
    ),
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: { in: ["MOVIE", "TV", "GAME"] },
          posterUrl: { not: null, startsWith: "http" },
          expertAgeRec: { not: null, lte: ageCap },
          NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: baseSelect,
      }),
    ),
  ])

  const shuffled = dayPick(pool.filter(inSeason()), 3).map(toCard)
  const fresh = newest.slice(0, 1).map(toCard)
  return {
    cards: dedupeAndCap([...shuffled, ...fresh], 4),
    links: [
      { label: "Parcourir le catalogue", href: `/films?maxAge=${ageCap}` },
      { label: "Derniers ajouts", href: `/films?sort=newest&maxAge=${ageCap}` },
    ],
  }
}

// Cinema slice — intersects the catalogue with TMDB now_playing (region=FR),
// the ONLY accurate "in French theaters" source (CLAUDE.md forbids the
// releaseDate proxy this used to run on: it surfaced a Disney+ streaming film
// as the top "cinema" pick, and with no upper date bound a future-dated
// import could occupy the slot). getNowPlayingTmdbIds is itself cached ~1h
// and this whole hero is wrapped in unstable_cache(revalidate: 600), so the
// TMDB roundtrip cost is negligible.
async function fetchCinemaSlice(limit: number, ageCap?: number): Promise<ApercuCardMedia[]> {
  const nowPlayingIds = await getNowPlayingTmdbIds()
  if (nowPlayingIds.size === 0) return []

  const where = {
    type: "MOVIE" as const,
    posterUrl: { not: null, startsWith: "http" },
    tmdbId: { in: [...nowPlayingIds] },
    expertAgeRec: typeof ageCap === "number" ? { lte: ageCap, not: null } : { not: null },
    NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
  }
  const rows = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where,
      orderBy: [{ tmdbVoteCount: { sort: "desc" as const, nulls: "last" as const } }],
      take: limit * 2,
      select: baseSelect,
    }),
  )
  return rows.filter(inSeason()).slice(0, limit).map(toCard)
}

const getHeroData = unstable_cache(
  async (state: HomepageState, dayKey: string, ageCap: number): Promise<HeroData> => {
    void dayKey // included in the cache key so the day rotation invalidates
    if (state === "tonight") return fetchTonight(ageCap)
    if (state === "weekend") return fetchWeekend(ageCap)
    if (state === "holidays") return fetchHolidays(ageCap)
    return fetchDefault(ageCap)
  },
  ["homepage-hero-rail-v4"],
  { revalidate: 600 },
)

async function resolveContext(): Promise<HomepageTimeContext> {
  let holidays: Awaited<ReturnType<typeof getHolidayCalendar>> = []
  try {
    holidays = await getHolidayCalendar()
  } catch {
    holidays = []
  }
  return resolveHomepageTimeContext(new Date(), holidays)
}

export async function ApercuTimeAwareHero({
  serifClass,
  maxAgeCap,
}: {
  serifClass: string
  /** Optional youngest-minor age from the logged-in user's family.
   *  The rail enforces TWO ceilings simultaneously:
   *   - FAMILY_AGE_CAP (12) — hard cap that never relaxes.
   *   - youngest minor age — further tightens for families whose
   *     smallest viewer is younger than 12.
   *  Effective cap = min(FAMILY_AGE_CAP, maxAgeCap ?? FAMILY_AGE_CAP).
   */
  maxAgeCap?: number | null
}) {
  const ctx = await resolveContext()
  const familyCap =
    typeof maxAgeCap === "number" && maxAgeCap > 0 ? maxAgeCap : FAMILY_AGE_CAP
  const ageCap = Math.min(FAMILY_AGE_CAP, familyCap)
  const data = await getHeroData(ctx.state, ctx.parisIsoDay, ageCap)
  const p = APERCU_PALETTE

  if (data.cards.length === 0) return null

  const overline = ctx.state === "holidays"
    ? `VACANCES · ${ctx.holidayLabel ?? ""}`.trim()
    : ctx.state === "weekend"
      ? "CE WEEK-END"
      : ctx.state === "tonight"
        ? "POUR CE SOIR"
        : "AUJOURD'HUI"

  return (
    <section
      style={{ background: p.bg2 }}
      className="py-10 md:py-14 scroll-mt-24"
      id="hero-time"
    >
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div className="min-w-0">
            <div
              className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide flex items-center gap-2"
              style={{ color: p.accent }}
            >
              <Sparkles className="h-3 w-3" />
              {overline}
              <span style={{ color: p.ink2, fontWeight: 400 }}>· {ctx.subtitle}</span>
            </div>
            <h2
              className={`${serifClass} text-2xl md:text-3xl font-medium m-0 leading-[1.05]`}
              style={{ letterSpacing: "-0.02em", color: p.ink }}
            >
              {ctx.state === "tonight" ? (
                <>
                  Pour ce soir,{" "}
                  <em className="italic" style={{ color: p.accent }}>
                    on regarde quoi ?
                  </em>
                </>
              ) : ctx.state === "weekend" ? (
                <>
                  Pour <em className="italic" style={{ color: p.accent }}>ce week-end</em> en famille
                </>
              ) : ctx.state === "holidays" ? (
                <>
                  Pendant{" "}
                  <em className="italic" style={{ color: p.accent }}>les vacances</em>
                </>
              ) : (
                <>
                  La <em className="italic" style={{ color: p.accent }}>sélection</em> du jour
                </>
              )}
            </h2>
          </div>
        </div>

        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          {data.cards.slice(0, 4).map((media, idx) => (
            <ApercuMediaCard
              key={media.id}
              media={media}
              size="md"
              serifClass={serifClass}
              // First row (2 cols on mobile) is above the fold and holds the
              // mobile LCP element — eager-load it instead of lazy.
              priority={idx < 2}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {data.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: p.accent }}
            >
              → {l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
