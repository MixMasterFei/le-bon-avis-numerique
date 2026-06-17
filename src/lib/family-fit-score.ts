import { FAMILY_VIP_BRAND_TOPICS_LOWER } from "@/lib/family-vip-brands"
import { normalizeTag } from "@/lib/preference-vector/vocabulary"

export type FitLevel = "excellent" | "good" | "moderate" | "poor"

export interface FitMemberProfile {
  useCustomSettings?: boolean | null
  favoriteGenres?: string[] | null
  dislikedGenres?: string[] | null
  interests?: string[] | null
}

export interface FitMetrics {
  violence: number
  sexNudity: number
  language: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
  toneTags?: string[] | null
  pacing?: string | null
  emotionalThemes?: string[] | null
}

export interface FitPreferenceScores {
  ageScore: number
  sensitivityScore: number
  genreScore: number
  interestsScore: number
  affinityScore: number
  toneScore: number
  positiveScore: number
  avoidScore: number
  // Phase 2 — cosine similarity of the media vector vs. the member's
  // behavioral preference vector. Optional so old callers that haven't
  // wired it yet keep working (neutral 0.5 = no impact on rank).
  personalizedScore?: number
}

// Phase 2 weights for the weighted fit score. Exported so the
// Member Corner transparency panel can render "X% contribution from
// behavioral profile" if we ever want that, and so tests can pin them.
// Tuning rationale:
//   • age + sensitivity stay the dominant signals (mature gates live there).
//   • personalized starts at 10% — enough to differentiate two members with
//     similar quiz answers but different histories, but not so much that it
//     can rescue a disliked-genre title (the hard gate runs first below).
export const FIT_WEIGHTS = {
  ageScore: 0.28,
  sensitivityScore: 0.22,
  genreScore: 0.10,
  interestsScore: 0.08,
  affinityScore: 0.08,
  toneScore: 0.05,
  positiveScore: 0.04,
  avoidScore: 0.05,
  personalizedScore: 0.10,
} as const

export interface FitGuardrailResult {
  score: number
  level: FitLevel
  reasonOverride: string | null
  ageWarning: boolean
  ageUnknown: boolean
}

export const DEFAULT_FIT_METRICS: FitMetrics = {
  violence: 0,
  sexNudity: 0,
  language: 0,
  substanceUse: 0,
  positiveMessages: 3,
  roleModels: 3,
  toneTags: [],
  pacing: null,
  emotionalThemes: [],
}

export const DEFAULT_GENRES_BY_AGE: Record<string, string[]> = {
  child: ["Animation", "Aventure", "Comédie", "Famille", "Fantastique"],
  tween: ["Aventure", "Comédie", "Animation", "Fantastique", "Science-Fiction"],
  teen: ["Comédie", "Aventure", "Science-Fiction", "Fantastique", "Action"],
  adult: ["Comédie", "Drame", "Aventure", "Thriller", "Science-Fiction"],
}

export const GENTLE_TONES = new Set([
  "Doux et chaleureux",
  "Doux et rassurant",
  "Joyeux et coloré",
  "Drôle et léger",
  "Inspiré et motivant",
])

export const DARK_TONES = new Set([
  "Sombre et tendu",
  "Effrayant et angoissant",
  "Action intense",
])

// Stored in accent-folded form so callers comparing via normalizeTag()
// (which folds accents) hit the set correctly. The unfolded "épouvante"
// form used to live here, which silently missed accent-folded lookups.
export const MATURE_GENRES = new Set(["horreur", "horror", "epouvante", "thriller", "crime"])
export const CONCERNING_GENRES = new Set(["horreur", "horror", "crime", "thriller", "épouvante"])
export const CONCERNING_TONES = new Set(["Effrayant et angoissant", "Sombre et tendu", "Action intense"])
const FAMILY_APPEAL_GENRES = new Set(["animation", "famille", "familial", "family"])
const TEEN_APPEAL_GENRES = new Set([
  "action",
  "aventure",
  "adventure",
  "fantastique",
  "fantasy",
  "science-fiction",
  "sci-fi",
  "super-héros",
  "superhero",
])
const ADULT_LEANING_GENRES = new Set([
  "drame",
  "drama",
  "romance",
  "thriller",
  "crime",
  "horreur",
  "horror",
  "épouvante",
])

export function clampScore(score: number): number {
  return Math.round(Math.max(0, Math.min(100, score)))
}

