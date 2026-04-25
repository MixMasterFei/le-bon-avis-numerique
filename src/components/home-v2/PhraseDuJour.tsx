"use client"

import Link from "next/link"
import { Quote } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

/**
 * Pull-quote break inserted between major sections (e.g. between
 * French briefs and the international strand). Acts as a visual
 * pause + reading anchor — the editorial equivalent of a chapter
 * break in print.
 *
 * For the Aperçu, the quote is extracted from a real story's body
 * server-side. Later we'll add a daily key-quote agent for richer
 * curation; the layout doesn't change.
 */
export function PhraseDuJour({
  quote,
  storyTitle,
  storySlug,
  serifClass,
}: {
  quote: string
  storyTitle: string
  storySlug: string
  serifClass: string
}) {
  const p = APERCU_PALETTE

  return (
    <section className="my-10 md:my-14">
      <div
        className="relative rounded-3xl px-6 md:px-10 py-8 md:py-10"
        style={{
          background: `linear-gradient(135deg, ${p.bg2} 0%, ${p.card} 100%)`,
          border: `1px solid ${p.line}`,
        }}
      >
        <Quote
          className="absolute top-4 left-4 md:top-6 md:left-6 opacity-15"
          style={{ color: p.accent }}
          size={48}
        />
        <div className="relative pl-8 md:pl-12">
          <blockquote
            className={`${serifClass} text-xl md:text-2xl lg:text-3xl leading-snug font-medium italic`}
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            « {quote} »
          </blockquote>
          <Link
            href={`/apercudecouverte/${storySlug}`}
            className="inline-block mt-4 text-xs md:text-sm font-semibold hover:opacity-70"
            style={{ color: p.accent }}
          >
            — Tiré de « {storyTitle} » →
          </Link>
        </div>
      </div>
    </section>
  )
}
