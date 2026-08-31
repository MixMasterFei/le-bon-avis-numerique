"use client"

import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { RedesignCard, type RedesignCardMedia } from "@/components/home-redesign/RedesignCard"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { toMediaRouteId } from "@/lib/media-route"
import { Em } from "@/components/home-redesign/parts"
import type { NlBlockKey, NlBlockVariant } from "@/lib/nl-search/blocks"
import type { AssembledCard } from "@/lib/nl-search/assemble"
import type { BlockMeta, SectionImage } from "@/lib/nl-search/resolve-blocks"
import { BoardHeading } from "./HeroMatch"

export function toRedesignCard(card: AssembledCard): RedesignCardMedia {
  return {
    id: card.id,
    type: card.type,
    title: card.title,
    posterUrl: card.posterUrl,
    expertAgeRec: card.expertAgeRec,
    genres: card.genres,
    contentMetrics: card.contentMetrics as RedesignCardMedia["contentMetrics"],
  }
}

type Accent = "terra" | "pine" | "gold"

/** Each kind of section gets its own accent, so the board reads as several
 *  distinct things rather than one list with different words on top. */
const ACCENT_BY_BLOCK: Partial<Record<NlBlockKey, Accent>> = {
  crossType: "pine",
  cinemaNow: "gold",
  upcoming: "pine",
  youngerSiblings: "pine",
  blogPicks: "gold",
}

export function accentFor(key: NlBlockKey): Accent {
  return ACCENT_BY_BLOCK[key] ?? "terra"
}

const ACCENT_VAR: Record<Accent, string> = {
  terra: "var(--terra)",
  pine: "var(--pine-2)",
  gold: "var(--gold)",
}

/**
 * Inside a dark band we re-point the V2 tokens rather than restyling anything.
 * Every child — cards, badges, chips — already reads --ink / --line / --card,
 * so the whole design system inverts itself and nothing needs a dark variant of
 * its own.
 */
const DARK_TOKENS = {
  "--ink": "#FBF5EA",
  "--ink-2": "rgba(251,245,234,.82)",
  "--ink-3": "rgba(251,245,234,.58)",
  "--line": "rgba(251,245,234,.18)",
  "--line-2": "rgba(251,245,234,.12)",
  "--paper": "#23493D",
  "--paper-2": "rgba(251,245,234,.08)",
  "--card": "rgba(251,245,234,.06)",
  "--placeholder": "rgba(251,245,234,.12)",
} as unknown as CSSProperties

const CONTAINER = "mx-auto max-w-[1240px] px-5 sm:px-7"

/* ------------------------------------------------------------------ *
 * Card layouts
 * ------------------------------------------------------------------ */

/** Compact row used by the numbered variant: rank, poster, title. */
function NumberedItem({ media, rank, accent }: { media: RedesignCardMedia; rank: number; accent: Accent }) {
  return (
    <Link
      href={`/media/${toMediaRouteId(media.type, media.id)}`}
      className="group flex items-center gap-4 transition-transform duration-200 hover:-translate-y-0.5"
    >
      <span
        className="w-[1.6ch] shrink-0 text-right text-[clamp(30px,4vw,52px)] font-bold leading-none"
        style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.04em", color: ACCENT_VAR[accent], opacity: 0.42 }}
      >
        {rank}
      </span>
      <div
        className="relative aspect-[2/3] w-[62px] shrink-0 overflow-hidden rounded-[10px] sm:w-[74px]"
        style={{ background: "var(--placeholder, #E6DFCE)", border: "1px solid var(--line)" }}
      >
        {media.posterUrl && (
          <SafeImage
            src={tmdbPosterAtSize(media.posterUrl, "w342")}
            alt={media.title}
            fill
            sizes="80px"
            className="object-cover"
            fallbackClassName="h-full w-full"
          />
        )}
      </div>
      <div className="min-w-0">
        <p
          className="truncate text-[15px] font-bold"
          style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.01em", color: "var(--ink)" }}
        >
          {media.title}
        </p>
        <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          {media.expertAgeRec !== null ? `Dès ${media.expertAgeRec} ans` : "Âge à confirmer"}
          {media.genres?.[0] ? ` · ${media.genres[0]}` : ""}
        </p>
      </div>
    </Link>
  )
}

/**
 * The « pas celui-là » control. A sibling overlay, not a child of the card's
 * link — clicking it must remove, never navigate. It sits at the top right of
 * the poster, next to the age totem, per the family's curation flow: hidden
 * until hover on fine pointers, always visible on touch. When `onRemove` is
 * absent (shared boards, the /tableau view) the card renders exactly as before.
 */
