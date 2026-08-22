"use client"

import { useState } from "react"
import Link from "next/link"
import { Info, AlertTriangle, Sparkles, ArrowUpRight, Quote } from "lucide-react"
import {
  DECK,
  type DeckBlock,
  type DeckChapter,
  type LiveValues,
  type StatValue,
} from "@/lib/steph/knowledge"
import { StephCard, stephPalette, stephSerif } from "./StephShell"

const p = stephPalette
const serif = stephSerif.className

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

/** Résout une valeur de statistique : littérale, ou lue dans la base. */
function resolveStat(value: StatValue, live: LiveValues): string {
  if (typeof value === "string") return value
  return `${fmt(live[value.live])}${value.suffix ?? ""}`
}

// ── Blocs ─────────────────────────────────────────────────────────────

const CALLOUT_STYLE = {
  info: { bg: "rgba(141,189,201,0.16)", border: "#8DBDC9", ink: "#1E3E47", Icon: Info },
  warn: { bg: "rgba(209,106,74,0.10)", border: "#D16A4A", ink: "#8F3A20", Icon: AlertTriangle },
  good: { bg: "rgba(92,138,92,0.12)", border: "#5C8A5C", ink: "#3E6640", Icon: Sparkles },
} as const

function Block({ block, live }: { block: DeckBlock; live: LiveValues }) {
  switch (block.kind) {
    case "text":
      return (
        <div className="flex flex-col gap-4">
          {block.body.map((paragraph, i) => (
            <p key={i} className="text-[15px] md:text-base leading-[1.75]" style={{ color: p.ink }}>
              {paragraph}
            </p>
          ))}
        </div>
      )

    case "points":
      return (
        <div className="flex flex-col gap-3">
          {block.title && (
            <h3 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: p.ink2 }}>
              {block.title}
            </h3>
          )}
          <div className="flex flex-col gap-3">
            {block.items.map((item) => (
              <StephCard key={item.label} accent={p.line2 as string}>
                <div className="text-sm font-bold mb-1" style={{ color: p.ink }}>
                  {item.label}
                </div>
                <p className="text-[15px] leading-relaxed" style={{ color: p.ink2 }}>
                  {item.desc}
                </p>
              </StephCard>
            ))}
          </div>
        </div>
      )

    case "quote":
      return (
        <figure
          className="rounded-2xl p-6 md:p-8 flex flex-col gap-3"
          style={{ background: p.bg2, borderLeft: `4px solid ${p.accent}` }}
        >
          <Quote className="h-5 w-5" style={{ color: p.accent }} aria-hidden />
          <blockquote
            className={`${serif} text-lg md:text-2xl leading-snug font-medium`}
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            {block.text}
          </blockquote>
          {block.source && (
            <figcaption className="text-xs" style={{ color: p.ink2 }}>
              {block.source}
            </figcaption>
          )}
        </figure>
      )

    case "stats":
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {block.items.map((item) => (
            <StephCard key={item.label} className="flex flex-col gap-1">
              <span
                className={`${serif} text-2xl md:text-3xl font-medium`}
                style={{ color: p.accent, letterSpacing: "-0.02em" }}
              >
                {resolveStat(item.value, live)}
              </span>
              <span className="text-sm font-semibold" style={{ color: p.ink }}>
                {item.label}
              </span>
              {item.note && (
                <span className="text-xs leading-snug" style={{ color: p.ink2 }}>
                  {item.note}
                </span>
              )}
            </StephCard>
          ))}
        </div>
      )

    case "versus":
      return (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.1em]" style={{ color: p.ink2 }}>
            {block.title}
          </h3>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${p.line}` }}>
            <div className="grid grid-cols-2 text-xs font-bold uppercase tracking-wide">
              <div className="px-4 py-2.5" style={{ background: "rgba(92,138,92,0.14)", color: "#3E6640" }}>
                {block.leftTitle}
              </div>
              <div className="px-4 py-2.5" style={{ background: "rgba(209,106,74,0.10)", color: "#8F3A20" }}>
                {block.rightTitle}
              </div>
            </div>
            {block.rows.map(([left, right], i) => (
              <div
                key={left}
                className="grid grid-cols-2 text-sm"
                style={{ borderTop: `1px solid ${p.line}`, background: i % 2 ? p.bg2 : p.card }}
              >
                <div className="px-4 py-3 leading-snug" style={{ color: p.ink }}>
                  {left}
                </div>
                <div
                  className="px-4 py-3 leading-snug"
                  style={{ color: p.ink2, borderLeft: `1px solid ${p.line}` }}
                >
                  {right}
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case "steps":
      return (
        <ol className="flex flex-col gap-3">
          {block.items.map((item, i) => (
            <li key={item.title} className="flex gap-4">
              <span
                className={`${serif} shrink-0 h-9 w-9 rounded-full inline-flex items-center justify-center text-sm font-semibold`}
                style={{ background: p.bg2, color: p.accent, border: `1px solid ${p.line2}` }}
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="pt-1">
                <div className="text-sm font-bold mb-1" style={{ color: p.ink }}>
                  {item.title}
                </div>
                <p className="text-[15px] leading-relaxed" style={{ color: p.ink2 }}>
                  {item.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )

    case "callout": {
      const s = CALLOUT_STYLE[block.tone]
      const Icon = s.Icon
      return (
        <div
          className="rounded-2xl p-5 md:p-6 flex items-start gap-3.5"
          style={{ background: s.bg, border: `1px solid ${s.border}` }}
        >
          <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: s.border }} aria-hidden />
          <div>
            <div className="text-sm font-bold mb-1.5" style={{ color: s.ink }}>
              {block.title}
            </div>
            <p className="text-[15px] leading-relaxed" style={{ color: p.ink }}>
              {block.body}
            </p>
          </div>
        </div>
      )
    }

    case "links":
      return (
        <div className="flex flex-col gap-2">
          {block.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity hover:opacity-80"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: p.ink }}>
                  {item.label}
                </div>
                <div className="text-xs" style={{ color: p.ink2 }}>
                  {item.desc}
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0" style={{ color: p.accent }} aria-hidden />
            </Link>
          ))}
        </div>
      )

    case "glossary":
      return (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {block.items.map((item) => (
            <div
              key={item.term}
              className="rounded-xl p-4"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <dt className="text-sm font-bold mb-1" style={{ color: p.accent }}>
                {item.term}
              </dt>
              <dd className="text-sm leading-relaxed" style={{ color: p.ink2 }}>
                {item.desc}
              </dd>
            </div>
          ))}
        </dl>
      )
  }
}

// ── Chapitre ──────────────────────────────────────────────────────────

function Chapter({ chapter, live }: { chapter: DeckChapter; live: LiveValues }) {
  return (
    <section
      id={chapter.id}
      className="flex flex-col gap-6 scroll-mt-8"
      aria-labelledby={`${chapter.id}-titre`}
    >
      <div className="flex flex-col gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: p.accent }}
        >
          {chapter.eyebrow}
        </span>
        <h2
          id={`${chapter.id}-titre`}
          className={`${serif} text-2xl md:text-4xl font-medium leading-tight`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          {chapter.title}
        </h2>
        <p className="text-base md:text-lg leading-relaxed max-w-3xl" style={{ color: p.ink2 }}>
          {chapter.lead}
        </p>
      </div>

      {chapter.blocks.map((block, i) => (
        <Block key={i} block={block} live={live} />
      ))}
    </section>
  )
}

// ── Vue ───────────────────────────────────────────────────────────────

export function StephDeckView({ live }: { live: LiveValues }) {
  // Sommaire repliable sur mobile : la liste de 12 chapitres pousse tout le
  // contenu sous la ligne de flottaison si on la laisse ouverte.
  const [tocOpen, setTocOpen] = useState(false)

  return (
    <div className="flex flex-col gap-14">
      {/* Sommaire */}
      <nav aria-label="Sommaire" className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setTocOpen((v) => !v)}
          className="md:hidden self-start text-sm font-semibold underline"
          style={{ color: p.ink }}
        >
          {tocOpen ? "Masquer le sommaire" : `Sommaire — ${DECK.length} chapitres`}
        </button>
        <ol
          className={`${tocOpen ? "grid" : "hidden"} md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2`}
        >
          {DECK.map((chapter, i) => (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 transition-opacity hover:opacity-75"
                style={{ background: p.card, border: `1px solid ${p.line}` }}
              >
                <span
                  className="text-xs font-bold w-5 shrink-0 text-right"
                  style={{ color: p.accent }}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium leading-snug" style={{ color: p.ink }}>
                  {chapter.title}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {DECK.map((chapter) => (
        <Chapter key={chapter.id} chapter={chapter} live={live} />
      ))}

      <div
        className="rounded-2xl p-5 md:p-6 text-sm leading-relaxed"
        style={{ background: p.bg2, color: p.ink }}
      >
        <strong>D&apos;où vient ce document.</strong> Il est écrit à partir des documents de
        référence du projet : le brief de marque, le plan de croissance, et la page « Notre méthode »
        publiée sur le site. Les chiffres du catalogue et des comptes sont lus dans la base au
        moment où vous ouvrez la page — ils ne peuvent donc pas vieillir. Si une phrase vous semble
        fausse, elle l&apos;est probablement : signalez-la, le texte vit dans le code du site
        (<code>src/lib/steph/knowledge.ts</code>) et se corrige en une minute.
      </div>
    </div>
  )
}
