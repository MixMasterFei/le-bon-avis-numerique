import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { SafeImage } from "@/components/ui/SafeImage"
import { AgeBadge } from "@/components/media/AgeBadge"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface SimilarMediaProps {
  mediaId: string
  mediaType: string
  genres: string[]
  topics: string[]
  className?: string
}

/** French translations for similarity reason tags */
const reasonLabels: Record<string, string> = {
  same_director: "Même réalisateur",
  similar_genres: "Genres similaires",
  similar_themes: "Thèmes proches",
  same_studio: "Même studio",
  similar_age_rating: "Même tranche d'âge",
}

function translateReason(reason: string): string {
  return reasonLabels[reason] ?? reason
}

type SimilarItem = {
  id: string
  title: string
  type: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  releaseDate: Date | null
  reasons: string[]
  score: number
}

export async function SimilarMedia({
  mediaId,
  mediaType,
  genres,
  topics,
  className,
}: SimilarMediaProps) {
  let similarMedia: SimilarItem[] = []

  try {
    // 1. Try pre-computed similarities from the MediaSimilarity table
    const similarities = await prisma.mediaSimilarity.findMany({
      where: {
        OR: [
          { mediaIdA: mediaId },
          { mediaIdB: mediaId },
        ],
      },
      orderBy: { similarityScore: "desc" },
      take: 8,
      include: {
        mediaA: {
          select: {
            id: true,
            title: true,
            type: true,
            posterUrl: true,
            expertAgeRec: true,
            genres: true,
            releaseDate: true,
          },
        },
        mediaB: {
          select: {
            id: true,
            title: true,
            type: true,
            posterUrl: true,
            expertAgeRec: true,
            genres: true,
            releaseDate: true,
          },
        },
      },
    })

    // 2. Map to get the "other" media (not the current one)
    similarMedia = similarities.map((sim) => {
      const other = sim.mediaIdA === mediaId ? sim.mediaB : sim.mediaA
      return {
        ...other,
        type: other.type as string,
        reasons: sim.reasons,
        score: sim.similarityScore,
      }
    })

    // 3. Fallback: query by same genres + same type, then rank by relevance
    if (similarMedia.length === 0 && genres.length > 0) {
      // Fetch a larger pool, then score in JS for better quality
      const fallback = await prisma.mediaItem.findMany({
        where: {
          id: { not: mediaId },
          type: mediaType as MediaType,
          genres: { hasSome: genres },
          posterUrl: { not: null, startsWith: "http" },
          originalLanguage: { in: ["fr", "en", "es", "it", "de", "pt"] },
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

      // Fetch current media's director for comparison
      const current = await prisma.mediaItem.findUnique({
        where: { id: mediaId },
        select: { director: true, expertAgeRec: true },
      })

      const genreSet = new Set(genres.map((g) => g.toLowerCase()))
      const topicSet = new Set(topics.map((t) => t.toLowerCase()))

      // Score each candidate by relevance
      const scored = fallback.map((m) => {
        let relevance = 0
        const reasons: string[] = []

        // Genre overlap: count matches (max ~5 pts)
        const overlap = m.genres.filter((g) => genreSet.has(g.toLowerCase())).length
        relevance += overlap * 1.5
        if (overlap >= 2) reasons.push("similar_genres")

        // Same director (+4 pts)
        if (current?.director && m.director && m.director === current.director) {
          relevance += 4
          reasons.push("same_director")
        }

        // Age rating proximity (+2 pts if close)
        if (current?.expertAgeRec != null && m.expertAgeRec != null) {
          const ageDiff = Math.abs(current.expertAgeRec - m.expertAgeRec)
          if (ageDiff <= 2) {
            relevance += 2
            if (ageDiff === 0) reasons.push("similar_age_rating")
          }
        }

        // Topic overlap (+1 pt per match)
        if (m.topics) {
          const topicOverlap = m.topics.filter((t) => topicSet.has(t.toLowerCase())).length
          if (topicOverlap > 0) {
            relevance += topicOverlap
            reasons.push("similar_themes")
          }
        }

        // TMDB rating tiebreaker
        if (m.tmdbRating) relevance += m.tmdbRating / 10

        return {
          id: m.id,
          title: m.title,
          type: m.type as string,
          posterUrl: m.posterUrl,
          expertAgeRec: m.expertAgeRec,
          genres: m.genres,
          releaseDate: m.releaseDate,
          reasons: reasons.length > 0 ? reasons : ["similar_genres"],
          score: relevance,
        }
      })

      // Sort by relevance score, take top 8
      scored.sort((a, b) => b.score - a.score)
      similarMedia.push(...scored.slice(0, 8))
    }
  } catch (error) {
    // Gracefully handle DB errors — don't break the page
    console.error("[SimilarMedia] Failed to fetch similar media:", error)
    return null
  }

  // 4. If still empty, render nothing
  if (similarMedia.length === 0) {
    return null
  }

  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  return (
    <section className={cn("mt-10", className)}>
      <div className="mb-6" style={{ borderTop: `1px solid ${p.line}` }} />

      <h2
        className={`${serifClass} text-xl md:text-2xl font-medium mb-4`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        Dans le même{" "}
        <em className="italic" style={{ color: p.accent }}>
          genre
        </em>
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {similarMedia.map((item) => (
          <Link
            key={item.id}
            href={`/media/${toMediaRouteId(item.type as MediaType, item.id)}`}
            className="group"
          >
            <div className="w-32 sm:w-36 shrink-0">
              <div
                className="relative aspect-[2/3] overflow-hidden rounded-xl group-hover:-translate-y-1 transition-all duration-300"
                style={{
                  background: p.placeholder,
                  boxShadow: `0 2px 8px ${p.line}`,
                }}
              >
                {item.posterUrl ? (
                  <SafeImage
                    src={item.posterUrl}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 128px, 144px"
                    fallbackClassName="absolute inset-0"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-xs text-center p-2"
                    style={{ color: p.ink2 }}
                  >
                    {item.title}
                  </div>
                )}

                {item.expertAgeRec != null && item.expertAgeRec > 0 && (
                  <div className="absolute top-1.5 left-1.5">
                    <AgeBadge age={item.expertAgeRec} size="xs" />
                  </div>
                )}

                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(30,26,21,0.5), transparent)",
                  }}
                />
              </div>

              <h3
                className="mt-2 px-0.5 text-xs font-semibold line-clamp-2 leading-tight group-hover:opacity-70 transition-opacity"
                style={{ color: p.ink }}
              >
                {item.title}
              </h3>

              {item.reasons.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 px-0.5">
                  {item.reasons.slice(0, 2).map((reason) => (
                    <span
                      key={reason}
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: p.bg2,
                        color: p.accent,
                      }}
                    >
                      {translateReason(reason)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
