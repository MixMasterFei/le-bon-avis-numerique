import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UNRELEASED_TMDB_STATUSES } from "@/lib/release-status"
import { getUpcomingCinemaMovies } from "@/lib/cinema"
import { getMemberAge } from "@/lib/age-utils"
import {
  scoreUpcomingForMember,
  coerceMemberVector,
  type UpcomingMemberProfile,
} from "@/lib/upcoming-fit"
import { getDaySeed, seededShuffle } from "@/lib/seeded-shuffle"

// "Bientôt pour vous" — upcoming films/séries/jeux ranked by the family's
// TASTE (genre / interests / learned vector), since pre-release titles carry
// no content metrics to score on. Personalized → per-request, never cached.
export const dynamic = "force-dynamic"

const CANDIDATE_LIMIT = 24
const RESULT_LIMIT = 12
// Below this, a title isn't a good-enough taste match to surface as "pour
// vous". Families with no preferences degrade to a soonest-first list (still
// useful), rich profiles get a genuinely tailored order.
const FIT_THRESHOLD = 0.45

type OutType = "MOVIE" | "TV" | "GAME"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ items: [] })

  const members = await prisma.familyMember.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      favoriteGenres: true,
      dislikedGenres: true,
      interests: true,
      memberVector: true,
      birthYear: true,
      birthMonth: true,
    },
  })
  if (members.length === 0) return NextResponse.json({ items: [] })

  const profiles: (UpcomingMemberProfile & { id: string; name: string })[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    favoriteGenres: m.favoriteGenres,
    dislikedGenres: m.dislikedGenres,
    interests: m.interests,
    memberVector: coerceMemberVector(m.memberVector),
    age: getMemberAge(m.birthYear, m.birthMonth),
  }))

  const now = new Date()
  const [movies, others] = await Promise.all([
    getUpcomingCinemaMovies(CANDIDATE_LIMIT).catch(() => []),
    prisma.mediaItem
      .findMany({
        where: {
          posterUrl: { not: null, startsWith: "http" },
          type: { in: ["TV", "GAME"] },
          OR: [
            { releaseDate: { gt: now } },
            { AND: [{ releaseDate: null }, { releaseStatus: { in: [...UNRELEASED_TMDB_STATUSES] } }] },
          ],
        },
        select: {
          id: true,
          type: true,
          title: true,
          posterUrl: true,
          expertAgeRec: true,
          genres: true,
          topics: true,
          releaseDate: true,
        },
        orderBy: { releaseDate: "asc" },
        take: CANDIDATE_LIMIT,
      })
      .catch(() => []),
  ])

  interface Candidate {
    id: string
    type: OutType
    title: string
    posterUrl: string | null
    expertAgeRec: number | null
    genres: string[]
    topics: string[]
    releaseDate: string | null
  }

  const candidates: Candidate[] = [
    ...movies.map((m) => ({
      id: m.id,
      type: "MOVIE" as const,
      title: m.title,
      posterUrl: m.posterUrl,
      expertAgeRec: m.expertAgeRec,
      genres: m.genres ?? [],
      topics: [] as string[], // theatrical candidates carry no topics
      releaseDate: m.releaseDate, // YYYY-MM-DD (FR theatrical)
    })),
    ...others.map((m) => ({
      id: m.id,
      type: m.type as OutType,
      title: m.title,
      posterUrl: m.posterUrl,
      expertAgeRec: m.expertAgeRec,
      genres: m.genres ?? [],
      topics: m.topics ?? [],
      releaseDate: m.releaseDate ? m.releaseDate.toISOString() : null,
    })),
  ]

  // Family-level hard age gate (the primary safety net; the per-member gate in
  // scoreUpcomingForMember refines who a kept title is "for"). Upcoming titles
  // have no ContentMetrics, so age is the only signal we can act on. Whenever
  // the household isn't confirmed all-adult (any minor, or any member with an
  // unknown age), drop candidates that are mature (16+) or unrated (null age) —
  // an unrated "coming soon" can't be shown safely to a family with a child.
  const householdNotAllAdult = profiles.some((p) => p.age == null || p.age < 18)
  const ageSafeCandidates = householdNotAllAdult
    ? candidates.filter((c) => typeof c.expertAgeRec === "number" && c.expertAgeRec < 16)
    : candidates

  const scored = ageSafeCandidates
    .map((c) => {
      let best = 0
      let anyIncluded = false
      let bestMember: (typeof profiles)[number] | null = null
      for (const p of profiles) {
        const r = scoreUpcomingForMember(
          { genres: c.genres, topics: c.topics, expertAgeRec: c.expertAgeRec },
          p,
        )
        if (!r.excluded) anyIncluded = true
        if (r.fit > best) {
          best = r.fit
          bestMember = p
        }
      }
      return { c, fit: best, anyIncluded, bestMember }
    })
    // Keep only titles at least one member isn't opted-out of, and that clear
    // the taste bar for the best-fitting member ("any member wants this").
    .filter((s) => s.anyIncluded && s.fit >= FIT_THRESHOLD)
    .sort((a, b) => {
      if (b.fit !== a.fit) return b.fit - a.fit
      if (!a.c.releaseDate) return 1
      if (!b.c.releaseDate) return -1
      return a.c.releaseDate.localeCompare(b.c.releaseDate)
    })
  // Keep fit ordering, but rotate close-quality groups every Paris day so
  // "Bientôt" does not feel frozen between release-calendar updates.
  const daily: typeof scored = []
  const seed = getDaySeed()
  for (let index = 0; index < scored.length; index += 4) {
    daily.push(...seededShuffle(scored.slice(index, index + 4), seed + index))
  }

  const items = daily.slice(0, RESULT_LIMIT).map((s) => {
    const favoriteGenre = s.bestMember
      ? s.c.genres.find((genre) =>
          s.bestMember!.favoriteGenres.some(
            (favorite) => favorite.toLowerCase() === genre.toLowerCase(),
          ),
        )
      : null
    return {
      id: s.c.id,
      type: s.c.type,
      title: s.c.title,
      posterUrl: s.c.posterUrl,
      expertAgeRec: s.c.expertAgeRec,
      genres: s.c.genres,
      releaseDate: s.c.releaseDate,
      fitLabel: s.bestMember
        ? favoriteGenre
          ? `Pour ${s.bestMember.name} · aime ${favoriteGenre.toLowerCase()}`
          : `Choisi pour ${s.bestMember.name}`
        : "Choisi pour votre foyer",
    }
  })

  return NextResponse.json({ items })
}
