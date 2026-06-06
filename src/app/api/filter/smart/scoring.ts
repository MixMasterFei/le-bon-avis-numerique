import { getMemberAge } from "@/lib/age-utils"

export interface MemberPreferences {
  id: string
  name: string
  birthYear: number | null
  birthMonth: number | null
  sensitivityViolence: number
  sensitivityScary: number
  sensitivitySexual: number
  sensitivityLanguage: number
  sensitivitySubstances: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  favoriteGenres: string[]
  dislikedGenres: string[]
  avoidTopics: string[]
  interests: string[]
}

export interface MediaForScoring {
  expertAgeRec: number | null
  violence: number
  sexNudity: number
  language: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
  genres: string[]
  topics: string[]
  emotionalThemes: string[]
}

export interface WhereClauseInput {
  mediaType: string
  members: Pick<MemberPreferences, "dislikedGenres">[]
  genres?: string[]
  platforms?: string[]
  topics?: string[]
  search?: string
  requirePoster?: boolean
  language?: string
  minAge?: number
  maxAge?: number
  youngestAge: number | null
  strictMode: boolean
}

// Builds the Prisma where-clause used by the smart filter route. Pure function
// so it can be unit-tested without a DB. Mirrors the behavior the route used to
// inline — kept here for testability.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSmartFilterWhere(input: WhereClauseInput): Record<string, any> {
  // Per-member scoring relies on ContentMetrics (violence, scary, …). Provisional
  // (not-yet-enriched) films have no metrics, so they'd score as falsely safe —
  // never let them through the family filter. Smart filtering stays expert-only.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { type: input.mediaType, isEnriched: true }

  if (typeof input.maxAge === "number") {
    where.expertAgeRec = { ...(where.expertAgeRec || {}), lte: input.maxAge }
  } else if (input.youngestAge !== null) {
    where.expertAgeRec = { lte: input.youngestAge + 3 }
  }
  if (typeof input.minAge === "number" && input.minAge > 0) {
    where.expertAgeRec = { ...(where.expertAgeRec || {}), gte: input.minAge }
  }

  if (input.genres && input.genres.length > 0) {
    where.genres = { hasSome: input.genres }
  }

  // In strict mode, hard-exclude any genre that any selected member dislikes.
  // The quiz writes "Horreur"/"Thriller" to dislikedGenres, and parents expect
  // those to be filtered out — not just score-penalised.
  if (input.strictMode) {
    const blockedGenres = Array.from(
      new Set(input.members.flatMap(m => m.dislikedGenres))
    )
    if (blockedGenres.length > 0) {
      where.NOT = [
        ...(where.NOT || []),
        { genres: { hasSome: blockedGenres } },
      ]
    }
  }

  if (input.platforms && input.platforms.length > 0) {
    where.platforms = { hasSome: input.platforms }
  }

  if (input.topics && input.topics.length > 0) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { topics: { hasSome: input.topics } },
          { genres: { hasSome: input.topics } },
        ],
      },
    ]
  }

  if (input.search && input.search.trim().length >= 2) {
    where.title = { contains: input.search.trim(), mode: "insensitive" }
  }

  if (input.requirePoster) {
    where.posterUrl = { not: null }
  }

  if (input.language) {
    const langs = input.language.split(",").map((l: string) => l.trim()).filter(Boolean)
    if (langs.length > 0) {
      where.originalLanguage = { in: langs }
    }
  }

  return where
}

