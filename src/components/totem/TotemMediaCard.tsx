"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { cn } from "@/lib/utils"
import { toMediaRouteId, type MediaType } from "@/lib/media-route"
import { TotemSeenButton } from "./TotemSeenButton"

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

export function TotemMediaCard({
  media,
  enableSeenAction = false,
}: {
  media: TotemCitedMedia
  /** Show the "Déjà vu" action (logged-in family users only; self-hides otherwise). */
  enableSeenAction?: boolean
}) {
  const ageLabel = media.recommendedAge != null ? `${media.recommendedAge}+` : null
  // Canonical route form (/media/<type>:<id>) so Totem links match the rest
  // of the site for SEO/analytics, instead of the raw-id shortcut.
  const href = media.type
    ? `/media/${toMediaRouteId(media.type as MediaType, media.id)}`
    : `/media/${media.id}`
  return (
    // Stretched-link pattern: the whole card navigates via an absolutely
    // positioned <Link>, and the content sits above it as pointer-events-none
    // so clicks fall through — except the "Déjà vu" button, which re-enables
    // pointer events. This keeps the interactive button OUT of the <a>
    // (invalid + hydration error) while preserving the full-card click target.
    <div
      className={cn(
        "group relative flex w-full max-w-[280px] gap-3 rounded-xl p-2 shadow-sm transition hover:shadow-md",
      )}
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-line)",
        color: "var(--color-ink)",
      }}
    >
      <Link href={href} aria-label={media.title} className="absolute inset-0 z-0 rounded-xl" />

      <div
        className="pointer-events-none relative z-10 h-[110px] w-[74px] flex-shrink-0 overflow-hidden rounded-md"
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
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col justify-between py-0.5">
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
        <div className="mt-1 flex items-center justify-between gap-2">
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
          {enableSeenAction ? (
            <TotemSeenButton mediaId={media.id} mediaTitle={media.title} />
          ) : (
            <span className="text-[11px] group-hover:text-[var(--color-accent)]" style={{ color: "var(--color-ink2)" }}>
              voir la fiche →
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
