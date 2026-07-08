import { prisma } from "@/lib/prisma"
import type { MediaType } from "@/lib/types"

export type SimilarItem = {
  id: string
  title: string
  type: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  releaseDate: Date | null
  score: number
}

/**
 * Same-genre, same-type "similar titles" for a fiche. Shared by the classic
 * poster grid (ApercuSimilarMedia) and the V3 dashboard's compact one-line
 * rail so the (genre-enforced) selection logic lives in one place.
 *
 * 1. Top precomputed MediaSimilarity edges, kept to the same media type AND
 *    requiring a real shared genre with the current title (a high-scoring edge
 *    can rank on director/tone/age alone — that eroded trust).
 * 2. Genre-based top-up when the precomputed set is thin.
 */
export async function getSimilarMedia({
  mediaId,
  mediaType,
  genres,
  topics,
  limit = 10,
}: {
  mediaId: string
  mediaType: string
  genres: string[]
  topics: string[]
  limit?: number
}): Promise<SimilarItem[]> {
  const currentGenreSet = new Set(genres.map((g) => g.toLowerCase()))
  let similarMedia: SimilarItem[] = []

  // Age-coherence guard (strict). "Dans le même genre" matches on genre +
  // similarity score, so a 10+ anime and The Boys (17+) both tagged
  // Action/Sci-Fi looked "similar" — unacceptable on a family guide. A
  // suggestion must NEVER be rated older than the title being viewed: same age
  // or younger only, and an UNRATED suggestion is dropped too (its age can't be
  // guaranteed ≤ current). The rule only applies once we know the current
  // title's age — enriched fiches always do; a rare unrated fiche keeps the
  // genre-only behaviour.
  const current = await prisma.mediaItem.findUnique({
    where: { id: mediaId },
    select: { director: true, expertAgeRec: true },
  })
  const currentAge = current?.expertAgeRec ?? null
  const passesAge = (age: number | null): boolean =>
    currentAge == null || (age != null && age <= currentAge)

  try {
    const similarities = await prisma.mediaSimilarity.findMany({
      where: { OR: [{ mediaIdA: mediaId }, { mediaIdB: mediaId }] },
      orderBy: { similarityScore: "desc" },
      take: 10,
      include: {
        mediaA: {
          select: { id: true, title: true, type: true, posterUrl: true, expertAgeRec: true, genres: true, releaseDate: true },
        },
        mediaB: {
          select: { id: true, title: true, type: true, posterUrl: true, expertAgeRec: true, genres: true, releaseDate: true },
        },
      },
    })

    similarMedia = similarities
      .map((sim) => {
        const other = sim.mediaIdA === mediaId ? sim.mediaB : sim.mediaA
        return {
          id: other.id,
          title: other.title,
          type: other.type as string,
          posterUrl: other.posterUrl,
          expertAgeRec: other.expertAgeRec,
          genres: other.genres,
          releaseDate: other.releaseDate,
          score: sim.similarityScore,
        }
      })
      .filter((s) => s.type === mediaType)
      .filter(
        (s) => currentGenreSet.size === 0 || s.genres.some((g) => currentGenreSet.has(g.toLowerCase())),
      )
      .filter((s) => passesAge(s.expertAgeRec))

    if (similarMedia.length < 6 && genres.length > 0) {
      const existingIds = new Set<string>([mediaId, ...similarMedia.map((s) => s.id)])
      const fallback = await prisma.mediaItem.findMany({
        where: {
          id: { notIn: Array.from(existingIds) },
          type: mediaType as MediaType,
          genres: { hasSome: genres },
          posterUrl: { not: null, startsWith: "http" },
          ...(mediaType === "MOVIE" || mediaType === "TV"
            ? { originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt"] } }
            : {}),
        },
        select: {
          id: true,
          title: true,
          type: true,
          posterUrl: true,
          expertAgeRec: true,
          genres: true,
          topics: true,
          releaseDate: true,
          director: true,
          tmdbRating: true,
        },
        take: 60,
      })

      const genreSet = new Set(genres.map((g) => g.toLowerCase()))
      const topicSet = new Set(topics.map((t) => t.toLowerCase()))

      const scored = fallback.filter((m) => passesAge(m.expertAgeRec)).map((m) => {
        let relevance = 0
        const overlap = m.genres.filter((g) => genreSet.has(g.toLowerCase())).length
        relevance += overlap * 1.5
        if (current?.director && m.director && m.director === current.director) relevance += 4
        if (current?.expertAgeRec != null && m.expertAgeRec != null) {
          const ageDiff = Math.abs(current.expertAgeRec - m.expertAgeRec)
          if (ageDiff <= 2) relevance += 2
        }
        if (m.topics) relevance += m.topics.filter((t) => topicSet.has(t.toLowerCase())).length
        if (m.tmdbRating) relevance += m.tmdbRating / 10

        return {
          id: m.id,
          title: m.title,
          type: m.type as string,
          posterUrl: m.posterUrl,
          expertAgeRec: m.expertAgeRec,
          genres: m.genres,
          releaseDate: m.releaseDate,
          score: relevance,
        }
      })

      scored.sort((a, b) => b.score - a.score)
      for (const s of scored) {
        if (similarMedia.length >= 10) break
        similarMedia.push(s)
      }
    }
  } catch (error) {
    console.error("[getSimilarMedia] Failed to fetch:", error)
    return []
  }

  return similarMedia.slice(0, limit)
}
