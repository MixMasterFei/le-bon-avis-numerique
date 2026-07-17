import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { runSmartFilter, type SmartFilterResultItem } from "@/lib/smart-filter"
import { resolveHomepageTimeContext, type HomepageState } from "@/lib/homepage-time-context"
import { getHolidayCalendar } from "@/lib/school-holidays"
import { getMemberAge } from "@/lib/age-utils"
import { getDaySeed, seededShuffle, weightedSeededOrder } from "@/lib/seeded-shuffle"
import { synopsisHook, type FitReason } from "@/lib/totem-voice"

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

// "Idées du jour" rotation. The old rotateRanked only shuffled WITHIN each
// four-title score band, so the top-fitting titles were the same MEMBERSHIP
// every day (just re-ordered) — which read as "always the same" for a family
// with settled tastes. weightedSeededOrder instead samples the whole eligible
// pool daily, favouring fit but letting any qualified title surface, so the
// selection genuinely changes day to day. `score - SCORE_ROTATION_FLOOR`
// sharpens the fit preference (a 95 is ~9× as likely up front as a 55) while
// keeping real variety.
const SCORE_ROTATION_FLOOR = 50

function rotateByFit(
  items: SmartFilterResultItem[],
  score: (item: SmartFilterResultItem) => number,
  seed: number,
): SmartFilterResultItem[] {
  return weightedSeededOrder(items, (item) => score(item) - SCORE_ROTATION_FLOOR, seed)
}

function memberScore(item: SmartFilterResultItem, memberId: string): number {
  return item.memberScores.find((score) => score.memberId === memberId)?.score ?? 0
}

// Truthful reason, derived from the member's real favorite genres + fit score.
// The client (src/lib/totem-voice.ts) turns it into one plain French sentence,
// so the phrasing lives in one place and can never assert a taste we didn't check.
function memberReason(item: SmartFilterResultItem, member: { id: string; name: string; favoriteGenres: string[] }): FitReason {
  const favorite = item.genres.find((genre) =>
    member.favoriteGenres.some((candidate) => candidate.toLowerCase() === genre.toLowerCase()),
  )
  if (favorite) return { kind: "member-genre", name: member.name, genre: favorite }
  const score = memberScore(item, member.id)
  return score >= 80 ? { kind: "member-strong", name: member.name } : { kind: "member-chosen", name: member.name }
}

