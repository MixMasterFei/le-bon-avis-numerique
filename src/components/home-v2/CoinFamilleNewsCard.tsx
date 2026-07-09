"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, ExternalLink } from "lucide-react"
import { formatRelativeTimeFr } from "@/lib/utils"
import { APERCU_PALETTE } from "./apercuTheme"
import { ApercuNewsSourcePills } from "./ApercuNewsSourcePills"
import { ApercuPhotoCredit } from "./ApercuPhotoCredit"
import { NEWS_CATEGORY_LABEL } from "./apercuNewsLabels"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"
import type { CoinFamilleNewsItem } from "@/lib/coin-famille-news"

/**
 * Coin Famille news card — the legal-safe mechanic.
 *
 * Shows the publisher HEADLINE (facts), an inline "expand" that reveals
 * Totem Avisé's own angle (`familyTakeaway`, original opinion), and a
 * "Lire l'article" button straight to the original publisher. There is NO
 * link to an internal `/apercudecouverte/<slug>` summary — that's the point:
 * we curate + add our opinion + link out, never republishing a synthesis.
 */
export function CoinFamilleNewsCard({
  story,
  serifClass,
  featured = false,
}: {
  story: CoinFamilleNewsItem
  serifClass: string
  featured?: boolean
}) {
  const p = APERCU_PALETTE
  const [src, setSrc] = useState(story.imageUrl)
  const [imageBroken, setImageBroken] = useState(false)
  const [open, setOpen] = useState(false)

  const handleImageError = () => {
    if (story.fallbackImageUrl && src !== story.fallbackImageUrl) setSrc(story.fallbackImageUrl)
    else setImageBroken(true)
  }
  const showImage = !imageBroken && !isBlockedHotlinkImageUrl(src)
  const panelId = `cf-takeaway-${story.slug}`

  const ImageBlock = (
    <div
      className={`relative overflow-hidden ${featured ? "aspect-[16/10] md:aspect-auto md:h-full" : "aspect-[16/9]"}`}
      style={{ background: p.placeholder }}
    >
      {showImage ? (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes={featured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 33vw"}
          // Raw publisher CDN (unbounded host) — bypass the optimizer, which
          // would reject the non-allowlisted hostname at render.
          unoptimized
          onError={handleImageError}
        />
      ) : null}
      <div
        className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: p.ink, color: p.bg }}
      >
        {NEWS_CATEGORY_LABEL[story.category]}
      </div>
      <ApercuPhotoCredit credit={story.imageCredit} licenseUrl={story.imageLicenseUrl} />
    </div>
  )

  const Body = (
    <div className="flex flex-1 flex-col gap-2 p-4">
      <h3
        className={`${serifClass} font-medium leading-snug ${featured ? "text-xl md:text-2xl" : "text-lg line-clamp-3"}`}
        style={{ color: p.ink, letterSpacing: "-0.01em" }}
      >
        {story.headline}
      </h3>

      <div className="flex items-center justify-between gap-2">
        <ApercuNewsSourcePills sources={story.sources} compact />
        {/* suppressHydrationWarning: relative time reads Date.now() at render;
            a one-bucket drift during hydration is invisible (see ApercuNewsCard). */}
        <span
          className="text-[11px] whitespace-nowrap"
          style={{ color: p.ink2 }}
          suppressHydrationWarning
        >
          {formatRelativeTimeFr(story.publishedAt)}
        </span>
      </div>

      {/* Totem's angle — inline accordion, NO navigation. */}
      {story.familyTakeaway && (
        <div className="mt-auto pt-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: p.accent }}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
            Pourquoi c&apos;est intéressant pour les familles
          </button>
          {open && (
            <div
              id={panelId}
              className="mt-2 rounded-xl px-3.5 py-3 text-[13.5px] leading-relaxed"
              style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink2 }}
            >
              {story.familyTakeaway}
            </div>
          )}
        </div>
      )}

      {/* Outbound to the ORIGINAL publisher — new tab, no synthesis. */}
      {story.articleUrl && (
        <a
          href={story.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-opacity hover:opacity-80"
          style={{ background: p.ink, color: p.bg }}
        >
          Lire l&apos;article
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )

  return (
    <article
      className={`flex overflow-hidden rounded-2xl ${featured ? "flex-col md:flex-row md:items-stretch" : "flex-col"}`}
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className={featured ? "md:w-1/2" : ""}>{ImageBlock}</div>
      <div className={featured ? "md:w-1/2" : ""} style={{ display: "flex" }}>
        {Body}
      </div>
    </article>
  )
}
