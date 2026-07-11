import type { Prisma } from "@prisma/client"
import { computeGenreScore, computeInterestsScore } from "@/lib/family-fit-score"
import { personalizedScore, EMPTY_VECTOR, type MemberVector } from "@/lib/preference-vector"
import type { SignedAffinity } from "@/lib/reaction-affinity"

/**
 * Taste-only fit scoring for UPCOMING (pre-release) titles.
 *
 * Released titles are scored by the full family-fit engine, but upcoming
 * titles have no ContentMetrics — `shouldHideContentAnalysis` makes
 * batch-family-fit / runSmartFilter return nothing for them. So here we score
 * on the axes that exist before release only: genre, interests, the learned
 * behavioral vector, and (optionally) signed affinity. No sensitivity /
 * mature-penalty / hard age gate — those need content metrics we don't have.
 */

export interface UpcomingScorable {
  genres: string[]
  topics?: string[]
  expertAgeRec: number | null
}

export interface UpcomingMemberProfile {
  favoriteGenres: string[]
  dislikedGenres: string[]
  interests: string[]
  memberVector: MemberVector
  age: number | null
}

export interface UpcomingFitResult {
  /** 0..1 family-taste fit for this member. */
  fit: number
  /** True when a disliked genre floors the title for this member. */
  excluded: boolean
}

/** Coerce a stored FamilyMember.memberVector JSON into a usable MemberVector. */
export function coerceMemberVector(raw: Prisma.JsonValue | null | undefined): MemberVector {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_VECTOR
  const v = raw as Record<string, unknown>
  if (typeof v.evidenceCount !== "number" || typeof v.genreWeights !== "object") return EMPTY_VECTOR
  return raw as unknown as MemberVector
}

// A member counts as a minor for the age gate below when their age is known
// and under 18. Members with an UNKNOWN age are handled by the family-level
// gate in the route (which drops null-age / 16+ candidates whenever the
// household isn't all-adult), so here an unknown age simply skips the per-
// member upper bound rather than guessing.
export function scoreUpcomingForMember(
  item: UpcomingScorable,
  member: UpcomingMemberProfile,
  signedAffinity?: SignedAffinity | null,
): UpcomingFitResult {
  const genre = computeGenreScore(item.genres, member.favoriteGenres, member.dislikedGenres)
  // Hard opt-out: a disliked genre floors the title — same rule the released
  // family-fit uses, so "pas intéressé par X" is respected pre-release too.
  if (genre === 0) return { fit: 0, excluded: true }

  // Hard age gate (replaces the former soft ×0.5). Upcoming titles have NO
  // content metrics, so age is the ONLY safety signal — a soft down-weight let
  // a mature title still surface when the taste match was strong. A MINOR only
  // "fits" a title they're old enough for: an unknown age (can't verify) or a
  // title more than 2 years above their age excludes them.
  if (member.age != null && member.age < 18) {
    if (item.expertAgeRec == null || item.expertAgeRec > member.age + 2) {
      return { fit: 0, excluded: true }
    }
  }

  const interest = computeInterestsScore(item.topics ?? [], [], member.interests)
  const perso = personalizedScore(member.memberVector, { genres: item.genres, topics: item.topics ?? [] })
  const affin = signedAffinity?.score ?? 0.5

  const fit = 0.45 * genre + 0.2 * interest + 0.2 * perso + 0.15 * affin

  return { fit, excluded: false }
}
