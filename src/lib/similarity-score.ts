/**
 * Pair scoring of the weekly « titres proches » recompute
 * (/api/admin/similarity/compute). Pure: no database, no clock.
 *
 * Weighted average of what two titles share — type, director, genres, topics,
 * tone, emotional themes and age — normalised to 0–1. Only the signals both
 * titles carry count in the denominator, except age, which always does once
 * both titles have one.
 */

export interface MediaForComparison {
  id: string
  title: string
  type: string
  genres: string[]
  topics: string[]
  director: string | null
  expertAgeRec: number | null
  contentMetrics?: {
    toneTags: string[]
    emotionalThemes: string[]
  } | null
}

/**
 * Age proximity in [0, 1], decreasing with the gap between two recommended
 * ages: 1 at the same age, −0.25 per year up to two years (0.5), then −0.125
 * per year (0.25 at four years) down to 0 from six years — a 6 vs 12 or a
 * 10 vs 16 is a different audience and earns nothing.
 *
 * The old inline formula jumped back UP after two years (2 → 0.5, 3 → 0.7,
 * 4 → 0.6): its two branches didn't meet, so a three-year gap scored as
 * « closer » than a two-year one.
 */
export function ageProximityScore(gapYears: number): number {
  const gap = Math.abs(gapYears)
  if (gap <= 2) return 1 - gap * 0.25
  return Math.max(0, 0.5 - (gap - 2) * 0.125)
}

export function computeSimilarity(
  itemA: MediaForComparison,
  itemB: MediaForComparison
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let totalWeight = 0
  let weightedScore = 0

  // Same type bonus (weight: 1)
  if (itemA.type === itemB.type) {
    weightedScore += 0.1
    totalWeight += 1
    reasons.push("same_type")
  }

  // Same director (weight: 3)
  if (
    itemA.director &&
    itemB.director &&
    itemA.director.toLowerCase() === itemB.director.toLowerCase()
  ) {
    weightedScore += 0.6 // 0.2 * 3
    totalWeight += 3
    reasons.push("same_director")
  }

  // Genre similarity (weight: 4)
  const genreOverlap = computeArrayOverlap(itemA.genres, itemB.genres)
  if (genreOverlap > 0) {
    weightedScore += genreOverlap * 4
    totalWeight += 4
    reasons.push("similar_genres")
  }

  // Topic similarity (weight: 3)
  const topicOverlap = computeArrayOverlap(itemA.topics, itemB.topics)
  if (topicOverlap > 0) {
    weightedScore += topicOverlap * 3
    totalWeight += 3
    reasons.push("similar_topics")
  }

  // Tone similarity (weight: 2) — from enrichment v2
  const toneA = itemA.contentMetrics?.toneTags ?? []
  const toneB = itemB.contentMetrics?.toneTags ?? []
  if (toneA.length > 0 && toneB.length > 0) {
    const toneOverlap = computeArrayOverlap(toneA, toneB)
    if (toneOverlap > 0) {
      weightedScore += toneOverlap * 2
      totalWeight += 2
      reasons.push("similar_tone")
    }
  }

  // Emotional theme similarity (weight: 2) — from enrichment v2
  const emotionA = itemA.contentMetrics?.emotionalThemes ?? []
  const emotionB = itemB.contentMetrics?.emotionalThemes ?? []
  if (emotionA.length > 0 && emotionB.length > 0) {
    const emotionOverlap = computeArrayOverlap(emotionA, emotionB)
    if (emotionOverlap > 0) {
      weightedScore += emotionOverlap * 2
      totalWeight += 2
      reasons.push("similar_emotions")
    }
  }

  // Age recommendation similarity (weight: 2)
  if (itemA.expertAgeRec !== null && itemB.expertAgeRec !== null) {
    const ageDiff = Math.abs(itemA.expertAgeRec - itemB.expertAgeRec)
    weightedScore += ageProximityScore(ageDiff) * 2
    totalWeight += 2
    if (ageDiff <= 2) {
      reasons.push("similar_age_rec")
    }
  }

  // Normalize score
  const score = totalWeight > 0 ? weightedScore / totalWeight : 0

  return { score: Math.min(1, Math.max(0, score)), reasons }
}

export function computeArrayOverlap(arr1: string[], arr2: string[]): number {
  if (!arr1?.length || !arr2?.length) return 0

  const set1 = new Set(arr1.map((s) => s.toLowerCase()))
  const set2 = new Set(arr2.map((s) => s.toLowerCase()))

  let overlap = 0
  for (const item of set1) {
    if (set2.has(item)) overlap++
  }

  // Jaccard similarity: intersection / union
  const union = new Set([...set1, ...set2])
  return overlap / union.size
}