function Removable({
  media,
  onRemove,
  children,
}: {
  media: RedesignCardMedia
  onRemove?: (id: string) => void
  children: ReactNode
}) {
  if (!onRemove) return <>{children}</>
  return (
    <div className="group/rm relative">
      {children}
      <button
        type="button"
        onClick={() => onRemove(media.id)}
        title="Retirer de cette sélection"
        aria-label={`Retirer ${media.title} de cette sélection`}
        className="absolute right-14 top-2.5 z-30 grid h-7 w-7 place-items-center rounded-full text-white backdrop-blur-[3px] transition-opacity hover:opacity-100 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/rm:opacity-100"
        style={{ background: "rgba(15,12,8,.55)", border: "1px solid rgba(255,255,255,.22)" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function Cards({
  variant,
  items,
  accent,
  onRemove,
}: {
  variant: NlBlockVariant
  items: RedesignCardMedia[]
  accent: Accent
  onRemove?: (id: string) => void
}) {
  // Each variant states what it needs; anything short of that falls back to the
  // plain grid rather than rendering a broken shape.
  if (variant === "numbered") {
    return (
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {items.slice(0, 8).map((media, index) => (
          <div key={media.id} className="group/rm relative flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <NumberedItem media={media} rank={index + 1} accent={accent} />
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(media.id)}
                title="Retirer de cette sélection"
                aria-label={`Retirer ${media.title} de cette sélection`}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full transition-opacity hover:opacity-100 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/rm:opacity-100"
                style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink-3)" }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  if (variant === "mosaic" && items.length >= 6) {
    const [lead, ...rest] = items
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 row-span-2">
          <Removable media={lead} onRemove={onRemove}>
            <RedesignCard media={lead} totem="full" showType />
          </Removable>
        </div>
        {rest.slice(0, 8).map((media) => (
          <Removable key={media.id} media={media} onRemove={onRemove}>
            <RedesignCard media={media} totem="compact" showType />
          </Removable>
        ))}
      </div>
    )
  }

  if (variant === "wide") {
    return (
      <div className="v2-row-lg">
        {items.map((media) => (
          <Removable key={media.id} media={media} onRemove={onRemove}>
            <RedesignCard media={media} totem="full" showType />
          </Removable>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((media) => (
        <Removable key={media.id} media={media} onRemove={onRemove}>
          <RedesignCard media={media} totem="compact" showType />
        </Removable>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The section shell
 * ------------------------------------------------------------------ */

function SectionHead({
  meta,
  accent,
  fallback,
  folio,
  count,
}: {
  meta: BlockMeta
  accent: Accent
  fallback: string
  /** Rubric number ("01"), per the magazine spec. */
  folio?: string | null
  /** Item count shown against the rule, tabular. */
  count?: number
}) {
  return (
    <div className="mb-7">
      <div className="flex items-end justify-between gap-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: ACCENT_VAR[accent] }} />
          <span className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT_VAR[accent] }}>
            {meta.eyebrow ?? fallback}
          </span>
        </div>
        {typeof count === "number" && count > 0 && (
          <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--ink-3)" }}>
            {count} {count > 1 ? "titres" : "titre"}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start gap-5">
        {folio && (
          <span
            aria-hidden
            className="mt-1 text-[clamp(30px,4vw,52px)] font-bold leading-none"
            style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.04em", color: ACCENT_VAR[accent], opacity: 0.42 }}
          >
            {folio}
          </span>
        )}
        <div className="min-w-0">
          <BoardHeading title={meta.title ?? fallback} em={meta.em} tone={accent} />
          {meta.lead && (
            <p className="mt-2.5 max-w-[56ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              {meta.lead}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * One band of the board. Owns its own container, so a section can stripe,
 * invert or bleed to the edges — which is what makes the page read as composed
 * rather than as one long scroll.
 */
export function BoardBand({
  meta,
  accent,
  alt,
  sectionImage,
  fallbackTitle,
  folio,
  count,
  children,
}: {
  meta: BlockMeta
  accent: Accent
  alt: boolean
  sectionImage?: SectionImage | null
  fallbackTitle: string
  folio?: string | null
  count?: number
  children: ReactNode
}) {
  const dark = meta.variant === "dark"
  // fullBleed needs wide art. Games never have any, so the section quietly
  // becomes an ordinary band instead of a broken one.
  const bleeding = meta.variant === "fullBleed" && !!sectionImage

  if (bleeding) {
    return (
      <section className="py-[52px] md:py-[62px]" style={{ background: "var(--paper)" }}>
        <div className="relative mb-8 overflow-hidden py-[68px]">
          <div className="absolute inset-0" aria-hidden>
            <SafeImage
              src={sectionImage!.url}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              fallbackClassName="h-full w-full"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(100deg, rgba(20,15,10,.90) 0%, rgba(20,15,10,.66) 55%, rgba(20,15,10,.34) 100%)" }}
            />
          </div>
          <div className={`relative ${CONTAINER}`}>
            {meta.eyebrow && (
              <p className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "#E8B48A" }}>
                {meta.eyebrow}
              </p>
            )}
            <h3
              className="mt-2 max-w-[20ch] text-[clamp(26px,3.6vw,44px)] font-bold leading-[1.04]"
              style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "#FFFDF8" }}
            >
              {meta.title ?? fallbackTitle}
            </h3>
            {meta.lead && (
              <p className="mt-3 max-w-[54ch] text-[15px]" style={{ color: "rgba(255,253,248,.82)" }}>
                {meta.lead}
              </p>
            )}
          </div>
        </div>
        <div className={CONTAINER}>{children}</div>
      </section>
    )
  }

  return (
    <section
      className="py-[52px] md:py-[62px]"
      style={
        dark
          ? { ...DARK_TOKENS, background: "var(--pine)", color: "#FBF5EA" }
          : alt
            ? { background: "var(--paper-2)", borderBlock: "1px solid var(--line)" }
            : { background: "var(--paper)" }
      }
    >
      <div className={CONTAINER}>
        <SectionHead meta={meta} accent={dark ? "gold" : accent} fallback={fallbackTitle} folio={folio} count={count} />
        {children}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Exported sections
 * ------------------------------------------------------------------ */

export function GridBlock({
  meta,
  items,
  alt,
  sectionImage,
  folio,
  onRemove,
}: {
  meta: BlockMeta
  items: RedesignCardMedia[]
  alt: boolean
  sectionImage?: SectionImage | null
  folio?: string | null
  onRemove?: (id: string) => void
}) {
  return (
    <BoardBand meta={meta} accent="terra" alt={alt} sectionImage={sectionImage} fallbackTitle="La sélection" folio={folio} count={items.length}>
      <Cards variant={meta.variant} items={items} accent="terra" onRemove={onRemove} />
    </BoardBand>
  )
}

export function RailBlock({
  blockKey,
  meta,
  items,
  alt,
  sectionImage,
  folio,
  onRemove,
}: {
  blockKey: NlBlockKey
  meta: BlockMeta
  items: RedesignCardMedia[]
  alt: boolean
  sectionImage?: SectionImage | null
  folio?: string | null
  onRemove?: (id: string) => void
}) {
  const accent = accentFor(blockKey)
  return (
    <BoardBand meta={meta} accent={accent} alt={alt} sectionImage={sectionImage} fallbackTitle="Une autre piste" folio={folio} count={items.length}>
      <Cards variant={meta.variant} items={items} accent={accent} onRemove={onRemove} />
    </BoardBand>
  )
}

/**
 * The typographic blocks. These carry no data — they are what makes a board
 * read as authored, and the reason a statement can land mid-page.
 */
export function EditorialBlock({
  variant,
  meta,
}: {
  variant: "displayTitle" | "interstitial" | "closingCta"
  meta: BlockMeta
}) {
  if (variant === "interstitial") {
    if (!meta.title && !meta.lead) return null
    return (
      <section className="py-[52px]" style={{ background: "var(--paper)" }}>
        <div className={CONTAINER}>
          <div className="rounded-[18px] px-6 py-7 sm:px-8" style={{ background: "var(--pine)", color: "#FBF5EA" }}>
            {meta.eyebrow && (
              <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(251,245,234,.62)" }}>
                {meta.eyebrow}
              </p>
            )}
            {meta.title && (
              <p
                className="mt-1.5 max-w-[34ch] text-[clamp(20px,2.6vw,30px)] font-bold leading-[1.12]"
                style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em" }}
              >
                {meta.title}
              </p>
            )}
            {meta.lead && (
              <p className="mt-2 max-w-[60ch] text-[14.5px]" style={{ color: "rgba(251,245,234,.82)" }}>
                {meta.lead}
              </p>
            )}
          </div>
        </div>
      </section>
    )
  }

  if (variant === "closingCta") {
    return (
      <section className="py-[62px]" style={{ background: "var(--paper-2)", borderBlock: "1px solid var(--line)" }}>
        <div className={`${CONTAINER} text-center`}>
          <h2
            className="mx-auto max-w-[18ch] text-[clamp(24px,3.4vw,40px)] font-bold leading-[1.06]"
            style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
          >
            {meta.title ?? (
              <>
                Envie d&apos;une <Em tone="terra">autre idée</Em> ?
              </>
            )}
          </h2>
          {meta.lead && (
            <p className="mx-auto mt-3 max-w-[52ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              {meta.lead}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/recherche"
              className="rounded-full px-5 py-[11px] text-[14.5px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--terra)" }}
            >
              Explorer le catalogue
            </Link>
            <Link
              href="/"
              className="rounded-full px-5 py-[11px] text-[14.5px] font-bold transition-opacity hover:opacity-75"
              style={{ background: "var(--card)", border: "1px solid var(--line)", color: "var(--ink)" }}
            >
              Poser une autre question
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (!meta.title) return null
  return (
    <section className="pt-[62px]" style={{ background: "var(--paper)" }}>
      <div className={CONTAINER}>
        {meta.eyebrow && (
          <p className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
            {meta.eyebrow}
          </p>
        )}
        <div className="mt-2 max-w-[20ch]">
          <BoardHeading title={meta.title} em={meta.em} />
        </div>
        {meta.lead && (
          <p className="mt-3 max-w-[58ch] text-[15.5px]" style={{ color: "var(--ink-2)" }}>
            {meta.lead}
          </p>
        )}
      </div>
    </section>
  )
}
