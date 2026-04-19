"use client"

import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { formatRelativeTimeFr } from "@/lib/utils"
import { APERCU_PALETTE } from "./apercuTheme"
import { ApercuNewsSourcePills, type NewsSourceRef } from "./ApercuNewsSourcePills"
import { NEWS_CATEGORY_LABEL, type NewsCategoryKey } from "./apercuNewsLabels"

export interface ApercuNewsCardData {
  slug: string
  title: string
  summary: string
  imageUrl: string
  category: NewsCategoryKey
  publishedAt: Date | string
  sources: NewsSourceRef[]
}

export function ApercuNewsCard({
  story,
  serifClass,
}: {
  story: ApercuNewsCardData
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <Link
      href={`/apercudecouverte/${story.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="relative aspect-[16/9] overflow-hidden" style={{ background: p.placeholder }}>
        <SafeImage
          src={story.imageUrl}
          alt={story.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: p.ink, color: p.bg }}
        >
          {NEWS_CATEGORY_LABEL[story.category]}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3
          className={`${serifClass} text-lg leading-snug font-medium line-clamp-2`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          {story.title}
        </h3>
        <p className="text-sm leading-snug line-clamp-3" style={{ color: p.ink2 }}>
          {story.summary}
        </p>
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <ApercuNewsSourcePills sources={story.sources} compact />
          <span className="text-[11px] whitespace-nowrap" style={{ color: p.ink2 }}>
            {formatRelativeTimeFr(story.publishedAt)}
          </span>
        </div>
      </div>
    </Link>
  )
}