function familyReason(item: SmartFilterResultItem, memberNames: Map<string, string>): FitReason {
  const adapted = item.memberScores
    .filter((score) => score.score >= 70)
    .map((score) => memberNames.get(score.memberId))
    .filter((name): name is string => Boolean(name))
  if (adapted.length === item.memberScores.length) return { kind: "family-all" }
  if (adapted.length === 1) return { kind: "family-one", name: adapted[0] }
  if (adapted.length > 1) return { kind: "family-some", names: adapted }
  return { kind: "family-compromise" }
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

function toItem(item: SmartFilterResultItem, reason: FitReason) {
  return {
    id: item.mediaId,
    type: item.type,
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec,
    genres: item.genres,
    familyScore: item.familyScore,
    reason,
    // One-sentence hook so the explanation is specific to this title, not generic.
    synopsis: synopsisHook(item.synopsisFr),
  }
}

// "Les classiques à redécouvrir" — older, well-loved catalog titles that still
// fit the whole foyer. Released ≥ CLASSIC_MIN_AGE_YEARS ago so they read as a
// rediscovery, not just more recent picks; the set rotates daily.
const CLASSIC_MIN_AGE_YEARS = 6
const CLASSICS_COUNT = 6

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({
      state: "default",
      day: "",
      subtitle: "",
      familyItems: [],
      memberSections: [],
      classics: [],
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
      // Tab chips render each member's real avatar next to their name.
      avatarEmoji: true,
      avatarStyle: true,
      avatarSeed: true,
      avatarOptions: true,
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
      classics: [],
    })
  }

  const memberIds = allMembers.map((member) => member.id)
  const ages = allMembers
    .map((m) => getMemberAge(m.birthYear, m.birthMonth))
    .filter((a): a is number => a !== null)
  // Query a broad enough pool for older-member tabs (oldest + 3). Each member's
  // OWN tab is scored per-member below, so this breadth is needed there.
  const maxAge = ages.length ? Math.min(18, Math.max(...ages) + 3) : undefined
  // Deterministic hard cap for the SHARED "en famille" rail + classics, which
  // are watched together and so must be safe for the YOUNGEST child. The old
  // code leaned only on the per-member score floor (50), but the age penalty
  // caps at −40, so a high-taste neutral-metrics title rated a few years above
  // the youngest could still clear it. This gate does not rely on scoring.
  const minorAges = ages.filter((a) => a < 18)
  const familyAgeCap = minorAges.length ? Math.min(...minorAges) + 2 : 18

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
    // Deterministic age cap first — the shared rail must be safe for the
    // youngest regardless of how strong the taste match is.
    item.expertAgeRec != null &&
    item.expertAgeRec <= familyAgeCap &&
    item.familyScore >= MIN_SCORE &&
    item.memberScores.every((score) => score.score >= FAMILY_MEMBER_FLOOR) &&
    !familyNegative.has(item.mediaId) &&
    (reactedMembersByMedia.get(item.mediaId)?.size ?? 0) < allMembers.length
  const familyPools = {
    MOVIE: rotateByFit(rawPools.MOVIE.filter(familyEligible), (item) => item.familyScore, seed + 11),
    TV: rotateByFit(rawPools.TV.filter(familyEligible), (item) => item.familyScore, seed + 23),
    GAME: rotateByFit(rawPools.GAME.filter(familyEligible), (item) => item.familyScore, seed + 37),
  }
  const names = new Map(allMembers.map((member) => [member.id, member.name]))
  const familyItems = mixByMoment(familyPools, mix, state).map((item) =>
    toItem(item, familyReason(item, names)),
  )

  // Derive today's "classiques à redécouvrir" from the same scored pools —
  // family-eligible, not already shown above, and old enough to feel like a
  // rediscovery. Rotate the best-fitting band so the set changes day to day.
  const currentYear = new Date().getFullYear()
  const shownIds = new Set(familyItems.map((item) => item.id))
  const classicCandidates = [...rawPools.MOVIE, ...rawPools.TV, ...rawPools.GAME].filter(
    (item) =>
      familyEligible(item) &&
      !shownIds.has(item.mediaId) &&
      item.releaseDate !== null &&
      item.releaseDate.getFullYear() <= currentYear - CLASSIC_MIN_AGE_YEARS,
  )
  classicCandidates.sort((a, b) => b.familyScore - a.familyScore)
  const classics = seededShuffle(classicCandidates.slice(0, 18), seed + 53)
    .slice(0, CLASSICS_COUNT)
    .map((item) => toItem(item, familyReason(item, names)))

  const memberSections = allMembers.map((member, memberIndex) => {
    const eligible = (item: SmartFilterResultItem) =>
      memberScore(item, member.id) >= MIN_SCORE &&
      !reactedByMember.get(member.id)?.has(item.mediaId)
    const memberPools = {
      MOVIE: rotateByFit(
        rawPools.MOVIE.filter(eligible),
        (item) => memberScore(item, member.id),
        seed + 101 + memberIndex,
      ),
      TV: rotateByFit(
        rawPools.TV.filter(eligible),
        (item) => memberScore(item, member.id),
        seed + 211 + memberIndex,
      ),
      GAME: rotateByFit(
        rawPools.GAME.filter(eligible),
        (item) => memberScore(item, member.id),
        seed + 307 + memberIndex,
      ),
    }
    return {
      id: member.id,
      name: member.name,
      avatarEmoji: member.avatarEmoji,
      avatarStyle: member.avatarStyle,
      avatarSeed: member.avatarSeed,
      avatarOptions: member.avatarOptions,
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
    classics,
  })
}
