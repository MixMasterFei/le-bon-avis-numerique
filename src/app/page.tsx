import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import dynamic from "next/dynamic"
import { getMemberAge } from "@/lib/age-utils"
import { getWeekSeed, seededShuffle } from "@/lib/seeded-shuffle"
import { HomepageApercu } from "@/components/home-v2/HomepageApercu"
import { ApercuTimeAwareHero } from "@/components/home-v2/ApercuTimeAwareHero"
import { AdminVariantToggle } from "@/components/home-redesign/AdminVariantToggle"

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
      select: { posterUrl: true },
      orderBy: { tmdbVoteCount: "desc" },
      take: 120,
    })
    const urls = pool.map((p) => p.posterUrl).filter((u): u is string => !!u)
    return seededShuffle(urls, _weekSeed).slice(0, 32)
  },
  ["home-v2-hero-wall"],
  { revalidate: 86400 },
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

  // Admins see the V2 redesign by default; `?v=classic` shows the current
  // homepage. Everyone else always gets the classic homepage.
  const showV2 = isAdmin && sp.v !== "classic"

  if (showV2) {
    const heroPosters = await getHeroWallPosters(getWeekSeed())
    return (
      <>
        <HomepageRedesign
          isLoggedIn={isLoggedIn}
          heroPosters={heroPosters}
          defaultMaxAge={maxAgeCap ?? 12}
        />
        <AdminVariantToggle variant="v2" />
      </>
    )
  }

  // Time-aware hero is built server-side here and passed down as a
  // slot. HomepageApercu is "use client", so async server components
  // can't be imported there directly — only composed in via prop.
  const topSlot = <ApercuTimeAwareHero serifClass="font-serif" maxAgeCap={maxAgeCap} />

  return (
    <>
      <HomepageApercu
        isLoggedIn={isLoggedIn}
        isAdmin={isAdmin}
        serifClass="font-serif"
        topSlot={topSlot}
      />
      {isAdmin && <AdminVariantToggle variant="classic" />}
    </>
  )
}
