"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { ArrowLeft, ExternalLink, FlaskConical } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuNewsSourcePills, type NewsSourceRef } from "./ApercuNewsSourcePills"
import { APERCU_PALETTE } from "./apercuTheme"
import { NEWS_CATEGORY_LABEL, type NewsCategoryKey } from "./apercuNewsLabels"

export interface StoryResearch {
  studyTitle: string
  organization: string
  year: number | null
  methodology: string
  keyFinding: string
  caveat?: string
  sourceUrl?: string
}

export interface ApercuStoryDetail {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  category: NewsCategoryKey
  imageUrl: string
  publishedAt: Date | string
  sources: NewsSourceRef[]
  /** Optional "Ce que dit la recherche" sidebar block. */
  research?: StoryResearch | null
}

function formatAbsolute(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ApercuDecouverteStory({
  story,
  serifClass,
  commentsSlot,
}: {
  story: ApercuStoryDetail
  serifClass: string
  commentsSlot?: ReactNode
}) {
  const p = APERCU_PALETTE
  return (
    <div
      className="flex flex-col min-h-screen overflow-x-hidden"
      style={{ background: p.bg, color: p.ink }}
    >
      <ApercuPreviewBanner />
      <ApercuNav />

      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4 md:px-8 max-w-3xl">
          <Link
            href="/apercudecouverte"
            className="inline-flex items-center gap-1.5 text-sm mb-6 hover:opacity-70"
            style={{ color: p.ink2 }}
          >
            <ArrowLeft className="w-4 h-4" />
            Toutes les découvertes
          </Link>

          <div className="flex items-center gap-2 mb-4">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: p.bg2, color: p.ink }}
            >
              {NEWS_CATEGORY_LABEL[story.category]}
            </span>
            <span className="text-xs" style={{ color: p.ink2 }}>
              {formatAbsolute(story.publishedAt)}
            </span>
          </div>

          <h1
            className={`${serifClass} text-3xl md:text-5xl leading-[1.05] font-medium mb-4`}
            style={{ color: p.ink, letterSpacing: "-0.02em" }}
          >
            {story.title}
          </h1>
          <p className="text-lg leading-relaxed mb-6" style={{ color: p.ink2 }}>
            {story.summary}
          </p>

          <div className="mb-8">
            <ApercuNewsSourcePills sources={story.sources} />
          </div>

          <div
            className="relative aspect-[16/9] rounded-3xl overflow-hidden mb-8"
            style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
          >
            <SafeImage
              src={story.imageUrl}
              alt={story.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>

          {story.research && (
            <aside
              className="mb-8 rounded-2xl p-5 md:p-6"
              style={{
                background: p.bg2,
                border: `1px solid ${p.line2}`,
              }}
            >
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
                style={{ background: p.accent2, color: "#FFFFFF" }}
              >
                <FlaskConical className="w-3 h-3" />
                Ce que dit la recherche
              </div>
              <div
                className={`${serifClass} text-base md:text-lg font-medium mb-2`}
                style={{ color: p.ink, letterSpacing: "-0.01em" }}
              >
                {story.research.studyTitle}
              </div>
              <div className="text-xs mb-3" style={{ color: p.ink2 }}>
                {story.research.organization}
                {story.research.year ? ` · ${story.research.year}` : ""}
              </div>
              <dl className="space-y-2 text-sm" style={{ color: p.ink }}>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: p.ink2 }}>
                    Méthodologie
                  </dt>
                  <dd>{story.research.methodology}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: p.ink2 }}>
                    Résultat clé
                  </dt>
                  <dd>{story.research.keyFinding}</dd>
                </div>
                {story.research.caveat && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: p.ink2 }}>
                      À nuancer
                    </dt>
                    <dd>{story.research.caveat}</dd>
                  </div>
                )}
              </dl>
              {story.research.sourceUrl && (
                <a
                  href={story.research.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold hover:opacity-70"
                  style={{ color: p.accent }}
                >
                  Lire l&apos;étude originale
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </aside>
          )}

          <article
            className="prose prose-neutral max-w-none"
            style={{ color: p.ink }}
          >
            <ReactMarkdown>{story.body}</ReactMarkdown>
          </article>

          {commentsSlot}

          <div
            className="mt-12 pt-6"
            style={{ borderTop: `1px solid ${p.line}` }}
          >
            <div
              className="text-[11px] font-semibold uppercase tracking-wide mb-3"
              style={{ color: p.accent }}
            >
              Toutes les sources
            </div>
            <ul className="flex flex-col gap-2">
              {story.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2.5 p-3 rounded-xl transition-colors"
                    style={{ background: p.card, border: `1px solid ${p.line}` }}
                  >
                    {s.favicon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.favicon}
                        alt=""
                        className="w-4 h-4 rounded-sm mt-0.5 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: p.ink2 }}
                      >
                        {s.name}
                      </div>
                      {s.headline && (
                        <div
                          className="text-sm font-medium leading-snug"
                          style={{ color: p.ink }}
                        >
                          {s.headline}
                        </div>
                      )}
                    </div>
                    <ExternalLink
                      className="w-3.5 h-3.5 flex-shrink-0 mt-1 opacity-50 group-hover:opacity-80"
                      style={{ color: p.ink2 }}
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
