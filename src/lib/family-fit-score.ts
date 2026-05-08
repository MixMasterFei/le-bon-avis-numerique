import { FAMILY_VIP_BRAND_TOPICS_LOWER } from "@/lib/family-vip-brands"

export type FitLevel = "excellent" | "good" | "moderate" | "poor"

export interface FitMemberProfile {
  useCustomSettings?: boolean | null
  favoriteGenres?: string[] | null
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
}

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

export const MATURE_GENRES = new Set(["horreur", "horror", "épouvante", "thriller", "crime"])
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

export function hasRichProfile(member: FitMemberProfile): boolean {
  return !!member.useCustomSettings && (member.favoriteGenres?.length ?? 0) > 0
}

export function getAgeGroup(age: number | null): keyof typeof DEFAULT_GENRES_BY_AGE {
  if (age == null) return "teen"
  if (age <= 9) return "child"
  if (age <= 12) return "tween"
  if (age <= 17) return "teen"
  return "adult"
}

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
    const threshold = tolerance === 0 ? 1 : 4 - tolerance
    const over = Math.max(0, metricValue - threshold)
    total += Math.max(0, 1 - over * 0.25)
    count++
  }

  return count === 0 ? 1.0 : total / count
}

export function computeGenreScore(mediaGenres: string[], favoriteGenres: string[], dislikedGenres: string[] = []): number {
  if (favoriteGenres.length === 0 && dislikedGenres.length === 0) return 0.5

  const normalise = (s: string) => s.toLowerCase().trim()
  const mediaSet = new Set(mediaGenres.map(normalise))

  let score = 0.5
  if (favoriteGenres.length > 0) {
    const matching = favoriteGenres.filter((g) => mediaSet.has(normalise(g))).length
    score = Math.min(1.0, matching / Math.max(1, Math.min(3, favoriteGenres.length)))
  }

  if (dislikedGenres.length > 0) {
    const dislikedMatches = dislikedGenres.filter((g) => mediaSet.has(normalise(g))).length
    score = Math.max(0, score - dislikedMatches * 0.3)
  }

  return score
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

export function computeMatureContentPenalty(
  mediaGenres: string[],
  metrics: Pick<FitMetrics, "violence" | "sexNudity">,
  expertAgeRec: number | null,
  memberAge: number | null,
): { multiplier: number; reason: string | null } {
  const hasMatureGenre = mediaGenres.some((g) => MATURE_GENRES.has(g.toLowerCase()))
  const hasHighViolence = metrics.violence >= 4
  const hasHighSexual = metrics.sexNudity >= 4
  const isMatureContent = hasMatureGenre || hasHighViolence || hasHighSexual

  if (!isMatureContent) return { multiplier: 1.0, reason: null }

  const isMinor = memberAge != null && memberAge < 18
  const isChild = memberAge != null && memberAge < 13

  if (isChild) return { multiplier: 0.25, reason: "contenu mature inadapté aux enfants" }

  if (isMinor) {
    const isAgeAppropriate = expertAgeRec != null && memberAge != null && memberAge >= expertAgeRec
    if (isAgeAppropriate) return { multiplier: 0.45, reason: "contenu mature, vigilance conseillée" }
    return { multiplier: 0.25, reason: "contenu mature inadapté à son âge" }
  }

  return { multiplier: 1.0, reason: hasMatureGenre ? "contenu mature" : null }
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
  return clampScore(
    (scores.ageScore * 0.30 +
      scores.sensitivityScore * 0.25 +
      scores.genreScore * 0.10 +
      scores.interestsScore * 0.10 +
      scores.affinityScore * 0.10 +
      scores.toneScore * 0.05 +
      scores.positiveScore * 0.05 +
      scores.avoidScore * 0.05) *
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
}): FitGuardrailResult {
  let score = clampScore(input.score)
  let level = levelFromScore(score)
  let reasonOverride: string | null = null
  let ageWarning = false
  const ageUnknown = input.expertAgeRec == null

  if (input.expertAgeRec != null && input.memberAge != null && input.expertAgeRec > input.memberAge) {
    ageWarning = true
    reasonOverride = `Recommandé à partir de ${input.expertAgeRec} ans`
    score = Math.min(score, input.expertAgeRec >= input.memberAge + 2 ? 45 : 65)
    level = capLevel(levelFromScore(score), "moderate")
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

  return { score, level, reasonOverride, ageWarning, ageUnknown }
}

