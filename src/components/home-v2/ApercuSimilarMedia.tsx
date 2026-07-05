import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import type { MediaType } from "@/lib/types"
import { getSimilarMedia } from "@/lib/similar-media"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Warm-palette variant of SimilarMedia. Selection logic (same-type, genre-
 * enforced precomputed edges + genre fallback) lives in getSimilarMedia; this
 * component owns the apercu poster-grid art direction:
 *
 * - Equal-width poster cards with a reserved 2-line title footprint.
 * - Age badge top-left of the poster in sage.
 */

interface ApercuSimilarMediaProps {
  mediaId: string
  mediaType: string
  genres: string[]
  topics: string[]
  serifClass: string
}

export async function ApercuSimilarMedia({
  mediaId,
  mediaType,
  genres,
  topics,
  serifClass,
}: ApercuSimilarMediaProps) {
  const similarMedia = await getSimilarMedia({ mediaId, mediaType, genres, topics })
  if (similarMedia.length === 0) return null

  const p = APERCU_PALETTE

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
      {similarMedia.map((item) => {
        const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null
        return (
          <Link
            key={item.id}
            href={`/media/${toMediaRouteId(item.type as MediaType, item.id)}`}
            className="group block"
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

            {/* Fixed-height footer: title reserves two lines + year line. */}
            <div className="mt-2.5">
              <div
                className={`${serifClass} text-sm font-medium leading-snug line-clamp-2`}
                style={{ color: p.ink, letterSpacing: "-0.01em", minHeight: "2.6em" }}
              >
                {item.title}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: p.ink2 }}>
                {year ?? " "}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