export function levelFromScore(score: number): FitLevel {
  if (score >= 75) return "excellent"
  if (score >= 60) return "good"
  if (score >= 35) return "moderate"
  return "poor"
}

function capLevel(level: FitLevel, maxLevel: FitLevel): FitLevel {
  const rank: Record<FitLevel, number> = { poor: 0, moderate: 1, good: 2, excellent: 3 }
  return rank[level] > rank[maxLevel] ? maxLevel : level
}

/**
 * Does this member have enough signal to deserve a real fit rating (vs. the
 * cautious "à vérifier / À affiner avec le quiz famille" cap)?
 *
 * Deliberately broader than the old quiz-completed check: any curated
 * preference counts — favorite OR disliked genres, interests, or the
 * custom-settings flag (which implies tuned sensitivity). Reaction history is
 * an additional signal the *caller* ORs in (it lives outside the profile).
 *
 * NOTE: this is intentionally NOT `useCustomSettings` alone. That flag means
 * only "override the family sensitivity defaults" and must stay decoupled from
 * the rating gate — conflating the two is exactly the bug that stranded
 * configured members (genres set, flag still off) on "à vérifier".
 */
export function hasActionablePreferences(member: FitMemberProfile): boolean {
  return (
    !!member.useCustomSettings ||
    (member.favoriteGenres?.length ?? 0) > 0 ||
    (member.dislikedGenres?.length ?? 0) > 0 ||
    (member.interests?.length ?? 0) > 0
  )
}

/** @deprecated Use {@link hasActionablePreferences}. Kept as an alias so the
 * scoring routes/tests keep their existing call sites. */
export function hasRichProfile(member: FitMemberProfile): boolean {
  return hasActionablePreferences(member)
}

/**
 * Is the member's profile "fully set up" — curated genres AND tuned sensitivity?
 *
 * This is the OLD strict rating gate, repurposed: it no longer decides whether
 * to rate (that's `hasActionablePreferences`), only whether to still nudge.
 * Three tiers result on the fiche:
 *   - no actionable preferences → age-only score + "Faire le quiz"
 *   - actionable but not complete → real rating + "Compléter le quiz pour affiner"
 *   - complete → real rating, no nudge
 */
export function isProfileComplete(member: FitMemberProfile): boolean {
  return !!member.useCustomSettings && (member.favoriteGenres?.length ?? 0) > 0
}

export function getAgeGroup(age: number | null): keyof typeof DEFAULT_GENRES_BY_AGE {
  if (age == null) return "teen"
  if (age <= 9) return "child"
  if (age <= 12) return "tween"
  if (age <= 17) return "teen"
  return "adult"
}

// Raw age score. The display layer in `applyFitGuardrails` enforces additional
// caps when `expertAgeRec > memberAge` (≤ 65 + "moderate" for any positive gap;
// ≤ 30 + "poor" for gap ≥ 2). Do not duplicate those caps here — the smart
// filter applies its own strict-mode penalty separately, and stacking penalties
// here would create double counting.
export function computeAgeScore(
  expertAgeRec: number | null,
  memberAge: number | null,
  tmdbRating?: number | null,
  genres?: string[],
  topics?: string[],
): number {
  if (expertAgeRec == null || memberAge == null) return 0.5

  if (expertAgeRec > memberAge + 1) return 0.2
  if (expertAgeRec > memberAge) return 0.7

  const gap = memberAge - expertAgeRec
  if (gap <= 3) return 1.0
  if (memberAge >= 16 && expertAgeRec >= 10) return 1.0

  const lowerTopics = (topics || []).map((t) => t.toLowerCase())
  if (lowerTopics.some((t) => FAMILY_VIP_BRAND_TOPICS_LOWER.has(t))) return 1.0

  const lowerGenres = (genres || []).map((g) => g.toLowerCase())
  const isFamilyContent = lowerGenres.some((g) =>
    g === "animation" || g === "famille" || g === "familial" || g === "family"
  )
  if (isFamilyContent) return Math.max(0.75, 1.0 - (gap - 3) * 0.03)

  const rawPenalty = (gap - 3) * 0.10
  let score = Math.max(0.30, 1.0 - rawPenalty)

  const rating = tmdbRating ?? 0
  if (rating >= 7.5) {
    const boost = Math.min(0.25, (rating - 7.5) * 0.15)
    score = Math.min(1.0, score + boost)
  }

  return score
}

