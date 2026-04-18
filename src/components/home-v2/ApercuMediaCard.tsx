"use client"

import { useEffect } from "react"
import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { FamilyFitAvatars } from "@/components/media/FamilyFitAvatars"
import { useFamilyFit } from "@/components/home/FamilyFitProvider"
import { toMediaRouteId } from "@/lib/media-route"
import { APERCU_PALETTE } from "./apercuTheme"

export interface ApercuCardMedia {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
}

export function ApercuMediaCard({
  media,
  size = "md",
  serifClass,
}: {
  media: ApercuCardMedia
  size?: "sm" | "md"
  serifClass: string
}) {
  const { getFamilyFit, registerMediaId } = useFamilyFit()
  const p = APERCU_PALETTE

  useEffect(() => {
    registerMediaId(media.id)
  }, [media.id, registerMediaId])

  const familyFit = getFamilyFit(media.id)

  const ageLabel =
    typeof media.expertAgeRec === "number" ? `${media.expertAgeRec}+` : null

  const titleClass =
    size === "sm" ? "text-[13px] leading-tight" : "text-sm leading-snug"

  return (
    <Link
      href={`/media/${toMediaRouteId(media.type, media.id)}`}
      className="group block"
    >
      <div
        className="relative aspect-[2/3] rounded-xl overflow-hidden transition-transform duration-200 group-hover:-translate-y-0.5"
        style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
      >
        {media.posterUrl && (
          <SafeImage
            src={media.posterUrl}
            alt={media.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 45vw, 20vw"
          />
        )}
        {ageLabel && (
          <div
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: "#B8D89A", color: "#2D3E1E" }}
          >
            {ageLabel}
          </div>
        )}
      </div>
      <div className="mt-1.5">
        <div
          className={`${serifClass} ${titleClass} line-clamp-2 font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          {media.title}
        </div>
        {media.genres && media.genres.length > 0 && (
          <div
            className="text-[11px] mt-0.5 line-clamp-1"
            style={{ color: p.ink2 }}
          >
            {media.genres[0]}
          </div>
        )}
      </div>
      {familyFit && familyFit.members.length > 0 && (
        <div className="mt-1">
          <FamilyFitAvatars members={familyFit.members} compact />
        </div>
      )}
    </Link>
  )
}

export function ApercuSectionHeading({
  eyebrow,
  title,
  titleAccent,
  titleTail,
  action,
  serifClass,
}: {
  eyebrow?: string
  title: string
  titleAccent?: string
  titleTail?: string
  action?: { label: string; href: string }
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && (
          <div
            className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium m-0 leading-[1.05]`}
          style={{ letterSpacing: "-0.02em", color: p.ink }}
        >
          {title}
          {titleAccent && (
            <em className="italic" style={{ color: p.accent }}>
              {" "}
              {titleAccent}
            </em>
          )}
          {titleTail && <>{titleTail}</>}
        </h2>
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-medium flex items-center gap-1.5 hover:opacity-70"
          style={{ color: p.ink }}
        >
          {action.label} <span>→</span>
        </Link>
      )}
    </div>
  )
}
