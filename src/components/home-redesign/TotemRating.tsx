"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  totemAxesFor,
  vigilanceAxisLevel,
  vigilanceMax,
  TOTEM_COLORS,
  TOTEM_WORDS,
  type TotemMetrics,
} from "./totem"

interface TotemRatingProps {
  age: number | null | undefined
  metrics: TotemMetrics | null | undefined
  /** Badge size: compact (dense cards) or full (large cards). */
  variant: "compact" | "full"
  /** Media type — selects the axis set (games → violence + achats intégrés). */
  type?: string | null
}

// Short label shown next to the badge dot per overall vigilance level.
const VIGILANCE_LABEL = ["", "À noter", "À noter", "Vigilance"] as const

/**
 * The "totem" rating, rendered as a COARSE vigilance indicator (not a precise
 * per-axis meter). The age stays the headline; a single dot signals whether
 * there's anything to watch (age-anchored, cartoon-friendly — see totem.ts).
 * The detail popover lists only the notable axes, in words, and is revealed
 * only by interacting with the badge itself (hover/focus on desktop, tap on
 * mobile — the tap is intercepted so it doesn't open the fiche).
 */
export function TotemRating({ age, metrics, variant, type }: TotemRatingProps) {
  const [open, setOpen] = useState(false)
  const ageLabel = typeof age === "number" && age > 0 ? `${age}+` : "?"
  const m = metrics ?? {}
  const axes = totemAxesFor(type)
  const overall = vigilanceMax(metrics, type, age)
  const notable = axes
    .map((a) => ({ ...a, level: vigilanceAxisLevel(m[a.key], age) }))
    .filter((a) => a.level >= 1)

  const dot = overall > 0 && (
    <span
      className="inline-block rounded-full"
      style={{ width: 7, height: 7, background: TOTEM_COLORS[overall], boxShadow: "0 0 0 2px rgba(0,0,0,.25)" }}
    />
  )

  const badge =
    variant === "compact" ? (
      <div
        className="flex flex-col items-center gap-1 rounded-[9px] px-2 py-1.5 backdrop-blur-[3px]"
        style={{ background: "rgba(15,12,8,.55)", border: "1px solid rgba(255,255,255,.22)", minWidth: 34 }}
      >
        <span className="text-[14px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-bricolage)" }}>
          {ageLabel}
        </span>
        {dot}
      </div>
    ) : (
      <div
        className="flex flex-col items-center gap-1 rounded-[11px] px-2.5 py-2 backdrop-blur-[3px]"
        style={{ background: "rgba(15,12,8,.5)", border: "1px solid rgba(255,255,255,.2)" }}
      >
        <span className="text-[17px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-bricolage)" }}>
          {ageLabel}
        </span>
        {overall > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-white/85">
            {dot}
            {VIGILANCE_LABEL[overall]}
          </span>
        )}
      </div>
    )

  return (
    <>
      {/* Trigger — the badge. Intercepts tap/click so it toggles the popover
          instead of opening the fiche; hover/focus reveal it on desktop. */}
      <div
        className="absolute right-3 top-3 z-30 cursor-help"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label="Voir le détail du contenu"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            setOpen((o) => !o)
          }
        }}
      >
        {badge}
      </div>

      {/* Popover — visibility driven by `open` (badge interaction only). */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-[9px] left-[9px] right-[9px] z-40 rounded-[13px] px-3 py-3 backdrop-blur-[5px] transition-all duration-200",
          open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
        style={{
          background: "rgba(18,14,9,.95)",
          border: "1px solid rgba(255,255,255,.16)",
          color: "#F3ECDF",
          boxShadow: "0 20px 44px -16px rgba(0,0,0,.7)",
        }}
        aria-hidden={!open}
      >
        <div className="mb-2 text-[11px] font-semibold leading-snug" style={{ color: "#C9BCA8" }}>
          {typeof age === "number" && age > 0 ? (
            <>Dès <b className="font-bold text-white">{age} ans</b> · à surveiller</>
          ) : (
            <>Ce qu&apos;il faut surveiller</>
          )}
        </div>
        {notable.length === 0 ? (
          <div className="py-1 text-[11.5px] font-semibold" style={{ color: "#EDE3D2" }}>
            Rien à signaler pour cet âge.
          </div>
        ) : (
          notable.map((a) => {
            const words = a.words ?? TOTEM_WORDS
            return (
              <div key={a.key} className="flex items-center justify-between gap-2.5 py-1">
                <b className="text-[11.5px] font-semibold" style={{ color: "#EDE3D2" }}>{a.label}</b>
                <span className="flex items-center gap-1.5 text-[10.5px] font-bold" style={{ color: "#C9BCA8" }}>
                  {words[a.level]}
                  <i className="block rounded-full" style={{ width: 7, height: 7, background: TOTEM_COLORS[a.level] }} />
                </span>
              </div>
            )
          })
        )}
        <div className="mt-2 border-t pt-2 text-[10px] font-semibold" style={{ borderColor: "rgba(255,255,255,.12)", color: "#A99C88" }}>
          Repère indicatif · plus de détails sur la fiche →
        </div>
      </div>
    </>
  )
}
