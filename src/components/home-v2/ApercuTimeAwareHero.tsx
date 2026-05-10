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

// Filter to popular providers + reasonable quality so the hero doesn't
// surface obscure rows.
async function fetchTonight(): Promise<HeroData> {
  const cinema = await fetchCinemaSlice(2)
  const streaming = await withPrismaRetry(() =>
    prisma.mediaItem.findMany({
      where: {
        type: { in: ["MOVIE", "TV"] },
        posterUrl: { not: null, startsWith: "http" },
        platforms: { hasSome: POPULAR_PROVIDERS },
        expertAgeRec: { not: null, lte: 14 },
        tmdbVoteCount: { gte: 200 },
        NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
      },
      orderBy: [{ tmdbVoteCount: "desc" }],
      take: 3,
      select: baseSelect,
    }),
  )

  return {
    cards: [...cinema, ...streaming.map(toCard)].slice(0, 4),
    links: [
      { label: "Tout ce qui est en salle", href: "/films?sort=cinema" },
      { label: "Plus de streaming", href: "/films/recherche" },
    ],
  }
}

async function fetchWeekend(): Promise<HeroData> {
  const cinema = await fetchCinemaSlice(3)
  const newOnStreaming = await withPrismaRetry(() =>
    prisma.streamingAvailability.findMany({
      where: {
        country: "FR",
        provider: { in: POPULAR_PROVIDERS },
        availableFrom: { not: null },
        media: {
          type: { in: ["MOVIE", "TV"] },
          posterUrl: { not: null, startsWith: "http" },
          expertAgeRec: { not: null, lte: 14 },
          tmdbVoteCount: { gte: 200 },
        },
      },
      orderBy: { availableFrom: "desc" },
      take: 4,
      include: { media: { select: baseSelect } },
    }),
  )
  const streamingCards = newOnStreaming
    .map((row) => row.media)
    .filter((m): m is DBRow => m !== null)
    .map(toCard)
    // Dedupe by media id since a single title can have several rows.
    .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i)
    .slice(0, 2)

  return {
    cards: [...cinema, ...streamingCards].slice(0, 5),
    links: [
      { label: "Toute la programmation cinéma", href: "/films?sort=cinema" },
      { label: "Nouveau sur le streaming", href: "/films/recherche" },
    ],
  }
}

async function fetchHolidays(): Promise<HeroData> {
  // Marathons (TV with high vote count) + family-fit films.
  const [series, films] = await Promise.all([
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: "TV",
          posterUrl: { not: null, startsWith: "http" },
          expertAgeRec: { not: null, lte: 14 },
          tmdbVoteCount: { gte: 500 },
          NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
        },
        orderBy: [{ tmdbVoteCount: "desc" }],
        take: 2,
        select: baseSelect,
      }),
    ),
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: "MOVIE",
          posterUrl: { not: null, startsWith: "http" },
          expertAgeRec: { not: null, lte: 12 },
          dataQualityScore: { gte: 70 },
          tmdbVoteCount: { gte: 500 },
          NOT: { genres: { hasSome: ["Horreur", "Horror"] } },
        },
        orderBy: [{ tmdbVoteCount: "desc" }],
        take: 2,
        select: baseSelect,
      }),
    ),
  ])

  return {
    cards: [...series.map(toCard), ...films.map(toCard)],
    links: [
      { label: "Plus de séries", href: "/series" },
      { label: "Films pour les enfants", href: "/films?maxAge=12" },
    ],
  }
}

async function fetchDefault(): Promise<HeroData> {
  // Day-seeded mix of editorial + new arrivals + cinema.
  const seed = getDaySeed()
  const [pool, newest] = await Promise.all([
    withPrismaRetry(() =>
      prisma.mediaItem.findMany({
        where: {
          type: { in: ["MOVIE", "TV"] },
          posterUrl: { not: null, startsWith: "http" },
          dataQualityScore: { gte: 70 },
          expertAgeRec: { not: null, lte: 12 },
          tmdbVoteCount: { gte: 500 },
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
          expertAgeRec: { not: null, lte: 14 },
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
    cards: [...shuffled, ...fresh].slice(0, 4),
    links: [
      { label: "Parcourir le catalogue", href: "/films" },
      { label: "Derniers ajouts", href: "/films?sort=newest" },
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
  async (state: HomepageState, dayKey: string): Promise<HeroData> => {
    void dayKey // included in the cache key so the day rotation invalidates
    if (state === "tonight") return fetchTonight()
    if (state === "weekend") return fetchWeekend()
    if (state === "holidays") return fetchHolidays()
    return fetchDefault()
  },
  ["homepage-hero-rail-v1"],
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

export async function ApercuTimeAwareHero({ serifClass }: { serifClass: string }) {
  const ctx = await resolveContext()
  const data = await getHeroData(ctx.state, ctx.parisIsoDay)
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
