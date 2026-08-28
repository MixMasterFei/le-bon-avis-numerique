import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import dynamic from "next/dynamic"
import { getMemberAge } from "@/lib/age-utils"
import { getWeekSeed, seededShuffle } from "@/lib/seeded-shuffle"
import { inSeason } from "@/lib/seasonal"
import { HomepageApercu } from "@/components/home-v2/HomepageApercu"
import { ApercuTimeAwareHero } from "@/components/home-v2/ApercuTimeAwareHero"
import { AdminVariantToggle } from "@/components/home-redesign/AdminVariantToggle"
import { v2Enabled } from "@/lib/v2-flag"
import { resolveHomepageTimeContext, type HomepageState } from "@/lib/homepage-time-context"
import { getHolidayCalendar } from "@/lib/school-holidays"
import { getExpertPicks } from "@/lib/expert-picks"

// V2 redesign is admin-only and dynamically imported so its chunk + the
// three design fonts never ship to anonymous visitors.
const HomepageRedesign = dynamic(() =>
  import("@/components/home-redesign/HomepageRedesign").then((m) => m.HomepageRedesign),
)

/**
 * Weekly family-friendly poster set for the V2 hero wall. Cached per ISO
 * week (the seed is part of the cache key), so the recognizable set rotates
 * every Monday — same cron-free rotation pattern used elsewhere on the
 * homepage. Family-friendly = low age + low sensitivity, popular first.
 */
const getHeroWallPosters = unstable_cache(
  async (_weekSeed: number) => {
    const pool = await prisma.mediaItem.findMany({
      where: {
        posterUrl: { not: null, startsWith: "http" },
        isEnriched: true,
        expertAgeRec: { not: null, lte: 10 },
        type: { in: ["MOVIE", "TV", "GAME"] },
        dataQualityScore: { gte: 60 },
        contentMetrics: { violence: { lte: 2 }, sexNudity: { lte: 1 } },
      },
      select: { posterUrl: true, title: true, genres: true, topics: true },
      orderBy: { tmdbVoteCount: "desc" },
      take: 120,
    })
    // Seasonal gate: the 120-poster family pool is dense with Noël titles
    // (L'Étrange Noël de monsieur Jack, Maman j'ai encore raté l'avion…), so
    // without this the weekly shuffle regularly planted a Christmas poster in
    // the August hero wall — the first image a visitor sees.
    const urls = pool
      .filter(inSeason())
      .map((p) => p.posterUrl)
      .filter((u): u is string => !!u)
    return seededShuffle(urls, _weekSeed).slice(0, 32)
  },
  ["home-v2-hero-wall"],
  { revalidate: 86400 },
)

/**
 * Hero showcase (5 tilted poster cards + catalog-count badge), fetched
 * server-side and passed down as props so the posters ship in the initial
 * HTML. This stack is the desktop LCP element — when it was fetched client-
 * side (post-hydration useEffect), the homepage's desktop LCP score sat in
 * the "Poor" band while the rest of the site scored green.
 */
const getHeroShowcase = unstable_cache(
  async (_weekSeed: number) => {
    const [picks, movies, series, games] = await Promise.all([
      getExpertPicks({ limit: 8, seed: _weekSeed }),
      prisma.mediaItem.count({ where: { type: "MOVIE" } }),
      prisma.mediaItem.count({ where: { type: "TV" } }),
      prisma.mediaItem.count({ where: { type: "GAME" } }),
    ])
    return {
      picks: picks
        .filter((p) => p.posterUrl)
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          type: (p.type === "TV" || p.type === "GAME" ? p.type : "MOVIE") as
            | "MOVIE"
            | "TV"
            | "GAME",
          title: p.title,
          posterUrl: p.posterUrl,
          expertAgeRec: p.expertAgeRec,
          genres: p.genres,
        })),
      totalCatalog: movies + series + games,
    }
  },
  ["home-hero-showcase"],
  { revalidate: 1800 },
)

