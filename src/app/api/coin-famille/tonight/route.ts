import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runSmartFilter, type SmartFilterResultItem } from "@/lib/smart-filter"
import { resolveHomepageTimeContext, type HomepageState } from "@/lib/homepage-time-context"
import { getHolidayCalendar } from "@/lib/school-holidays"
import { getMemberAge } from "@/lib/age-utils"
import { getDaySeed, seededShuffle } from "@/lib/seeded-shuffle"

// One request powers both the whole-family selection and every member tab.
// We score one broad candidate pool per media type (3 smart-filter passes total)
// then derive the family/member rankings from the already-computed memberScores.
// This replaces the former 3 × (family + one request per member) workload.
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
const FAMILY_MEMBER_FLOOR = 50
const POOL_PER_TYPE = 100

const NEGATIVE_REACTIONS = new Set(["SCARED", "BORED", "TOO_YOUNG", "TOO_OLD", "NOT_FOR_ME"])

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Keep relevance ordering, but rotate each four-title quality band daily. */
function rotateRanked(
  items: SmartFilterResultItem[],
  score: (item: SmartFilterResultItem) => number,
  seed: number,
): SmartFilterResultItem[] {
  const ranked = [...items].sort((a, b) => score(b) - score(a))
  const rotated: SmartFilterResultItem[] = []
  for (let index = 0; index < ranked.length; index += 4) {
    rotated.push(...seededShuffle(ranked.slice(index, index + 4), seed + index))
  }
  return rotated
}

function memberScore(item: SmartFilterResultItem, memberId: string): number {
  return item.memberScores.find((score) => score.memberId === memberId)?.score ?? 0
}

function memberReason(item: SmartFilterResultItem, member: { id: string; name: string; favoriteGenres: string[] }): string {
  const favorite = item.genres.find((genre) =>
    member.favoriteGenres.some((candidate) => candidate.toLowerCase() === genre.toLowerCase()),
  )
  if (favorite) return `${member.name} aime les contenus ${favorite.toLowerCase()}`
  const score = memberScore(item, member.id)
  return score >= 80 ? `Très bon accord pour ${member.name}` : `Choisi pour ${member.name}`
}

function familyReason(item: SmartFilterResultItem, memberNames: Map<string, string>): string {
  const adapted = item.memberScores
    .filter((score) => score.score >= 70)
    .map((score) => memberNames.get(score.memberId))
    .filter((name): name is string => Boolean(name))
  if (adapted.length === item.memberScores.length) return "Bon choix pour tout le foyer"
  if (adapted.length === 1) return `Particulièrement adapté à ${adapted[0]}`
  if (adapted.length > 1) return `Adapté à ${adapted.slice(0, 2).join(" et ")}`
  return "Un bon compromis familial"
}

function mixByMoment(
  pools: Record<"MOVIE" | "TV" | "GAME", SmartFilterResultItem[]>,
  mix: Record<"MOVIE" | "TV" | "GAME", number>,
  state: HomepageState,
): SmartFilterResultItem[] {
  const queues = {
    MOVIE: pools.MOVIE.slice(0, mix.MOVIE),
    TV: pools.TV.slice(0, mix.TV),
    GAME: pools.GAME.slice(0, mix.GAME),
  }
  const order: ("MOVIE" | "TV" | "GAME")[] =
    state === "tonight"
      ? ["TV", "MOVIE", "GAME"]
      : state === "holidays"
        ? ["MOVIE", "GAME", "TV"]
        : ["MOVIE", "TV", "GAME"]
  const result: SmartFilterResultItem[] = []
  while (result.length < RESULT_LIMIT && order.some((type) => queues[type].length > 0)) {
    for (const type of order) {
      const next = queues[type].shift()
      if (next) result.push(next)
    }
  }
  return result
}

