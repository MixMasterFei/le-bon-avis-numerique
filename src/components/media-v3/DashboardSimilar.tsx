import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"
import { getSimilarMedia } from "@/lib/similar-media"

/**
 * "Dans le même genre" rail for the V3 dashboard: a single row of poster cards
 * (poster + title + age·year). Fills the width on desktop and scrolls
 * horizontally on narrow screens, so it stays one line. Same genre-enforced
 * selection as the classic grid.
 */
export async function DashboardSimilar({
  mediaId,
  mediaType,
  genres,
  topics,
}: {
  mediaId: string
  mediaType: string
  genres: string[]
  topics: string[]
}) {
  const items = await getSimilarMedia({ mediaId, mediaType, genres, topics, limit: 6 })
  if (items.length === 0) return null

  return (
    <div className="grid auto-cols-[minmax(140px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-1">
      {items.map((item) => {
        const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null
        const age = item.expertAgeRec != null && item.expertAgeRec > 0 ? `${item.expertAgeRec}+` : null
        return (
          <Link
            key={item.id}
            href={`/media/${toMediaRouteId(item.type as MediaType, item.id)}`}
            className="group block"
          >
            <div
              className="relative aspect-[2/3] overflow-hidden rounded-xl transition-transform duration-300 group-hover:-translate-y-1"
              style={{ background: "#EDE4D5", border: "1px solid #E4DAC8", boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }}
            >
              {item.posterUrl && (
                <SafeImage src={item.posterUrl} alt={item.title} fill sizes="190px" className="object-cover" />
              )}
              {age && (
                <div
                  className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: "#B8D89A", color: "#2D3E1E" }}
                >
                  {age}
                </div>
              )}
            </div>
            <div
              className="mt-2 font-serif text-[13px] font-semibold leading-snug line-clamp-2"
              style={{ color: "#2A251F", letterSpacing: "-0.01em", minHeight: "2.6em" }}
            >
              {item.title}
            </div>
            <div className="text-[11px]" style={{ color: "#8A8072" }}>
              {year ?? " "}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
