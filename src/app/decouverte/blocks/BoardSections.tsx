"use client"

import Link from "next/link"
import { RedesignCard, type RedesignCardMedia } from "@/components/home-redesign/RedesignCard"
import { Em } from "@/components/home-redesign/parts"
import type { AssembledCard } from "@/lib/nl-search/assemble"
import type { BlockMeta } from "@/lib/nl-search/resolve-blocks"
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

/** The main results: every match, in a full grid rather than a single row. */
export function GridBlock({ meta, items }: { meta: BlockMeta; items: RedesignCardMedia[] }) {
  return (
    <section className="mt-12">
      {(meta.eyebrow || meta.title) && (
        <div className="mb-5">
          {meta.eyebrow && (
            <p className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
              {meta.eyebrow}
            </p>
          )}
          {meta.title && <div className="mt-1.5"><BoardHeading title={meta.title} em={meta.em} /></div>}
          {meta.lead && (
            <p className="mt-2 max-w-[56ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              {meta.lead}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((media) => (
          <RedesignCard key={media.id} media={media} totem="compact" showType />
        ))}
      </div>
    </section>
  )
}

/**
 * A complementary selection. Uses the house `.v2-row` treatment — one row that
 * trims to the breakpoint rather than a carousel, which is what every other
 * rail on the site does.
 */
export function RailBlock({
  meta,
  items,
  action,
}: {
  meta: BlockMeta
  items: RedesignCardMedia[]
  action?: { label: string; href: string }
}) {
  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--line)" }}>
      <div className="mb-5 flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {meta.eyebrow && (
            <p className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
              {meta.eyebrow}
            </p>
          )}
          <div className="mt-1.5">
            <BoardHeading title={meta.title ?? "Une autre piste"} em={meta.em} as="h3" />
          </div>
          {meta.lead && (
            <p className="mt-2 max-w-[56ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
              {meta.lead}
            </p>
          )}
        </div>
        {action && (
          <Link
            href={action.href}
            className="whitespace-nowrap text-[14px] font-bold transition-opacity hover:opacity-75"
            style={{ color: "var(--terra)" }}
          >
            {action.label} →
          </Link>
        )}
      </div>
      <div className="v2-row">
        {items.map((media) => (
          <RedesignCard key={media.id} media={media} totem="compact" showType />
        ))}
      </div>
    </section>
  )
}

/**
 * The typographic blocks. These carry no data — they are what makes a board
 * read as composed rather than as a list of rails, and they are the reason a
 * big statement can land in the middle of the page.
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
      <section className="mt-14">
        <div
          className="rounded-[18px] px-6 py-7 sm:px-8"
          style={{ background: "var(--pine)", color: "#FBF5EA" }}
        >
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
      </section>
    )
  }

  if (variant === "closingCta") {
    return (
      <section className="mt-16 border-t pt-12 text-center" style={{ borderColor: "var(--line)" }}>
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
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)", color: "var(--ink)" }}
          >
            Poser une autre question
          </Link>
        </div>
      </section>
    )
  }

  // displayTitle — a full-width statement that breaks the rhythm of the rails.
  if (!meta.title) return null
  return (
    <section className="mt-16">
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
    </section>
  )
}
