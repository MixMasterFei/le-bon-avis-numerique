"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { RedesignCard, type RedesignCardMedia } from "./RedesignCard"

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

/** Single-row horizontal rail (snap-scroll, hidden scrollbar) — bleeds to
 * the container edges so cards scroll off-screen as the design intends. */
export function RailRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:-mx-7 sm:px-7 [&::-webkit-scrollbar]:hidden" style={{ scrollSnapType: "x mandatory" }}>
      {children}
    </div>
  )
}

/**
 * "eyebrow + heading + single-row rail of cards" section. One row, scrolls
 * horizontally (per the design) — not a multi-row grid.
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
}) {
  if (!loading && items.length === 0 && !emptyText) return null
  const cardW = totem === "full" ? 220 : 178
  return (
    <Band id={id} alt={alt}>
      <Wrap>
        <SectionHead eyebrow={eyebrow} title={title} lead={lead} action={action} onReload={onReload} />
        {!loading && items.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>{emptyText}</p>
        ) : (
          <RailRow>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex-none" style={{ width: cardW, scrollSnapAlign: "start" }}>
                    <div className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: "var(--placeholder, #E6DFCE)" }} />
                  </div>
                ))
              : items.map((m) => (
                  <div key={m.id} className="flex-none" style={{ width: cardW, scrollSnapAlign: "start" }}>
                    <RedesignCard media={m} totem={totem} showType={showType} />
                  </div>
                ))}
          </RailRow>
        )}
      </Wrap>
    </Band>
  )
}
