import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"
import { getSimilarMedia } from "@/lib/similar-media"

/**
 * Compact one-line "Dans le même genre" rail for the V3 dashboard: small
 * poster thumb + title + age·year, laid out horizontally. Equal-width on
 * desktop (all fit on one line), horizontally scrollable on narrow screens so
 * it stays a single row. Same genre-enforced selection as the classic grid.
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
  const items = await getSimilarMedia({ mediaId, mediaType, genres, topics, limit: 5 })
  if (items.length === 0) return null

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {items.map((item) => {
        const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : null
        const age = item.expertAgeRec != null && item.expertAgeRec > 0 ? `${item.expertAgeRec}+` : null
        return (
          <Link
            key={item.id}
            href={`/media/${toMediaRouteId(item.type as MediaType, item.id)}`}
            className="group flex min-w-[150px] flex-1 basis-0 items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-[#FBF8F2]"
          >
            <div
              className="relative h-14 w-[38px] flex-none overflow-hidden rounded-md"
              style={{ background: "#EDE4D5" }}
            >
              {item.posterUrl && (
                <SafeImage src={item.posterUrl} alt={item.title} fill sizes="38px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <div
                className="font-serif text-[11.5px] font-semibold leading-[1.25] line-clamp-2"
                style={{ color: "#2A251F" }}
              >
                {item.title}
              </div>
              <div className="mt-0.5 text-[10.5px]" style={{ color: "#8A8072" }}>
                {[age, year].filter(Boolean).join(" · ") || " "}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