export function computeSensitivityScore(
  metrics: Pick<FitMetrics, "violence" | "sexNudity" | "language" | "substanceUse">,
  member: {
    sensitivityViolence: number
    sensitivitySexual: number
    sensitivityLanguage: number
    sensitivitySubstances: number
  },
): number {
  const pairs: [number, number][] = [
    [metrics.violence, member.sensitivityViolence],
    [metrics.sexNudity, member.sensitivitySexual],
    [metrics.language, member.sensitivityLanguage],
    [metrics.substanceUse, member.sensitivitySubstances],
  ]

  let total = 0
  let count = 0
  for (const [metricValue, tolerance] of pairs) {
    // tolerance 0 = "Pas du tout gêné(e)" / "don't care" — skip the pair entirely.
    // Matches the smart filter's pattern in scoring.ts and avoids the prior bug
    // where 0 was inverted into the strictest threshold.
    if (tolerance === 0) continue
    const threshold = 4 - tolerance
    const over = Math.max(0, metricValue - threshold)
    total += Math.max(0, 1 - over * 0.25)
    count++
  }

  return count === 0 ? 1.0 : total / count
}

// Genres that, when present on a media item, soften the dislike-genre gate.
// Rationale: TMDB tags Shrek 2 with "Romance" (Shrek + Fiona) and La Tortue
// rouge with "Drame" (emotional beats) even though both are clearly family
// animations. A kid who picks "j'évite la romance" in the quiz means
// "no adult-romance films" — not "exclude every animation with a romantic
// subplot".
const FAMILY_FRIENDLY_GENRE_MARKERS = new Set([
  "animation", "famille", "familial", "family",
])

export function computeGenreScore(mediaGenres: string[], favoriteGenres: string[], dislikedGenres: string[] = []): number {
  if (favoriteGenres.length === 0 && dislikedGenres.length === 0) return 0.5

  // Use vocabulary normalization (lowercase + accent-fold + FR/EN alias) so a
  // quiz pick like "Stratégie" matches the IGDB catalog's English "Strategy".
  // Plain lowercase used to silently fail across languages.
  const normalise = (s: string) => normalizeTag(s)
  const mediaSet = new Set(mediaGenres.map(normalise))

  // Dislike handling. Three cases:
  //   1. Mature dislike (Horror, Thriller, Crime, Épouvante) → always hard
  //      reject. Kid said "no scary stuff" — that's load-bearing.
  //   2. Soft dislike (Romance, Drame, Comédie, etc.) on a non-family title →
  //      hard reject. Marriage Story is genuinely a drama; that exclusion
  //      stands.
  //   3. Soft dislike on a family-friendly title (has Animation / Familial /
  //      Famille tag) → fall through to favorite scoring with a multiplier.
  //      The title still surfaces with a lower score instead of being
  //      silently hidden, since the dislike likely refers to the *adult*
  //      version of the genre (the parent confirmed this).
  // The exact `0` return is the sentinel that computeWeightedFitScore and
  // the preference-pillar logic read as "hard reject"; only cases 1 + 2
  // ever emit it.
  let softDislikePenalty = 1.0
  if (dislikedGenres.length > 0) {
    const dislikedMatches = dislikedGenres.filter((g) => mediaSet.has(normalise(g)))
    if (dislikedMatches.length > 0) {
      const isMatureDislike = dislikedMatches.some((g) => MATURE_GENRES.has(normalise(g)))
      if (isMatureDislike) {
        return 0
      }
      // Broad TMDB tags (Drame, Romance, Action…) — down-rank only. Parents mean
      // "not their vibe", not "ban every title with this secondary tag".
      softDislikePenalty = Math.max(0.5, 0.75 - dislikedMatches.length * 0.08)
    }
  }

  if (favoriteGenres.length > 0) {
    const matching = favoriteGenres.filter((g) => mediaSet.has(normalise(g))).length
    if (matching === 0) {
      // No favorite-genre overlap is an *absent* positive signal, not a
      // categorical reject. Return a neutral-low value so the weighted-fit
      // sum reflects the missing match without short-circuiting the title
      // out of the member's avatar pills.
      return 0.35 * softDislikePenalty
    }
    const base = Math.min(1.0, matching / Math.max(1, Math.min(3, favoriteGenres.length)))
    return base * softDislikePenalty
  }

  return 0.5 * softDislikePenalty
}

