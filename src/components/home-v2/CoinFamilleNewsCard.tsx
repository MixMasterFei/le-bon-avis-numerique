"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, ExternalLink } from "lucide-react"
import { formatRelativeTimeFr } from "@/lib/utils"
import { APERCU_PALETTE } from "./apercuTheme"
import { ApercuNewsSourcePills } from "./ApercuNewsSourcePills"
import { ApercuPhotoCredit } from "./ApercuPhotoCredit"
import { NewsFeedbackInline } from "./NewsFeedbackInline"
import { NEWS_CATEGORY_LABEL } from "./apercuNewsLabels"
import { isBlockedHotlinkImageUrl } from "@/lib/news-image-policy"
import type { CoinFamilleNewsItem } from "@/lib/coin-famille-news"

/**
 * Coin Famille news card — compact + always-imaged, the legal-safe mechanic.
 *
 * Shows the publisher HEADLINE (facts) over a thumbnail, an inline "expand"
 * revealing Totem Avisé's own angle (`familyTakeaway`, original opinion) with a
 * "Lire l'article" button to the original publisher. No link to an internal
 * summary page — we curate + add our opinion + link out, never republishing.
 */
export function CoinFamilleNewsCard({
  story,
  serifClass,
}: {
  story: CoinFamilleNewsItem
  serifClass: string
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
  const panelId = `cf-news-${story.slug}`

  // The branded category card is our own graphic, not a photo — so no
  // "Photo : …" credit belongs on it. Only credit a real publisher photo.
  const showingFallbackCard = src.includes("/api/news/fallback-card")
  const displayCredit = showingFallbackCard ? null : story.imageCredit
  const { articleUrl } = story

  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="relative aspect-[16/9]" style={{ background: p.placeholder }}>
        {showImage ? (
          articleUrl ? (
            // Tapping the photo opens the original publisher article — the
            // fastest path to the source on touch (no accordion to expand).
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Lire l'article : ${story.headline}`}
              className="absolute inset-0 block"
            >
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
                // Raw publisher CDN (unbounded host) — bypass the optimizer.
                unoptimized
                onError={handleImageError}
              />
            </a>
          ) : (
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 25vw"
              unoptimized
              onError={handleImageError}
            />
          )
        ) : (
          // Guarantee an image slot even if the branded card also fails.
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: p.bg2 }}>
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: p.ink2 }}>
              {NEWS_CATEGORY_LABEL[story.category]}
            </span>
          </div>
        )}
        <div
          className="pointer-events-none absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: p.ink, color: p.bg }}
        >
          {NEWS_CATEGORY_LABEL[story.category]}
        </div>
        <ApercuPhotoCredit credit={displayCredit} licenseUrl={story.imageLicenseUrl} />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* title attr = full headline on hover (the clamp cuts long ones).
            The headline links straight to the publisher article, like the
            photo above it. */}
        <h3
          className={`${serifClass} text-[15px] leading-snug font-medium line-clamp-2`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
          title={story.headline}
        >
          {articleUrl ? (
            <a
              href={articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-70"
            >
              {story.headline}
            </a>
          ) : (
            story.headline
          )}
        </h3>

        <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
          <ApercuNewsSourcePills sources={story.sources} compact />
          <span
            className="text-[10.5px] whitespace-nowrap"
            style={{ color: p.ink2 }}
            suppressHydrationWarning
          >
            {formatRelativeTimeFr(story.publishedAt)}
          </span>
        </div>

        {/* Reader feedback — "utile pour votre famille ?" One tap trains the
            news pipeline (reader signals in news-discover). */}
        <NewsFeedbackInline slug={story.slug} />

        {/* Totem's angle — inline accordion, NO navigation. */}
        {story.familyTakeaway ? (
          <div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={panelId}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: p.accent }}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              Pourquoi c&apos;est intéressant
            </button>
            {open && (
              <div
                id={panelId}
                className="mt-2 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed"
                style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink2 }}
              >
                {/* Text and button on separate blocks — inline, the dark pill
                    sat ON the last line of text and hid it. */}
                <p className="m-0">{story.familyTakeaway}</p>
                {story.articleUrl && (
                  <div className="mt-2.5">
                    <a
                      href={story.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold transition-opacity hover:opacity-80"
                      style={{ background: p.ink, color: p.bg }}
                    >
                      Lire l&apos;article
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          story.articleUrl && (
            <a
              href={story.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: p.accent }}
            >
              Lire l&apos;article
              <ExternalLink className="h-3 w-3" />
            </a>
          )
        )}
      </div>
    </article>
  )
}
