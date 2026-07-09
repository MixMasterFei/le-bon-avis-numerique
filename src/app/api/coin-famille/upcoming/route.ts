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
      favoriteGenres: true,
      dislikedGenres: true,
      interests: true,
      memberVector: true,
      birthYear: true,
      birthMonth: true,
    },
  })
  if (members.length === 0) return NextResponse.json({ items: [] })

  const profiles: UpcomingMemberProfile[] = members.map((m) => ({
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

  const scored = candidates
    .map((c) => {
      let best = 0
      let anyIncluded = false
      for (const p of profiles) {
        const r = scoreUpcomingForMember(
          { genres: c.genres, topics: c.topics, expertAgeRec: c.expertAgeRec },
          p,
        )
        if (!r.excluded) anyIncluded = true
        if (r.fit > best) best = r.fit
      }
      return { c, fit: best, anyIncluded }
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
    .slice(0, RESULT_LIMIT)

  const items = scored.map((s) => ({
    id: s.c.id,
    type: s.c.type,
    title: s.c.title,
    posterUrl: s.c.posterUrl,
    expertAgeRec: s.c.expertAgeRec,
    genres: s.c.genres,
    releaseDate: s.c.releaseDate,
  }))

  return NextResponse.json({ items })
}
