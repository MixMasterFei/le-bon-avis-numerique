import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Warm-palette variant of SimilarMedia. Same similarity query (precomputed
 * MediaSimilarity rows with a genre-based fallback), but the card grid is
 * redrawn to the apercu art direction:
 *
 * - Cards on a horizontal scroll rail with equal widths (w-40 / 160px).
 * - Every card uses the SAME vertical footprint: poster + 2-line title
 *   clamp with a reserved min-height so 1-line and 2-line titles align.
 * - Reason pills dropped (they were in violet on cream and created the
 *   visual clutter that made the rail look "all over the place").
 * - Year on its own muted line under the title gives a consistent
 *   secondary row without the variable-height problem.
 * - Age badge top-left of the poster in sage — matches the other
 *   poster grids on /apercu*.
 */

interface ApercuSimilarMediaProps {
  mediaId: string
  mediaType: string
  genres: string[]
  topics: string[]
  serifClass: string
}

type SimilarItem = {
  id: string
  title: string
  type: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  releaseDate: Date | null
  score: number
}

export async function ApercuSimilarMedia({
  mediaId,
  mediaType,
  genres,
  topics,
  serifClass,
}: ApercuSimilarMediaProps) {
  const TARGET = 10
  let similarMedia: SimilarItem[] = []

  try {
    // 1. Pre-computed similarities
    const similarities = await prisma.mediaSimilarity.findMany({
      where: {
        OR: [{ mediaIdA: mediaId }, { mediaIdB: mediaId }],
      },
      orderBy: { similarityScore: "desc" },
      take: TARGET,
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
      // Drop rows whose poster is missing so cards aren't empty
      .filter((m) => m.posterUrl && m.posterUrl.startsWith("http"))

    // 2. Top up from genre-based fallback when precomputed doesn't fill the rail.
    //    Earlier behaviour only ran the fallback when precomputed === 0, so items
    //    with a single similarity row would render a rail of one card.
    if (similarMedia.length < TARGET && genres.length > 0) {
      const alreadyIncluded = new Set(similarMedia.map((m) => m.id))
      const fallback = await prisma.mediaItem.findMany({
        where: {
          id: { not: mediaId, notIn: [...alreadyIncluded] },
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

      const current = await prisma.mediaItem.findUnique({
        where: { id: mediaId },
        select: { director: true, expertAgeRec: true },
      })

      const genreSet = new Set(genres.map((g) => g.toLowerCase()))
      const topicSet = new Set(topics.map((t) => t.toLowerCase()))

      const scored = fallback.map((m) => {
        let relevance = 0
        const overlap = m.genres.filter((g) => genreSet.has(g.toLowerCase())).length
        relevance += overlap * 1.5
        if (current?.director && m.director && m.director === current.director) {
          relevance += 4
        }
        if (current?.expertAgeRec != null && m.expertAgeRec != null) {
          const ageDiff = Math.abs(current.expertAgeRec - m.expertAgeRec)
          if (ageDiff <= 2) relevance += 2
        }
        if (m.topics) {
          relevance += m.topics.filter((t) => topicSet.has(t.toLowerCase())).length
        }
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
      similarMedia.push(...scored.slice(0, TARGET - similarMedia.length))
    }
  } catch (error) {
    console.error("[ApercuSimilarMedia] Failed to fetch:", error)
    return null
  }

  if (similarMedia.length === 0) return null

  const p = APERCU_PALETTE

  return (
    <div className="relative -mx-4 md:-mx-8">
      <div className="flex gap-4 overflow-x-auto pb-4 px-4 md:px-8 scrollbar-thin">
        {similarMedia.map((item) => {
          const year = item.releaseDate
            ? new Date(item.releaseDate).getFullYear()
            : null
          return (
            <Link
              key={item.id}
              href={`/media/${toMediaRouteId(item.type as MediaType, item.id)}`}
              className="group flex-shrink-0 w-[160px]"
            >
              {/* Poster */}
              <div
                className="relative aspect-[2/3] overflow-hidden rounded-xl transition-transform duration-300 group-hover:-translate-y-1"
                style={{
                  background: p.placeholder,
                  border: `1px solid ${p.line}`,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
                }}
              >
                {item.posterUrl && (
                  <SafeImage
                    src={item.posterUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="160px"
                    fallbackClassName="absolute inset-0"
                  />
                )}
                {item.expertAgeRec != null && item.expertAgeRec > 0 && (
                  <div
                    className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                    style={{ background: "#B8D89A", color: "#2D3E1E" }}
                  >
                    {item.expertAgeRec}+
                  </div>
                )}
              </div>

              {/* Fixed-height footer: title reserves two lines + year line.
                 Gives every card the same vertical footprint so the rail
                 reads as a neat grid. */}
              <div className="mt-2.5">
                <div
                  className={`${serifClass} text-sm font-medium leading-snug line-clamp-2`}
                  style={{
                    color: p.ink,
                    letterSpacing: "-0.01em",
                    minHeight: "2.6em",
                  }}
                >
                  {item.title}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: p.ink2 }}>
                  {year ?? "\u00A0"}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
