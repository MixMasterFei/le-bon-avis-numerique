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
    genres: row.genres,
    contentMetrics: row.contentMetrics,
  }
}

// Family-mode age caps. Conservative on purpose — this rail is rendered
// before any family-context personalization, so the assumption is "kids
// in the room". Adult-only content NEVER appears here.
const FAMILY_AGE_CAP = 12

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
  return withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "TV",
        posterUrl: { not: null, startsWith: "http" },
        expertAgeRec: { not: null, lte: ageCap },
        tmdbVoteCount: { gte: 300 },
        NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
      },
      orderBy: [{ tmdbVoteCount: "desc" }],
      take,
      select: baseSelect,
    }),
  )
}

// Games for the rail — recent and family-friendly. Different release-
// date threshold (looser) since the games catalogue is smaller.
async function fetchFamilyGames(ageCap: number, take: number): Promise<DBRow[]> {
  return withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: "GAME",
        posterUrl: { not: null, startsWith: "http" },
        expertAgeRec: { not: null, lte: ageCap },
      },
      orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }],
      take,
      select: baseSelect,
    }),
  )
}

async function fetchTonight(ageCap: number): Promise<HeroData> {
  // Mix: 1 cinema + 1 streaming film + 2 streaming series. Tonight is
  // movie/episode-coded, not game-coded. 4 cards, type-diverse.
  const [cinema, streamingFilms, series] = await Promise.all([
    fetchCinemaSlice(1, ageCap),
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: "MOVIE",
          posterUrl: { not: null, startsWith: "http" },
          platforms: { hasSome: POPULAR_PROVIDERS },
          expertAgeRec: { not: null, lte: ageCap },
          tmdbVoteCount: { gte: 200 },
          NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
        },
        orderBy: [{ tmdbVoteCount: "desc" }],
        take: 1,
        select: baseSelect,
      }),
    ),
    fetchFamilyTV(ageCap, 2),
  ])

  return {
    cards: dedupeAndCap(
      [...cinema, ...streamingFilms.map(toCard), ...series.map(toCard)],
      4,
    ),
    links: [
      { label: "Au cinéma", href: `/films?sort=cinema&maxAge=${ageCap}` },
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
    extras = fallback.map(toCard)
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
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: "MOVIE",
          posterUrl: { not: null, startsWith: "http" },
          expertAgeRec: { not: null, lte: ageCap },
          dataQualityScore: { gte: 70 },
          tmdbVoteCount: { gte: 500 },
          NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
        },
        orderBy: [{ tmdbVoteCount: "desc" }],
        take: 1,
        select: baseSelect,
      }),
    ),
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
  // Day-seeded mix of editorial + new arrivals + cinema across all
  // media types so the "default" state still feels varied.
  const seed = getDaySeed()
  const [pool, newest] = await Promise.all([
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: { in: ["MOVIE", "TV", "GAME"] },
          posterUrl: { not: null, startsWith: "http" },
          dataQualityScore: { gte: 70 },
          expertAgeRec: { not: null, lte: ageCap },
          tmdbVoteCount: { gte: 500 },
          NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
        },
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

  const shuffled = seededShuffle(pool, seed).slice(0, 3).map(toCard)
  const fresh = newest.slice(0, 1).map(toCard)
  return {
    cards: dedupeAndCap([...shuffled, ...fresh], 4),
    links: [
      { label: "Parcourir le catalogue", href: `/films?maxAge=${ageCap}` },
      { label: "Derniers ajouts", href: `/films?sort=newest&maxAge=${ageCap}` },
    ],
  }
}

// Cinema slice — uses TMDB now_playing via the existing /api/cinema
// endpoint logic. To avoid an internal HTTP hop in a server component
// we replicate the minimal call here using the same TMDB helper.
async function fetchCinemaSlice(limit: number, ageCap?: number): Promise<ApercuCardMedia[]> {
  // Reuse the structured DB-cinema crossover by querying our catalog
  // for movies the cron has flagged as "in cinema" (we sort by recent
  // TMDB vote count among movies released within the last 6 months).
  // Avoids an extra TMDB roundtrip for the homepage hero.
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const where = {
    type: "MOVIE" as const,
    posterUrl: { not: null, startsWith: "http" },
    releaseDate: { gte: sixMonthsAgo },
    tmdbVoteCount: { gte: 50 },
    expertAgeRec: typeof ageCap === "number" ? { lte: ageCap, not: null } : { not: null },
    NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
  }
  const rows = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where,
      orderBy: [{ releaseDate: "desc" }, { tmdbVoteCount: "desc" }],
      take: limit,
      select: baseSelect,
    }),
  )
  return rows.map(toCard)
}

const getHeroData = unstable_cache(
  async (state: HomepageState, dayKey: string, ageCap: number): Promise<HeroData> => {
    void dayKey // included in the cache key so the day rotation invalidates
    if (state === "tonight") return fetchTonight(ageCap)
    if (state === "weekend") return fetchWeekend(ageCap)
    if (state === "holidays") return fetchHolidays(ageCap)
    return fetchDefault(ageCap)
  },
  ["homepage-hero-rail-v2"],
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
  /** When the user is logged in with family members, the youngest-of-
   *  the-oldest cap the rail should respect. Otherwise FAMILY_AGE_CAP
   *  (12) is used as a generic safe default. */
  maxAgeCap?: number | null
}) {
  const ctx = await resolveContext()
  const ageCap = typeof maxAgeCap === "number" && maxAgeCap > 0 ? maxAgeCap : FAMILY_AGE_CAP
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
          {data.cards.slice(0, 4).map((media) => (
            <ApercuMediaCard
              key={media.id}
              media={media}
              size="md"
              serifClass={serifClass}
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
