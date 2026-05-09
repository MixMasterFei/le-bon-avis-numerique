"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { cn } from "@/lib/utils"

export interface TotemCitedMedia {
  id: string
  title: string
  type: string
  year: number | null
  posterUrl: string | null
  recommendedAge: number | null
  communityAge?: number | null
  genres: string[]
  shortPitch?: string | null
}

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
  BOOK: "Livre",
  APP: "App",
}

export function TotemMediaCard({ media }: { media: TotemCitedMedia }) {
  const ageLabel = media.recommendedAge != null ? `${media.recommendedAge}+` : null
  return (
    <Link
      href={`/media/${media.id}`}
      className={cn(
        "group flex w-full max-w-[280px] gap-3 rounded-xl p-2 shadow-sm transition hover:shadow-md",
      )}
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-line)",
        color: "var(--color-ink)",
      }}
    >
      <div
        className="relative h-[110px] w-[74px] flex-shrink-0 overflow-hidden rounded-md"
        style={{ background: "var(--color-placeholder)" }}
      >
        {media.posterUrl ? (
          <SafeImage
            src={media.posterUrl}
            alt={media.title}
            fill
            sizes="74px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs" style={{ color: "var(--color-ink2)" }}>
            {TYPE_LABEL[media.type] ?? media.type}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.06em]" style={{ color: "var(--color-ink2)" }}>
            {TYPE_LABEL[media.type] ?? media.type}
            {media.year ? ` · ${media.year}` : ""}
          </div>
          <div
            className="truncate text-sm font-medium group-hover:text-[var(--color-accent)]"
            style={{ fontFamily: "var(--font-fraunces)", letterSpacing: "-0.01em" }}
          >
            {media.title}
          </div>
          {media.genres.length > 0 && (
            <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--color-ink2)" }}>
              {media.genres.slice(0, 2).join(" · ")}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          {ageLabel ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                color: "var(--color-accent)",
              }}
            >
              {ageLabel}
            </span>
          ) : (
            <span />
          )}
          <span className="text-[11px] group-hover:text-[var(--color-accent)]" style={{ color: "var(--color-ink2)" }}>
            voir la fiche →
          </span>
        </div>
      </div>
    </Link>
  )
}
