"use client"

import Link from "next/link"
import { FlaskConical, ArrowRight } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"
import type { StoryResearch } from "./ApercuDecouverteStory"

/**
 * Compact sidebar version of the "Ce que dit la recherche" block from
 * the article detail page. Surfaces ONE recent study finding to give
 * the sidebar an editorial anchor. Links back to the full article
 * where the same research appears in expanded form.
 */
export function RechercheHighlightCard({
  research,
  storySlug,
  serifClass,
}: {
  research: StoryResearch
  // storyTitle prop kept on the type at call sites but not displayed
  // — the source attribution inside `research` already carries the
  // editorial weight. Drop the prop fully if no caller cares.
  storyTitle?: string
  storySlug: string
  serifClass: string
}) {
  const p = APERCU_PALETTE

  return (
    <Link
      href={`/apercudecouverte/${storySlug}`}
      className="group block rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{ background: p.bg2, border: `1px solid ${p.line2}` }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{ background: p.accent2, color: "#FFFFFF" }}
      >
        <FlaskConical className="w-3 h-3" />
        Ce que dit la recherche
      </div>
      <div
        className={`${serifClass} text-base font-medium mb-1.5 leading-snug`}
        style={{ color: p.ink, letterSpacing: "-0.01em" }}
      >
        {research.studyTitle}
      </div>
      <div className="text-[11px] mb-3" style={{ color: p.ink2 }}>
        {research.organization}
        {research.year ? ` · ${research.year}` : ""}
      </div>
      <p className="text-sm leading-snug mb-3" style={{ color: p.ink }}>
        {research.keyFinding}
      </p>
      <div
        className="inline-flex items-center gap-1 text-xs font-semibold group-hover:opacity-70"
        style={{ color: p.accent }}
      >
        Lire l&apos;article
        <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  )
}
