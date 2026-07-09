import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runSmartFilter } from "@/lib/smart-filter"
import { resolveHomepageTimeContext, type HomepageState } from "@/lib/homepage-time-context"
import { getHolidayCalendar } from "@/lib/school-holidays"
import { getMemberAge } from "@/lib/age-utils"

// "Ce soir" — a time-aware, multi-type (films + séries + jeux) family
// consensus. Runs the smart-filter engine once per type for the WHOLE family
// (non-strict average, so mixed-age families still get results), then merges
// by a moment-appropriate ratio. Personalized → per-request, never cached.
export const dynamic = "force-dynamic"

// How many of each type to blend, by moment. Weeknights lean séries + jeux;
// the weekend leans films (mirrors the homepage TOP_MIX intent).
const TONIGHT_MIX: Record<HomepageState, { MOVIE: number; TV: number; GAME: number }> = {
  weekend: { MOVIE: 7, TV: 3, GAME: 2 },
  holidays: { MOVIE: 4, TV: 4, GAME: 4 },
  tonight: { MOVIE: 4, TV: 5, GAME: 3 },
  default: { MOVIE: 5, TV: 4, GAME: 3 },
}

const RESULT_LIMIT = 12
const MIN_SCORE = 55

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ items: [], state: "default" })

  const members = await prisma.familyMember.findMany({
    where: { userId: session.user.id },
    select: { id: true, birthYear: true, birthMonth: true },
  })
  if (members.length === 0) return NextResponse.json({ items: [], state: "default" })

  const memberIds = members.map((m) => m.id)
  const ages = members
    .map((m) => getMemberAge(m.birthYear, m.birthMonth))
    .filter((a): a is number => a !== null)
  const maxAge = ages.length ? Math.min(...ages) : undefined

  const holidays = await getHolidayCalendar().catch(() => [])
  const { state } = resolveHomepageTimeContext(new Date(), holidays)
  const mix = TONIGHT_MIX[state]

  const base = {
    userId: session.user.id,
    familyMemberIds: memberIds,
    strictMode: false as const, // average — avoids empty results for mixed ages
    minScore: MIN_SCORE,
    requirePoster: true,
    maxAge,
    limit: 20,
  }

  const [movie, tv, game] = await Promise.all([
    runSmartFilter({ ...base, mediaType: "MOVIE" }),
    runSmartFilter({ ...base, mediaType: "TV" }),
    runSmartFilter({ ...base, mediaType: "GAME" }),
  ])

  const take = (r: Awaited<ReturnType<typeof runSmartFilter>>, n: number) =>
    (r?.results ?? []).slice(0, n).map((x) => ({
      id: x.mediaId,
      type: x.type,
      title: x.title,
      posterUrl: x.posterUrl,
      expertAgeRec: x.expertAgeRec,
      genres: x.genres,
      familyScore: x.familyScore,
    }))

  const merged = [
    ...take(movie, mix.MOVIE),
    ...take(tv, mix.TV),
    ...take(game, mix.GAME),
  ]

  const seen = new Set<string>()
  const items = merged
    .filter((it) => {
      if (seen.has(it.id)) return false
      seen.add(it.id)
      return true
    })
    .sort((a, b) => b.familyScore - a.familyScore)
    .slice(0, RESULT_LIMIT)

  return NextResponse.json({ items, state })
}
