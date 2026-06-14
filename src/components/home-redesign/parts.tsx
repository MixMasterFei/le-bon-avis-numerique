import Link from "next/link"
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
  return <div className={`mx-auto max-w-[1240px] px-7 ${className}`}>{children}</div>
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
}: {
  eyebrow: string
  title: React.ReactNode
  lead?: string
  action?: { label: string; href: string }
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
      {action && (
        <Link href={action.href} className="whitespace-nowrap text-[14px] font-bold" style={{ color: "var(--terra)" }}>
          {action.label} →
        </Link>
      )}
    </div>
  )
}

/** Emphasis word inside a heading (Newsreader italic, accent-colored). */
export function Em({ tone = "terra", children }: { tone?: "terra" | "pine" | "gold"; children: React.ReactNode }) {
  const color = tone === "pine" ? "var(--pine-2)" : tone === "gold" ? "var(--gold)" : "var(--terra)"
  return (
    <em className="not-italic" style={{ fontFamily: "var(--font-newsreader)", fontStyle: "italic", fontWeight: 500, color }}>
      {children}
    </em>
  )
}

/** Horizontal snap rail with hidden scrollbar (negative margins bleed to edges). */
export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-7 flex snap-x snap-mandatory gap-[18px] overflow-x-auto px-7 pb-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  )
}

/** Skeleton poster used while a rail loads. */
export function CardSkeleton({ width = 188 }: { width?: number }) {
  return (
    <div className="flex-none snap-start" style={{ width }}>
      <div className="aspect-[2/3] animate-pulse rounded-[14px]" style={{ background: "var(--placeholder, #E6DFCE)" }} />
    </div>
  )
}

/**
 * A complete "eyebrow + heading + rail of cards" section. Used by the
 * cinema / coups de cœur / week-end / games rails — each just fetches and
 * passes its items in.
 */
export function CardRailSection({
  id,
  alt,
  eyebrow,
  title,
  lead,
  action,
  items,
  loading,
  cardWidth = 188,
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
  items: RedesignCardMedia[]
  loading: boolean
  cardWidth?: number
  totem?: "compact" | "full"
  showType?: boolean
  emptyText?: string
}) {
  if (!loading && items.length === 0 && !emptyText) return null
  return (
    <Band id={id} alt={alt}>
      <Wrap>
        <SectionHead eyebrow={eyebrow} title={title} lead={lead} action={action} />
        {loading ? (
          <Rail>
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} width={cardWidth} />
            ))}
          </Rail>
        ) : items.length > 0 ? (
          <Rail>
            {items.map((m) => (
              <div key={m.id} className="flex-none snap-start" style={{ width: cardWidth }}>
                <RedesignCard media={m} totem={totem} showType={showType} />
              </div>
            ))}
          </Rail>
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>{emptyText}</p>
        )}
      </Wrap>
    </Band>
  )
}
