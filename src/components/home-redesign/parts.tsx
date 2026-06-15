"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { RedesignCard, type RedesignCardMedia } from "./RedesignCard"
import { useRankedByFit } from "./useRankedByFit"

/** Section band — alt bands use --paper-2 with hairline top/bottom borders. */
export function Band({ id, alt, children }: { id?: string; alt?: boolean; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="scroll-mt-24 py-[52px] md:py-[62px]"
      style={alt ? { background: "var(--paper-2)", borderBlock: "1px solid var(--line)" } : { background: "var(--paper)" }}
    >
      {children}
    </section>
  )
}

export function Wrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1240px] px-5 sm:px-7 ${className}`}>{children}</div>
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--terra)" }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--terra)" }} />
      {children}
    </div>
  )
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  action,
  onReload,
}: {
  eyebrow: string
  title: React.ReactNode
  lead?: string
  action?: { label: string; href: string }
  onReload?: () => void
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          className="mt-2.5 text-[clamp(26px,3.4vw,40px)] font-bold leading-[1.04]"
          style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
        >
          {title}
        </h2>
        {lead && <p className="mt-2 max-w-[52ch] text-[15.5px]" style={{ color: "var(--ink-2)" }}>{lead}</p>}
      </div>
      {onReload ? (
        <button
          onClick={onReload}
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-[14px] font-bold transition-opacity hover:opacity-70"
          style={{ color: "var(--terra)" }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recharger
        </button>
      ) : action ? (
        <Link href={action.href} className="whitespace-nowrap text-[14px] font-bold" style={{ color: "var(--terra)" }}>
          {action.label} →
        </Link>
      ) : null}
    </div>
  )
}

/** Emphasis word inside a heading (Newsreader italic, accent-colored). */
export function Em({ tone = "terra", children }: { tone?: "terra" | "pine" | "gold"; children: React.ReactNode }) {
  const color = tone === "pine" ? "var(--pine-2)" : tone === "gold" ? "var(--gold)" : "var(--terra)"
  return (
    <em style={{ fontFamily: "var(--font-newsreader)", fontStyle: "italic", fontWeight: 500, color }}>{children}</em>
  )
}

/**
 * "eyebrow + heading + single-row grid of cards" section. Shows exactly one
 * full row (no horizontal scroll, no cut), via the .v2-row CSS in globals.css.
 */
export function CardRailSection({
  id,
  alt,
  eyebrow,
  title,
  lead,
  action,
  onReload,
  items,
  loading,
  totem = "compact",
  showType = false,
  emptyText,
  audience,
  rankByMemberIds,
}: {
  id?: string
  alt?: boolean
  eyebrow: string
  title: React.ReactNode
  lead?: string
  action?: { label: string; href: string }
  onReload?: () => void
  items: RedesignCardMedia[]
  loading: boolean
  totem?: "compact" | "full"
  showType?: boolean
  emptyText?: string
  /** When set (a child/family is selected), appended to the title so the rail
   *  visibly reflects the filter, e.g. "… · pour Erwan". */
  audience?: string
  /** When set, re-orders the row by these members' family-fit so the child's
   *  taste (not just their age) drives what shows first. */
  rankByMemberIds?: string[]
}) {
  const ranked = useRankedByFit(items, rankByMemberIds)

  if (!loading && items.length === 0 && !emptyText) return null
  const rowClass = totem === "full" ? "v2-row-lg" : "v2-row"
  const fullTitle = audience ? <>{title} <Em tone="terra">· {audience}</Em></> : title
  return (
    <Band id={id} alt={alt}>
      <Wrap>
        <SectionHead eyebrow={eyebrow} title={fullTitle} lead={lead} action={action} onReload={onReload} />
        {!loading && items.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>{emptyText}</p>
        ) : (
          <div className={rowClass}>
            {/* Skeletons only on the FIRST load; on a filter change we keep the
                current cards visible until the new set arrives (no empty flash). */}
            {loading && items.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: "var(--placeholder, #E6DFCE)" }} />
                ))
              : ranked.map((m) => <RedesignCard key={m.id} media={m} totem={totem} showType={showType} />)}
          </div>
        )}
      </Wrap>
    </Band>
  )
}