/**
 * Picks the age cap the time-aware hero should respect.
 *
 * Rule (per product): if the logged-in user has family members,
 * use the YOUNGEST minor's age. The "en famille" framing means
 * "everyone in the room can watch together", so the smallest
 * viewer defines the ceiling. Older siblings discover content
 * elsewhere on the site, not in this co-viewing rail. Adult
 * members (18+) are ignored. No family or no minors → null
 * (caller falls back to FAMILY_AGE_CAP).
 */
async function resolveFamilyAgeCap(userId: string): Promise<number | null> {
  try {
    const members = await prisma.familyMember.findMany({
      where: { userId },
      select: { birthYear: true, birthMonth: true },
    })
    if (members.length === 0) return null
    const ages = members
      .map((m) => getMemberAge(m.birthYear, m.birthMonth))
      .filter((a): a is number => typeof a === "number" && a >= 0 && a < 18)
    if (ages.length === 0) return null
    return Math.min(...ages)
  } catch {
    return null
  }
}

/**
 * Paris-time homepage state (tonight / weekend / holidays / default), used to
 * label the first content rail. Resolved per request — the page is already
 * dynamic (auth() reads cookies) — so it never goes stale.
 */
async function resolveHomepageState(): Promise<HomepageState> {
  try {
    const holidays = await getHolidayCalendar()
    return resolveHomepageTimeContext(new Date(), holidays).state
  } catch {
    return resolveHomepageTimeContext(new Date()).state
  }
}

/** User-chosen family display name ("Famille Dupont") for the hero greeting.
 *  Try/catch doubles as the deploy-order guard while sql/add_family_name.sql
 *  hasn't been applied yet — the greeting just falls back to the account name. */
async function getFamilyDisplayName(userId: string): Promise<string | null> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { familyName: true },
    })
    return u?.familyName ?? null
  } catch {
    return null
  }
}

/** Family members for the V2 hero "Votre famille sur mesure" shortcuts. */
async function getFamilyMembersLite(userId: string) {
  try {
    return await prisma.familyMember.findMany({
      where: { userId },
      select: { id: true, name: true, birthYear: true, birthMonth: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })
  } catch {
    return []
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ v?: string }>
}) {
  const session = await auth()
  const isLoggedIn = !!session?.user
  const isAdmin = session?.user?.role === "ADMIN"
  const sp = (await searchParams) ?? {}

  const maxAgeCap = session?.user?.id ? await resolveFamilyAgeCap(session.user.id) : null

  // V2 is admin-only until HOMEPAGE_V2_PUBLIC=true (see @/lib/v2-flag).
  // `?v=classic` always shows the current homepage.
  const showV2 = v2Enabled(isAdmin) && sp.v !== "classic"

  if (showV2) {
    const [heroPosters, familyMembers, homepageState, familyDisplayName] = await Promise.all([
      getHeroWallPosters(getWeekSeed()),
      session?.user?.id ? getFamilyMembersLite(session.user.id) : Promise.resolve([]),
      resolveHomepageState(),
      session?.user?.id ? getFamilyDisplayName(session.user.id) : Promise.resolve(null),
    ])
    return (
      <>
        <HomepageRedesign
          isLoggedIn={isLoggedIn}
          userName={session?.user?.name ?? null}
          familyDisplayName={familyDisplayName}
          heroPosters={heroPosters}
          defaultMaxAge={maxAgeCap ?? 12}
          familyMembers={familyMembers}
          homepageState={homepageState}
        />
        <AdminVariantToggle variant="v2" />
      </>
    )
  }

  // Time-aware hero is built server-side here and passed down as a
  // slot. HomepageApercu is "use client", so async server components
  // can't be imported there directly — only composed in via prop.
  const topSlot = <ApercuTimeAwareHero serifClass="font-serif" maxAgeCap={maxAgeCap} />

  const heroShowcase = await getHeroShowcase(getWeekSeed())

  return (
    <>
      <HomepageApercu
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
        serifClass="font-serif"
        topSlot={topSlot}
        heroPicks={heroShowcase.picks}
        heroCatalogCount={heroShowcase.totalCatalog}
      />
      {isAdmin && <AdminVariantToggle variant="classic" />}
    </>
  )
}