export function computeInterestsScore(mediaTopics: string[], emotionalThemes: string[], memberInterests: string[]): number {
  if (memberInterests.length === 0) return 0.5

  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaTagSet = new Set([...mediaTopics, ...emotionalThemes].map(normalise))
  const matching = memberInterests.filter((i) => mediaTagSet.has(normalise(i))).length

  if (matching === 0) return 0.3
  return Math.min(1.0, 0.4 + matching * 0.2)
}

export function computePositiveContentScore(
  metrics: Pick<FitMetrics, "positiveMessages" | "roleModels">,
  member: { preferPositiveMessages: number; preferRoleModels: number; preferEducational: number },
  mediaTopics: string[],
): number {
  if (member.preferPositiveMessages <= 1 && member.preferRoleModels <= 1 && member.preferEducational <= 1) return 0.5

  let score = 0.5
  if (member.preferPositiveMessages >= 2) {
    if (metrics.positiveMessages >= 4) score += 0.2
    else if (metrics.positiveMessages >= 3) score += 0.1
    else if (member.preferPositiveMessages === 3 && metrics.positiveMessages < 2) score -= 0.15
  }

  if (member.preferRoleModels >= 2) {
    if (metrics.roleModels >= 4) score += 0.2
    else if (metrics.roleModels >= 3) score += 0.1
    else if (member.preferRoleModels === 3 && metrics.roleModels < 2) score -= 0.15
  }

  if (member.preferEducational >= 2) {
    const isEducational = mediaTopics.some((t) => t === "Éducatif" || t === "Documentaire")
    if (isEducational) score += 0.25
    else if (member.preferEducational === 3) score -= 0.1
  }

  return Math.max(0, Math.min(1, score))
}

export function computeAvoidScore(mediaTopics: string[], avoidTopics: string[]): number {
  if (avoidTopics.length === 0) return 1.0

  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaTopics.map(normalise))
  return avoidTopics.some((t) => mediaSet.has(normalise(t))) ? 0 : 1.0
}

export function computeToneScore(toneTags: string[], pacing: string | null, memberAge: number | null, sensitivityScary: number): number {
  if (toneTags.length === 0 && !pacing) return 0.5

  let score = 0.5
  const hasGentle = toneTags.some((t) => GENTLE_TONES.has(t))
  const hasDark = toneTags.some((t) => DARK_TONES.has(t))

  if (memberAge !== null && memberAge < 7) {
    if (hasGentle) score += 0.3
    if (hasDark) score -= 0.4
  } else if (memberAge !== null && memberAge < 13) {
    if (hasGentle) score += 0.15
    if (hasDark && sensitivityScary >= 2) score -= 0.3
    else if (hasDark) score -= 0.1
  } else {
    if (hasGentle) score += 0.05
    if (hasDark && sensitivityScary >= 3) score -= 0.15
  }

  if (pacing && memberAge !== null && memberAge < 5) {
    if (pacing === "Rapide et frénétique") score -= 0.2
    else if (pacing === "Dynamique") score -= 0.05
    else if (pacing === "Très calme" || pacing === "Lent et contemplatif") score += 0.1
  }

  return Math.max(0, Math.min(1, score))
}

export function hasYouthAppealSignal(input: {
  mediaGenres: string[]
  mediaTopics: string[]
  memberAge: number | null
  genreScore?: number
  interestsScore?: number
  affinityScore?: number
  positiveScore?: number
}): boolean {
  if (input.memberAge != null && input.memberAge >= 18) return true

  if ((input.affinityScore ?? 0) >= 0.4) return true
  if ((input.genreScore ?? 0) >= 0.7) return true
  if ((input.interestsScore ?? 0) >= 0.8) return true
  if ((input.positiveScore ?? 0) >= 0.8) return true

  const lowerTopics = input.mediaTopics.map((topic) => topic.toLowerCase())
  if (lowerTopics.some((topic) => FAMILY_VIP_BRAND_TOPICS_LOWER.has(topic))) return true

  const lowerGenres = input.mediaGenres.map((genre) => genre.toLowerCase())
  const adultGenreCount = lowerGenres.filter((genre) => ADULT_LEANING_GENRES.has(genre)).length
  if (lowerGenres.some((genre) => FAMILY_APPEAL_GENRES.has(genre)) && adultGenreCount === 0) return true

  const hasTeenGenre = lowerGenres.some((genre) => TEEN_APPEAL_GENRES.has(genre))
  return input.memberAge != null && input.memberAge >= 13 && hasTeenGenre && adultGenreCount < 2
}

