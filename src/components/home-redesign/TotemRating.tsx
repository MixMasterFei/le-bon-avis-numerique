"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  totemAxesFor,
  vigilanceAxisLevel,
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

/**
 * The "totem" rating on a card. The age stays the headline; a small dot signals
 * that there are content points to watch. We deliberately DO NOT claim a
 * severity level on the poster icon (calibration is too fragile for that on a
 * glanceable surface, and a wrong "Léger" on an action film reads worse than no
 * claim). The popover lists the relevant WARNING CATEGORIES only ("Violence",
 * "Langage"…) — the precise 0–5 and the per-member verdict live on the fiche.
 * Revealed only by interacting with the badge (hover/focus desktop, tap mobile;
 * the tap is intercepted so it doesn't open the fiche).
 */
export function TotemRating({ age, metrics, variant, type }: TotemRatingProps) {
  const [open, setOpen] = useState(false)
  const ageLabel = typeof age === "number" && age > 0 ? `${age}+` : "?"
  const m = metrics ?? {}
  // Categories worth flagging = axes the (age-anchored) coarse level marks ≥1.
  const flagged = totemAxesFor(type).filter((a) => vigilanceAxisLevel(m[a.key], age) >= 1)
  const hasPoints = flagged.length > 0

  // Presence dot — one warm marker, no severity claim.
  const dot = hasPoints && (
    <span
      className="inline-block rounded-full"
      style={{ width: 7, height: 7, background: "var(--gold)", boxShadow: "0 0 0 2px rgba(0,0,0,.25)" }}
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
        {dot}
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
        aria-label="Voir les points de vigilance"
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

      {/* Popover — categories only, no severity claim. */}
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
            <>Dès <b className="font-bold text-white">{age} ans</b></>
          ) : (
            <>Repères de contenu</>
          )}
        </div>
        {!hasPoints ? (
          <div className="py-0.5 text-[11.5px] font-semibold" style={{ color: "#EDE3D2" }}>
            Rien à signaler pour cet âge.
          </div>
        ) : (
          <>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "#A99C88" }}>
              Points de vigilance
            </div>
            <div className="flex flex-wrap gap-1.5">
              {flagged.map((a) => (
                <span
                  key={a.key}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: "rgba(217,149,36,.16)", color: "#EBC98A", border: "1px solid rgba(217,149,36,.35)" }}
                >
                  {a.label}
                </span>
              ))}
            </div>
          </>
        )}
        <div className="mt-2 border-t pt-2 text-[10px] font-semibold" style={{ borderColor: "rgba(255,255,255,.12)", color: "#A99C88" }}>
          Le détail et l&apos;avis par enfant sont sur la fiche →
        </div>
      </div>
    </>
  )
}
