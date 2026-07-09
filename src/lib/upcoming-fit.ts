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

export function scoreUpcomingForMember(
  item: UpcomingScorable,
  member: UpcomingMemberProfile,
  signedAffinity?: SignedAffinity | null,
): UpcomingFitResult {
  const genre = computeGenreScore(item.genres, member.favoriteGenres, member.dislikedGenres)
  // Hard opt-out: a disliked genre floors the title — same rule the released
  // family-fit uses, so "pas intéressé par X" is respected pre-release too.
  if (genre === 0) return { fit: 0, excluded: true }

  const interest = computeInterestsScore(item.topics ?? [], [], member.interests)
  const perso = personalizedScore(member.memberVector, { genres: item.genres, topics: item.topics ?? [] })
  const affin = signedAffinity?.score ?? 0.5

  let fit = 0.45 * genre + 0.2 * interest + 0.2 * perso + 0.15 * affin

  // Soft, provisional age gate — down-weight (never drop) a title that looks
  // too old for the member. The estimate is provisional until enrichment, so a
  // hard block would wrongly hide titles.
  if (item.expertAgeRec != null && member.age != null && item.expertAgeRec > member.age + 2) {
    fit *= 0.5
  }

  return { fit, excluded: false }
}