function toItem(item: SmartFilterResultItem, cornerLabel: string) {
  return {
    id: item.mediaId,
    type: item.type,
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec,
    genres: item.genres,
    familyScore: item.familyScore,
    cornerLabel,
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({
      state: "default",
      day: "",
      subtitle: "",
      familyItems: [],
      memberSections: [],
    })
  }

  const allMembers = await prisma.familyMember.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      birthYear: true,
      birthMonth: true,
      favoriteGenres: true,
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  })
  if (allMembers.length === 0) {
    return NextResponse.json({
      state: "default",
      day: "",
      subtitle: "",
      familyItems: [],
      memberSections: [],
    })
  }

  const memberIds = allMembers.map((member) => member.id)
  const ages = allMembers
    .map((m) => getMemberAge(m.birthYear, m.birthMonth))
    .filter((a): a is number => a !== null)
  // Query a broad enough pool for older-member tabs. The family rail applies
  // its own all-member score floor below, so mature titles cannot leak there.
  const maxAge = ages.length ? Math.min(18, Math.max(...ages) + 3) : undefined

  const holidays = await getHolidayCalendar().catch(() => [])
  const context = resolveHomepageTimeContext(new Date(), holidays)
  const { state } = context
  const mix = TONIGHT_MIX[state]
  const seed = (getDaySeed() + hashString(session.user.id)) >>> 0

  const base = {
    userId: session.user.id,
    familyMemberIds: memberIds,
    strictMode: false as const, // average — avoids empty results for mixed ages
    minScore: 0,
    requirePoster: true,
    maxAge,
    limit: POOL_PER_TYPE,
    take: 600,
  }

  const [movie, tv, game, reactions] = await Promise.all([
    runSmartFilter({ ...base, mediaType: "MOVIE" }),
    runSmartFilter({ ...base, mediaType: "TV" }),
    runSmartFilter({ ...base, mediaType: "GAME" }),
    prisma.mediaReaction.findMany({
      where: { familyMemberId: { in: memberIds } },
      select: { familyMemberId: true, mediaId: true, reaction: true },
    }),
  ])

  const rawPools = {
    MOVIE: movie?.results ?? [],
    TV: tv?.results ?? [],
    GAME: game?.results ?? [],
  }
  const reactedByMember = new Map<string, Set<string>>()
  const reactedMembersByMedia = new Map<string, Set<string>>()
  const familyNegative = new Set<string>()
  for (const reaction of reactions) {
    const memberSet = reactedByMember.get(reaction.familyMemberId) ?? new Set<string>()
    memberSet.add(reaction.mediaId)
    reactedByMember.set(reaction.familyMemberId, memberSet)
    const mediaSet = reactedMembersByMedia.get(reaction.mediaId) ?? new Set<string>()
    mediaSet.add(reaction.familyMemberId)
    reactedMembersByMedia.set(reaction.mediaId, mediaSet)
    if (NEGATIVE_REACTIONS.has(reaction.reaction)) familyNegative.add(reaction.mediaId)
  }

  const familyEligible = (item: SmartFilterResultItem) =>
    item.familyScore >= MIN_SCORE &&
    item.memberScores.every((score) => score.score >= FAMILY_MEMBER_FLOOR) &&
    !familyNegative.has(item.mediaId) &&
    (reactedMembersByMedia.get(item.mediaId)?.size ?? 0) < allMembers.length
  const familyPools = {
    MOVIE: rotateRanked(rawPools.MOVIE.filter(familyEligible), (item) => item.familyScore, seed + 11),
    TV: rotateRanked(rawPools.TV.filter(familyEligible), (item) => item.familyScore, seed + 23),
    GAME: rotateRanked(rawPools.GAME.filter(familyEligible), (item) => item.familyScore, seed + 37),
  }
  const names = new Map(allMembers.map((member) => [member.id, member.name]))
  const familyItems = mixByMoment(familyPools, mix, state).map((item) =>
    toItem(item, familyReason(item, names)),
  )

  const memberSections = allMembers.map((member, memberIndex) => {
    const eligible = (item: SmartFilterResultItem) =>
      memberScore(item, member.id) >= MIN_SCORE &&
      !reactedByMember.get(member.id)?.has(item.mediaId)
    const memberPools = {
      MOVIE: rotateRanked(
        rawPools.MOVIE.filter(eligible),
        (item) => memberScore(item, member.id),
        seed + 101 + memberIndex,
      ),
      TV: rotateRanked(
        rawPools.TV.filter(eligible),
        (item) => memberScore(item, member.id),
        seed + 211 + memberIndex,
      ),
      GAME: rotateRanked(
        rawPools.GAME.filter(eligible),
        (item) => memberScore(item, member.id),
        seed + 307 + memberIndex,
      ),
    }
    return {
      id: member.id,
      name: member.name,
      items: mixByMoment(memberPools, mix, state).map((item) =>
        toItem(item, memberReason(item, member)),
      ),
    }
  })

  return NextResponse.json({
    state,
    day: context.parisIsoDay,
    subtitle: context.subtitle,
    familyItems,
    memberSections,
  })
}