export function isAdultLeaningContentForMinor(input: {
  mediaGenres: string[]
  expertAgeRec: number | null
  memberAge: number | null
  hasYouthAppeal: boolean
}): boolean {
  if (input.memberAge == null || input.memberAge >= 18 || input.hasYouthAppeal) return false

  const lowerGenres = input.mediaGenres.map((genre) => genre.toLowerCase())
  const adultGenreCount = lowerGenres.filter((genre) => ADULT_LEANING_GENRES.has(genre)).length
  return adultGenreCount >= 2 || (input.expertAgeRec != null && input.expertAgeRec >= 13 && adultGenreCount >= 1)
}

// `severity` lets callers distinguish a hard block (member is below the
// recommended age and the content is mature) from a soft caution (member is at
// or above the recommended age, but content has mature signals worth flagging).
// The display layer uses this to keep the "Trop tôt" badge for genuine age
// mismatches only — caution cases get "À vérifier" instead.
export type MatureContentSeverity = "block" | "caution" | null

export interface MatureContentMemberSensitivity {
  violence?: number
  sexual?: number
  // scary / language / substances stay on the sensitivity score; the mature
  // penalty axis is currently violence + sexual + structural mature genre.
}

export function computeMatureContentPenalty(
  mediaGenres: string[],
  metrics: Pick<FitMetrics, "violence" | "sexNudity">,
  expertAgeRec: number | null,
  memberAge: number | null,
  memberSensitivity?: MatureContentMemberSensitivity,
): { multiplier: number; reason: string | null; severity: MatureContentSeverity } {
  const hasMatureGenre = mediaGenres.some((g) => MATURE_GENRES.has(normalizeTag(g)))

  // High content metrics only trigger when the member did not explicitly opt
  // in via the quiz. Default (sensitivity unknown) keeps the previous
  // conservative behavior: a missing tolerance is treated as "the parent has
  // not relaxed this axis", so the penalty still fires for violence:4+.
  const violenceTolerance = memberSensitivity?.violence ?? 2
  const sexualTolerance = memberSensitivity?.sexual ?? 2
  const hasHighViolence = metrics.violence >= 4 && violenceTolerance > 0
  const hasHighSexual = metrics.sexNudity >= 4 && sexualTolerance > 0
  const isMatureContent = hasMatureGenre || hasHighViolence || hasHighSexual

  if (!isMatureContent) return { multiplier: 1.0, reason: null, severity: null }

  const isMinor = memberAge != null && memberAge < 18
  const isChild = memberAge != null && memberAge < 13
  const isAgeAppropriate =
    expertAgeRec != null && memberAge != null && memberAge >= expertAgeRec

  if (isChild) {
    if (isAgeAppropriate) {
      return {
        multiplier: 0.45,
        reason: "contenu mature, vigilance conseillée",
        severity: "caution",
      }
    }
    return {
      multiplier: 0.25,
      reason: "contenu mature inadapté aux enfants",
      severity: "block",
    }
  }

  if (isMinor) {
    if (isAgeAppropriate) {
      return {
        multiplier: 0.55,
        reason: "contenu mature, vigilance conseillée",
        severity: "caution",
      }
    }
    return {
      multiplier: 0.25,
      reason: "contenu mature inadapté à son âge",
      severity: "block",
    }
  }

  return {
    multiplier: 1.0,
    reason: hasMatureGenre ? "contenu mature" : null,
    severity: null,
  }
}

export function isFamilyWarningContent(
  mediaGenres: string[],
  metrics: Pick<FitMetrics, "violence" | "sexNudity"> & { toneTags?: string[] | null },
  expertAgeRec: number | null,
): boolean {
  const hasConcerningGenre = mediaGenres.some((g) => CONCERNING_GENRES.has(g.toLowerCase()))
  const hasHighContentMetric = metrics.violence >= 4 || metrics.sexNudity >= 4
  const hasConcerningTone = (metrics.toneTags ?? []).some((t) => CONCERNING_TONES.has(t))

  if (hasConcerningGenre || hasHighContentMetric || hasConcerningTone) return true
  return expertAgeRec != null && expertAgeRec >= 13 && (metrics.violence >= 3 || metrics.sexNudity >= 3)
}

