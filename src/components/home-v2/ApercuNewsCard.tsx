"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatRelativeTimeFr } from "@/lib/utils"
import { APERCU_PALETTE } from "./apercuTheme"
import { ApercuNewsSourcePills, type NewsSourceRef } from "./ApercuNewsSourcePills"
import { ApercuPhotoCredit } from "./ApercuPhotoCredit"
import { NewsFeedbackInline } from "./NewsFeedbackInline"
import { NEWS_CATEGORY_LABEL, type NewsCategoryKey } from "./apercuNewsLabels"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"

export interface ApercuNewsCardData {
  slug: string
  title: string
  summary: string
  imageUrl: string
  category: NewsCategoryKey
  publishedAt: Date | string
  sources: NewsSourceRef[]
  // Photo credit overlay. Null on legacy rows until the
  // /api/admin/news/reprocess-images backfill stamps them.
  imageCredit?: string | null
  imageLicenseUrl?: string | null
  // Branded category-card URL to fall back to if the primary (often a raw
  // hotlinked publisher) image fails to load — e.g. a Referer 403. Lets the
  // directSource feed degrade to the clean card instead of hiding the story.
  fallbackImageUrl?: string | null
}

export function ApercuNewsCard({
  story,
  serifClass,
}: {
  story: ApercuNewsCardData
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const [src, setSrc] = useState(story.imageUrl)
  const [imageBroken, setImageBroken] = useState(false)

  // On image error: first try the branded fallback card (directSource feed —
  // a hotlinked publisher image may 403 on the browser); only hide the card
  // if even the fallback fails or there is none (V3 keeps the old behavior).
  const handleImageError = () => {
    if (story.fallbackImageUrl && src !== story.fallbackImageUrl) {
      setSrc(story.fallbackImageUrl)
    } else {
      setImageBroken(true)
    }
  }
  if (imageBroken || isBlockedHotlinkImageUrl(src)) return null

  const href = `/apercudecouverte/${story.slug}`
  // The branded category card is our own graphic, not a photo — drop the
  // "Photo : …" credit on it (only real publisher photos get credited).
  const showingFallbackCard = src.includes("/api/news/fallback-card")
  const displayCredit = showingFallbackCard ? null : story.imageCredit

  return (
    <article
      className="group flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="relative aspect-[16/9] overflow-hidden" style={{ background: p.placeholder }}>
        <Link href={href} aria-label={`Lire l'actualité : ${story.title}`} className="block absolute inset-0">
          <Image
            src={src}
            alt={story.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, 33vw"
            // Raw publisher CDN (unbounded host) — bypass the optimizer, which
            // would reject the non-allowlisted hostname at render.
            unoptimized
            onError={handleImageError}
          />
        </Link>
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: p.ink, color: p.bg }}
        >
          {NEWS_CATEGORY_LABEL[story.category]}
        </div>
        <ApercuPhotoCredit credit={displayCredit} licenseUrl={story.imageLicenseUrl} />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <Link href={href} className="block">
          <h3
            className={`${serifClass} text-lg leading-snug font-medium line-clamp-3`}
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            {story.title}
          </h3>
          <p className="mt-2 text-sm leading-snug line-clamp-3" style={{ color: p.ink2 }}>
            {story.summary}
          </p>
        </Link>
        {/* Reader feedback — "utile pour votre famille ?" One tap trains the
            news pipeline (reader signals in news-discover). */}
        <NewsFeedbackInline slug={story.slug} />

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <ApercuNewsSourcePills sources={story.sources} compact />
          {/* suppressHydrationWarning: formatRelativeTimeFr reads
              Date.now() at render time. If the server renders "il y a
              4 j" and the client hydrates a moment later still in the
              same bucket, fine; if the bucket flips at the boundary
              the texts diverge → React error #418. The text being a
              second stale during hydration is invisible to users. */}
          <span
            className="text-[11px] whitespace-nowrap"
            style={{ color: p.ink2 }}
            suppressHydrationWarning
          >
            {formatRelativeTimeFr(story.publishedAt)}
          </span>
        </div>
      </div>
    </article>
  )
}
