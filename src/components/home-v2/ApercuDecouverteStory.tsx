"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import { ArrowLeft, ExternalLink, FlaskConical, Clock } from "lucide-react"
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

          {/* Reading-time estimate (200 wpm — French average) sits
              just above the body so readers know the commitment. */}
          <ReadingTime body={story.body} serifClass={serifClass} />

          {/*
            Explicit ReactMarkdown component map — gives us bulletproof
            paragraph spacing instead of relying on Tailwind's prose-p:
            modifier (which can miss ReactMarkdown's <p> output depending
            on how the plugin is wired). Each element type carries its
            own typography. Generous mb-7 between paragraphs is the
            "easy to read" Xavier specifically asked for.
          */}
          <article className="max-w-none" style={{ color: p.ink }}>
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p
                    className="mb-7 last:mb-0 leading-[1.7] text-[17px] md:text-[18px]"
                    style={{ color: p.ink }}
                  >
                    {children}
                  </p>
                ),
                h2: ({ children }) => (
                  <h2
                    className={`${serifClass} mt-10 mb-4 text-2xl md:text-3xl font-medium leading-tight`}
                    style={{ color: p.ink, letterSpacing: "-0.02em" }}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    className={`${serifClass} mt-8 mb-3 text-xl md:text-2xl font-medium leading-tight`}
                    style={{ color: p.ink, letterSpacing: "-0.01em" }}
                  >
                    {children}
                  </h3>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold" style={{ color: p.ink }}>
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic">{children}</em>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:opacity-70"
                    style={{ color: p.accent }}
                  >
                    {children}
                  </a>
                ),
                ul: ({ children }) => (
                  <ul className="mb-7 space-y-2 list-disc pl-6 text-[17px] md:text-[18px] leading-[1.7]">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-7 space-y-2 list-decimal pl-6 text-[17px] md:text-[18px] leading-[1.7]">
                    {children}
                  </ol>
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    className={`${serifClass} my-7 pl-5 italic text-lg md:text-xl leading-snug`}
                    style={{ borderLeft: `3px solid ${p.accent}`, color: p.ink2 }}
                  >
                    {children}
                  </blockquote>
                ),
              }}
            >
              {story.body}
            </ReactMarkdown>
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

/**
 * Compact reading-time chip rendered above the article body. Plain
 * 200 wpm estimate — close to the French reading-rate norm. The
 * <1 minute floor keeps a sub-150-word body from showing "0 min".
 */
function ReadingTime({ body, serifClass }: { body: string; serifClass: string }) {
  const p = APERCU_PALETTE
  const words = body.replace(/[#*_>\-]/g, " ").split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.round(words / 200))
  return (
    <div
      className={`${serifClass} inline-flex items-center gap-1.5 text-xs mb-5 px-2.5 py-1 rounded-full`}
      style={{ background: p.bg2, color: p.ink2 }}
    >
      <Clock className="w-3 h-3" />
      <span>{minutes} min de lecture · {words.toLocaleString("fr-FR")} mots</span>
    </div>
  )
}