export function computeWeightedFitScore(scores: FitPreferenceScores): number {
  // Hard gates take precedence — cosine similarity must NOT rescue a title
  // that the member has explicitly opted out of. Order of operations:
  //   1. dislikedGenres match → genreScore is 0 (set upstream by
  //      computeGenreScore as of `486da46`); we short-circuit to a clamped
  //      low score so the title displays as Avoid in the preference pillar.
  //   2. avoidTopics match → avoidScore is 0; same short-circuit.
  //   3. Otherwise, normal weighted sum including the optional cosine term.
  if (scores.genreScore === 0 || scores.avoidScore === 0) {
    // Floor at 10 — well below the "À vérifier" band so the badge stays Avoid,
    // and the legacy level mapping lands on "poor".
    return clampScore(10)
  }

  const personalized = scores.personalizedScore ?? 0.5

  return clampScore(
    (scores.ageScore * FIT_WEIGHTS.ageScore +
      scores.sensitivityScore * FIT_WEIGHTS.sensitivityScore +
      scores.genreScore * FIT_WEIGHTS.genreScore +
      scores.interestsScore * FIT_WEIGHTS.interestsScore +
      scores.affinityScore * FIT_WEIGHTS.affinityScore +
      scores.toneScore * FIT_WEIGHTS.toneScore +
      scores.positiveScore * FIT_WEIGHTS.positiveScore +
      scores.avoidScore * FIT_WEIGHTS.avoidScore +
      personalized * FIT_WEIGHTS.personalizedScore) *
      100,
  )
}

export function applyFitGuardrails(input: {
  score: number
  memberAge: number | null
  expertAgeRec: number | null
  hasRichProfile: boolean
  hasYouthAppeal?: boolean
  adultLeaning?: boolean
  // When true, the score is being dragged down by a mature-content caution
  // (member is age-appropriate, but content has mature signals). We floor the
  // score at 36 + cap the level at "moderate" so the display lands on
  // "À vérifier" instead of "Trop tôt" — the badge stays semantically aligned
  // with the reason text.
  matureCaution?: boolean
}): FitGuardrailResult {
  let score = clampScore(input.score)
  let level = levelFromScore(score)
  let reasonOverride: string | null = null
  let ageWarning = false
  const ageUnknown = input.expertAgeRec == null

  if (input.expertAgeRec != null && input.memberAge != null && input.expertAgeRec > input.memberAge) {
    ageWarning = true
    reasonOverride = `Recommandé à partir de ${input.expertAgeRec} ans`
    const ageGap = input.expertAgeRec - input.memberAge
    if (ageGap >= 2) {
      reasonOverride = `Trop tÃ´t : recommandÃ© Ã  partir de ${input.expertAgeRec} ans`
      score = Math.min(score, 30)
      level = "poor"
    } else {
      score = Math.min(score, 65)
      level = capLevel(levelFromScore(score), "moderate")
    }
  } else if (ageUnknown && input.memberAge != null && input.memberAge < 18) {
    reasonOverride = "Âge expert à confirmer"
    score = Math.min(score, 65)
    level = capLevel(levelFromScore(score), "moderate")
  }

  if (!input.hasRichProfile) {
    score = Math.min(score, 65)
    level = capLevel(levelFromScore(score), "moderate")
    if (!reasonOverride) reasonOverride = "À affiner avec le quiz famille"
  }

  if (input.memberAge != null && input.memberAge < 18 && input.adultLeaning && !input.hasYouthAppeal) {
    score = Math.min(score, 65)
    level = capLevel(levelFromScore(score), "moderate")
    if (!reasonOverride || reasonOverride === "Âge") {
      reasonOverride = "Thèmes plutôt adultes à vérifier"
    }
  }

  // Mature-content caution: floor the score so a vigilance flag (member is at
  // or above the recommended age, but content is mature) lands in the
  // "À vérifier" band, not the "Trop tôt" band. Skipped when an actual age
  // warning already fired — the age warning is the stronger signal.
  if (input.matureCaution && !ageWarning) {
    if (score < 36) score = 36
    level = capLevel(level, "moderate")
    // Promote level out of "poor" if needed
    if (level === "poor") level = "moderate"
  }

  return { score, level, reasonOverride, ageWarning, ageUnknown }
}

