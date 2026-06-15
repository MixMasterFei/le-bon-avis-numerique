import { MATURE_GENRES } from "@/lib/family-fit-score"
import { normalizeTag } from "@/lib/preference-vector/vocabulary"
import {
  QUIZ_HARD_AVOID_GENRES,
  QUIZ_SOFT_DISLIKE_GENRES,
} from "@/lib/preference-quiz-config"

/** Genres that trigger hard exclusion in SQL filters and genreScore === 0. */
export function isHardBlockDislikedGenre(genre: string): boolean {
  return MATURE_GENRES.has(normalizeTag(genre))
}

/** Split stored dislikedGenres for quiz UI prefill. */
export function partitionDislikedGenres(dislikedGenres: string[]): {
  hardAvoid: string[]
  softDislike: string[]
} {
  const hardAvoid: string[] = []
  const softDislike: string[] = []
  for (const g of dislikedGenres) {
    if (isHardBlockDislikedGenre(g)) hardAvoid.push(g)
    else softDislike.push(g)
  }
  return { hardAvoid, softDislike }
}

export function mergeDislikedGenres(hardAvoid: string[], softDislike: string[]): string[] {
  return [...new Set([...hardAvoid, ...softDislike])]
}

/** Only mature / extreme genres are removed at the SQL layer. */
export function dislikedGenresForHardExclusion(dislikedGenres: string[]): string[] {
  return [...new Set(dislikedGenres.filter(isHardBlockDislikedGenre))]
}

export function isQuizHardAvoidGenre(genre: string): boolean {
  const n = normalizeTag(genre)
  return QUIZ_HARD_AVOID_GENRES.some((g) => normalizeTag(g) === n)
}

export function isQuizSoftDislikeGenre(genre: string): boolean {
  const n = normalizeTag(genre)
  return QUIZ_SOFT_DISLIKE_GENRES.some((g) => normalizeTag(g) === n)
}
