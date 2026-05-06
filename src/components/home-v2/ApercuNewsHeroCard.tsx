"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatRelativeTimeFr } from "@/lib/utils"
import { APERCU_PALETTE } from "./apercuTheme"
import { ApercuNewsSourcePills } from "./ApercuNewsSourcePills"
import { ApercuPhotoCredit } from "./ApercuPhotoCredit"
import { NEWS_CATEGORY_LABEL } from "./apercuNewsLabels"
import type { ApercuNewsCardData } from "./ApercuNewsCard"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"

export function ApercuNewsHeroCard({
  story,
  serifClass,
}: {
  story: ApercuNewsCardData
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const [imageBroken, setImageBroken] = useState(false)
  // Hide the hero entirely on broken image — better empty than a giant
  // grey placeholder above the fold (matches ApercuNewsCard behavior).
  if (imageBroken || isBlockedHotlinkImageUrl(story.imageUrl)) return null
  const href = `/apercudecouverte/${story.slug}`

  return (
    <article
      className="group grid md:grid-cols-[1fr_1.3fr] gap-0 rounded-3xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="order-2 md:order-1 p-6 md:p-8 flex flex-col gap-4 justify-center">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: p.accent, color: "#FFFFFF" }}
          >
            À la une
          </span>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: p.bg2, color: p.ink }}
          >
            {NEWS_CATEGORY_LABEL[story.category]}
          </span>
        </div>
        <Link href={href} className="block">
          <h2
            className={`${serifClass} text-2xl md:text-3xl leading-[1.1] font-medium`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {story.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: p.ink2 }}>
            {story.summary}
          </p>
        </Link>
        <div className="flex items-center justify-between gap-4 pt-1">
          <ApercuNewsSourcePills sources={story.sources} />
          {/* suppressHydrationWarning — see ApercuNewsCard for the
              full reasoning; relative-time labels can flip buckets
              between server render and client hydration. */}
          <span
            className="text-xs whitespace-nowrap"
            style={{ color: p.ink2 }}
            suppressHydrationWarning
          >
            {formatRelativeTimeFr(story.publishedAt)}
          </span>
        </div>
      </div>
      <div
        className="order-1 md:order-2 relative aspect-[16/10] md:aspect-auto md:min-h-[320px]"
        style={{ background: p.placeholder }}
      >
        <Link href={href} aria-label={`Lire l'actualité : ${story.title}`} className="block absolute inset-0">
          <Image
            src={story.imageUrl}
            alt={story.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 55vw"
            priority
            onError={() => setImageBroken(true)}
          />
        </Link>
        <ApercuPhotoCredit credit={story.imageCredit} licenseUrl={story.imageLicenseUrl} />
      </div>
    </article>
  )
}