// ---------------------------------------------------------------------------
// Catalogue card gates + copy guardrails (May 2026)
//
// Cards show member avatars as a quick "who is in range" signal. The previous
// rule kept borderline members (1 year under expertAgeRec) visible with an
// amber ring — parents read that as endorsement (Mathis 12 on Spider-Noir 13+).
// Detail-page copy also over-claimed "éducatif/positif" from a loose
// positiveScore threshold without checking tone, violence, or genre.
// ---------------------------------------------------------------------------

export interface CatalogCardExclusionInput {
  memberAge: number | null
  expertAgeRec: number | null
  mediaGenres: string[]
  metrics: Pick<FitMetrics, "violence" | "sexNudity" | "toneTags">
  maturePenaltySeverity: MatureContentSeverity
}

export function mediaHasConcerningGenre(mediaGenres: string[]): boolean {
  return mediaGenres.some((g) => CONCERNING_GENRES.has(normalizeTag(g)))
}

/** Returns an admin-debug reason string when a member must not appear on catalogue cards. */
export function getCatalogCardExclusionReason(input: CatalogCardExclusionInput): string | null {
  const { memberAge, expertAgeRec, mediaGenres, metrics, maturePenaltySeverity } = input
  if (memberAge == null) return null

  if (expertAgeRec != null && expertAgeRec > memberAge) {
    return `carte · en dessous de l'âge conseillé (${memberAge} ans · dès ${expertAgeRec})`
  }

  const concerningGenre = mediaHasConcerningGenre(mediaGenres)
  if (concerningGenre && (memberAge < 15 || (expertAgeRec != null && memberAge < expertAgeRec))) {
    return "carte · genre mature / polar"
  }

  if (metrics.violence >= 3 && memberAge < 13) {
    return "carte · violence élevée pour un enfant"
  }

  if (maturePenaltySeverity === "block") {
    return "carte · contenu mature bloqué"
  }

  const toneTags = metrics.toneTags ?? []
  const hasDarkTone = toneTags.some((t) => DARK_TONES.has(t) || CONCERNING_TONES.has(t))
  if (hasDarkTone && memberAge < 13 && expertAgeRec != null && memberAge >= expertAgeRec) {
    return "carte · ambiance sombre pour un enfant"
  }

  return null
}

export interface CatalogCardLevelCapInput {
  memberAge: number | null
  metrics: Pick<FitMetrics, "violence" | "toneTags">
  maturePenaltySeverity: MatureContentSeverity
  prefPillar?: "love" | "good" | "check" | "avoid" | "noProfile"
}

/** Caps the legacy FitLevel used by catalogue meters (max 1 lit segment when cautious). */
export function capCatalogCardFitLevel(level: FitLevel, input: CatalogCardLevelCapInput): FitLevel {
  let capped = level

  if (input.maturePenaltySeverity === "caution") {
    capped = capLevel(capped, "moderate")
  }

  const toneTags = input.metrics.toneTags ?? []
  const hasDarkTone = toneTags.some((t) => DARK_TONES.has(t) || CONCERNING_TONES.has(t))
  if (input.memberAge != null && input.memberAge < 13 && (hasDarkTone || input.metrics.violence >= 3)) {
    capped = capLevel(capped, "moderate")
  }

  if (input.memberAge != null && input.memberAge < 16 && input.metrics.violence >= 3) {
    capped = capLevel(capped, "moderate")
  }

  // Never show a 3-segment "Très adapté" on cards when preferences are still in check.
  if (input.prefPillar === "check" || input.prefPillar === "noProfile") {
    capped = capLevel(capped, "moderate")
  }

  return capped
}

export function qualifiesForPositiveContentCopy(
  positiveScore: number,
  metrics: Pick<FitMetrics, "positiveMessages" | "roleModels" | "violence" | "toneTags">,
  mediaGenres: string[],
): boolean {
  if (positiveScore < 0.8) return false
  if (metrics.positiveMessages < 4 || metrics.roleModels < 4) return false
  if (metrics.violence > 2) return false

  const toneTags = metrics.toneTags ?? []
  if (toneTags.some((t) => DARK_TONES.has(t) || CONCERNING_TONES.has(t))) return false
  if (mediaHasConcerningGenre(mediaGenres)) return false

  return true
}

