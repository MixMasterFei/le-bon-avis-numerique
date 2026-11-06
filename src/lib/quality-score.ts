/**
 * Data-quality score (0–100): how COMPLETE a fiche is — poster, synopsis,
 * rating, age, genres, analysis, stills, streaming. Used for filtering
 * (PUBLIC_MEDIA_QUALITY_FLOOR), never for ranking.
 *
 * Computed nightly by /api/admin/quality/compute. That job used to rewrite
 * every row (score + isEnriched + lastVerifiedAt) whether or not anything had
 * changed, and since `updatedAt` is Prisma's @updatedAt that bumped it on all
 * ~12 000 rows every day. `qualityUpdateFor` is the fix: it returns only the
 * fields whose value actually changes, or null when the row is already right —
 * and it never touches `lastVerifiedAt`, because computing a score from data
 * we already hold verifies nothing (that column gates the 30-day poster check).
 */

export interface QualityScoreInput {
  title: string | null
  posterUrl: string | null
  backdropUrl: string | null
  synopsisFr: string | null
  releaseDate: Date | null
  genres: string[] | null
  officialRating: string | null
  expertAgeRec: number | null
  director: string | null
  originalLanguage: string | null
  hasContentMetrics: boolean
  hasScreenshots: boolean
  hasStreaming: boolean
}

export interface StoredQuality {
  dataQualityScore: number
  isEnriched: boolean
}

/**
 * Max 100 points.
 *  - Essential (60): title, poster, synopsis, rating, age rec, genres
 *  - Enrichment (25): content metrics, screenshots, streaming
 *  - Bonus (15): backdrop, director, language, release date
 */
export function computeDataQualityScore(item: QualityScoreInput): number {
  let score = 0

  // Essential (60 pts)
  if (item.title && item.title.trim()) score += 5
  if (item.posterUrl) score += 10
  if (item.synopsisFr && item.synopsisFr.length > 50) score += 15
  else if (item.synopsisFr && item.synopsisFr.length > 0) score += 7
  if (item.officialRating) score += 10
  if (item.expertAgeRec !== null) score += 10
  if (item.genres && item.genres.length > 0) score += 10

  // Enrichment (25 pts)
  if (item.hasContentMetrics) score += 10
  if (item.hasScreenshots) score += 10
  if (item.hasStreaming) score += 5

  // Bonus (15 pts)
  if (item.backdropUrl) score += 5
  if (item.director) score += 3
  if (item.originalLanguage) score += 3
  if (item.releaseDate) score += 4

  return score
}

/** A fiche counts as enriched once it has both an age and a content analysis. */
export function deriveIsEnriched(item: Pick<QualityScoreInput, "expertAgeRec" | "hasContentMetrics">): boolean {
  return item.expertAgeRec !== null && item.hasContentMetrics
}

export function computeQuality(item: QualityScoreInput): StoredQuality {
  return { dataQualityScore: computeDataQualityScore(item), isEnriched: deriveIsEnriched(item) }
}

/**
 * The write the quality job should make for one row: only the fields whose
 * value changes, or `null` when the stored row already matches.
 */
export function qualityUpdateFor(stored: StoredQuality, computed: StoredQuality): Partial<StoredQuality> | null {
  const patch: Partial<StoredQuality> = {}
  if (stored.dataQualityScore !== computed.dataQualityScore) patch.dataQualityScore = computed.dataQualityScore
  if (stored.isEnriched !== computed.isEnriched) patch.isEnriched = computed.isEnriched
  return Object.keys(patch).length > 0 ? patch : null
}