// Calculates a 0-100 compatibility score for a single family member against a
// media item. Pure function (no I/O), safe to unit-test. strictMode tightens
// the age penalty so a movie one year above the member's age is meaningfully
// downweighted instead of slipping through with no penalty.
export function calculateMemberScore(
  member: MemberPreferences,
  media: MediaForScoring,
  strictMode: boolean = false,
): { score: number; concerns: string[] } {
  let score = 100
  const concerns: string[] = []

  const memberAge = getMemberAge(member.birthYear, member.birthMonth)

  if (memberAge !== null && media.expertAgeRec !== null) {
    const ageDiff = media.expertAgeRec - memberAge
    if (ageDiff > 3) {
      score -= 40
      concerns.push(`Contenu recommandé ${media.expertAgeRec}+ ans (enfant: ${memberAge} ans)`)
    } else if (ageDiff > 1) {
      score -= 20
      concerns.push(`Un peu mature pour ${memberAge} ans`)
    } else if (strictMode && ageDiff > 0) {
      score -= 15
      concerns.push(`Un peu mature pour ${memberAge} ans`)
    } else if (ageDiff < -5) {
      score -= 10
      concerns.push("Contenu potentiellement trop jeune")
    }
  }

  const sensitivityChecks = [
    { name: "Violence", memberSensitivity: member.sensitivityViolence, contentLevel: media.violence },
    { name: "Contenu sexuel", memberSensitivity: member.sensitivitySexual, contentLevel: media.sexNudity },
    { name: "Langage", memberSensitivity: member.sensitivityLanguage, contentLevel: media.language },
    { name: "Drogues/Alcool", memberSensitivity: member.sensitivitySubstances, contentLevel: media.substanceUse },
  ]

  for (const check of sensitivityChecks) {
    if (check.memberSensitivity === 0) continue
    const maxAllowedLevel = 4 - check.memberSensitivity
    if (check.contentLevel > maxAllowedLevel) {
      const excess = check.contentLevel - maxAllowedLevel
      score -= excess * 15
      if (check.contentLevel >= 4) {
        concerns.push(`${check.name} elevé(e) (${check.contentLevel}/5)`)
      } else if (check.contentLevel >= 3) {
        concerns.push(`${check.name} modéré(e)`)
      }
    }
  }

  if (member.sensitivityScary > 0) {
    const scaryIndicators = media.topics.some(t =>
      ["Horreur", "Thriller", "Zombies", "Fantômes", "Halloween"].includes(t)
    ) || media.genres.some(g => ["Horreur", "Thriller"].includes(g))

    if (scaryIndicators && member.sensitivityScary >= 2) {
      score -= 25
      concerns.push("Contenu potentiellement effrayant")
    }
  }

  const positiveChecks = [
    { name: "Messages positifs", preference: member.preferPositiveMessages, contentLevel: media.positiveMessages },
    { name: "Modèles de comportement", preference: member.preferRoleModels, contentLevel: media.roleModels },
  ]

  for (const check of positiveChecks) {
    if (check.preference === 0) continue
    if (check.preference === 3 && check.contentLevel < 3) {
      score -= 10
    } else if (check.contentLevel >= 4) {
      score += 5
    }
  }

  if (member.preferEducational >= 2) {
    const isEducational = media.topics.includes("Éducatif") || media.genres.includes("Documentaire")
    if (isEducational) {
      score += 10
    }
  }

  const genreBoost = member.favoriteGenres.filter(g => media.genres.includes(g)).length * 5
  const genrePenalty = member.dislikedGenres.filter(g => media.genres.includes(g)).length * 15
  score += genreBoost - genrePenalty

  if (genrePenalty > 0) {
    const dislikedFound = member.dislikedGenres.filter(g => media.genres.includes(g))
    concerns.push(`Genre non apprécié: ${dislikedFound.join(", ")}`)
  }

  if (member.interests.length > 0) {
    const normalise = (s: string) => s.toLowerCase().trim()
    const mediaTagSet = new Set([...media.topics, ...media.emotionalThemes].map(normalise))
    const matching = member.interests.filter((i) => mediaTagSet.has(normalise(i))).length
    score += matching * 5
  }

  const avoidedTopicsFound = member.avoidTopics.filter(t =>
    media.topics.includes(t) || media.genres.includes(t)
  )
  if (avoidedTopicsFound.length > 0) {
    score -= avoidedTopicsFound.length * 25
    concerns.push(`Thème à éviter: ${avoidedTopicsFound.join(", ")}`)
  }

  score = Math.max(0, Math.min(100, score))

  return { score, concerns }
}