export interface DetailFitLevelCapInput {
  memberAge: number | null
  metrics: Pick<FitMetrics, "positiveMessages" | "roleModels" | "violence" | "toneTags">
  mediaGenres: string[]
  positiveScore: number
  maturePenaltySeverity: MatureContentSeverity
  contentAnalysisHidden?: boolean
}

/** Softer cap for the detail-page sidebar — avoids "Très adapté" on dark / violent titles. */
export function capDetailFamilyFitLevel(level: FitLevel, input: DetailFitLevelCapInput): FitLevel {
  if (input.contentAnalysisHidden) {
    return capLevel(level, "moderate")
  }

  if (input.maturePenaltySeverity === "caution") {
    return capLevel(level, "moderate")
  }

  const toneTags = input.metrics.toneTags ?? []
  const hasDarkTone = toneTags.some((t) => DARK_TONES.has(t) || CONCERNING_TONES.has(t))
  const concerning = mediaHasConcerningGenre(input.mediaGenres) || hasDarkTone || input.metrics.violence >= 3

  if (input.memberAge != null && input.memberAge <= 12 && concerning) {
    if (!qualifiesForPositiveContentCopy(input.positiveScore, input.metrics, input.mediaGenres)) {
      return capLevel(level, "good")
    }
  }

  return level
}

export interface FinalizeDetailPageFitInput {
  level: FitLevel
  reason: string
  memberAge: number | null
  expertAgeRec: number | null
  mediaGenres: string[]
  metrics: Pick<FitMetrics, "violence" | "sexNudity" | "toneTags" | "positiveMessages" | "roleModels">
  maturePenaltySeverity: MatureContentSeverity
  positiveScore: number
  contentAnalysisHidden?: boolean
}

function detailReasonFromCatalogExclusion(
  catalogExclusionReason: string,
  expertAgeRec: number | null,
): string {
  if (catalogExclusionReason.includes("en dessous de l'âge conseillé")) {
    return expertAgeRec != null
      ? `Recommandé dès ${expertAgeRec} ans — pas adapté pour l'instant`
      : "Pas adapté à son âge pour l'instant"
  }
  if (catalogExclusionReason.includes("genre mature")) {
    return "Pas pour ce profil — genre mature ou polar"
  }
  if (catalogExclusionReason.includes("violence élevée")) {
    return "Violence marquée — déconseillé pour un enfant"
  }
  if (catalogExclusionReason.includes("contenu mature bloqué")) {
    return "Contenu mature — pas adapté à son âge"
  }
  if (catalogExclusionReason.includes("ambiance sombre")) {
    return "Ambiance sombre ou intense — à valider avec lui avant de proposer"
  }
  return "Quelques points à vérifier avant de proposer ce titre"
}

function detailLevelFromCatalogExclusion(catalogExclusionReason: string): FitLevel {
  if (
    catalogExclusionReason.includes("en dessous de l'âge conseillé") ||
    catalogExclusionReason.includes("genre mature") ||
    catalogExclusionReason.includes("contenu mature bloqué")
  ) {
    return "poor"
  }
  return "moderate"
}

/**
 * Detail-page sidebar: show every member, but align verdicts with catalogue
 * card gates so a hidden card avatar never reads "Bon choix" on the fiche.
 */
export function finalizeDetailPageFit(input: FinalizeDetailPageFitInput): {
  level: FitLevel
  reason: string
} {
  if (input.contentAnalysisHidden) {
    return {
      level: capLevel(input.level, "moderate"),
      reason: "Sortie à venir — repère provisoire, à revalider",
    }
  }

  const catalogExclusion = getCatalogCardExclusionReason({
    memberAge: input.memberAge,
    expertAgeRec: input.expertAgeRec,
    mediaGenres: input.mediaGenres,
    metrics: input.metrics,
    maturePenaltySeverity: input.maturePenaltySeverity,
  })

  if (catalogExclusion) {
    return {
      level: detailLevelFromCatalogExclusion(catalogExclusion),
      reason: detailReasonFromCatalogExclusion(catalogExclusion, input.expertAgeRec),
    }
  }

  return {
    level: capDetailFamilyFitLevel(input.level, {
      memberAge: input.memberAge,
      metrics: input.metrics,
      mediaGenres: input.mediaGenres,
      positiveScore: input.positiveScore,
      maturePenaltySeverity: input.maturePenaltySeverity,
    }),
    reason: input.reason,
  }
}

