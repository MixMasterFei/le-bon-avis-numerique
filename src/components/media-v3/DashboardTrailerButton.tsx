"use client"

import { Play } from "lucide-react"
import { useExtrasData } from "@/components/media/FicheDataContext"

/**
 * Hero "Bande-annonce" button. Reads the shared extras data (single fetch via
 * FicheDataProvider) and only renders when a real trailer exists. Opens the
 * YouTube trailer in a new tab. Self-hides for games/books and when there is
 * no trailer.
 */
export function DashboardTrailerButton({
  mediaId,
  mediaType,
}: {
  mediaId: string | null
  mediaType: string
}) {
  const { data, loading } = useExtrasData(mediaId, mediaType)
  const trailer = data?.trailer

  if (loading) {
    return <div className="h-9 w-36 animate-pulse rounded-[9px]" style={{ background: "#F0E7D8" }} />
  }
  if (!trailer || trailer.site !== "YouTube" || !trailer.key) return null

  return (
    <a
      href={`https://www.youtube.com/watch?v=${trailer.key}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-4 py-[11px] text-[12.5px] font-semibold text-white transition-colors"
      style={{ background: "#C0512E" }}
    >
      <Play className="h-3.5 w-3.5 fill-current" />
      Bande-annonce
    </a>
  )
}
