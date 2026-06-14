"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  totemLevel,
  totemAxesFor,
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

/**
 * The "totem" rating. Renders the age badge (compact or full) PLUS a detail
 * popover, where the popover is revealed only by interacting with the badge
 * itself — NOT by hovering the whole card:
 *   - desktop: hover (or keyboard-focus) the badge → popover.
 *   - mobile: tap the badge → popover (the tap is intercepted so it doesn't
 *     navigate); tapping anywhere else on the card opens the fiche as usual.
 * Self-positioned (absolute, top-right) so the card just drops it in.
 */
export function TotemRating({ age, metrics, variant, type }: TotemRatingProps) {
  const [open, setOpen] = useState(false)
  const ageLabel = typeof age === "number" && age > 0 ? `${age}+` : "?"
  const m = metrics ?? {}
  const axes = totemAxesFor(type)

  const badge =
    variant === "compact" ? (
      <div
        className="flex flex-col items-center gap-1 rounded-[9px] px-2 py-1.5 backdrop-blur-[3px]"
        style={{ background: "rgba(15,12,8,.55)", border: "1px solid rgba(255,255,255,.22)", minWidth: 34 }}
      >
        <span className="text-[14px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-bricolage)" }}>
          {ageLabel}
        </span>
        <div className="flex gap-0.5">
          {axes.map((a) => {
            const lvl = totemLevel(m[a.key])
            return (
              <i key={a.key} className="block" style={{ width: 4, height: 11, borderRadius: 1, background: TOTEM_COLORS[lvl], opacity: lvl === 0 ? 0.35 : 1 }} />
            )
          })}
        </div>
      </div>
    ) : (
      <div
        className="inline-flex flex-col gap-1.5 rounded-[11px] px-2.5 py-2.5 backdrop-blur-[3px]"
        style={{ background: "rgba(15,12,8,.5)", border: "1px solid rgba(255,255,255,.2)" }}
      >
        <span className="text-center text-[17px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-bricolage)" }}>
          {ageLabel}
        </span>
        {axes.map((a) => {
          const lvl = totemLevel(m[a.key])
          return (
            <div key={a.key} className="flex items-center gap-1.5 text-[10px] font-bold text-white/90">
              <span className="w-[11px] opacity-70">{a.short}</span>
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <i key={i} className="block" style={{ width: 7, height: 7, borderRadius: 2, background: i < lvl ? TOTEM_COLORS[lvl] : "rgba(255,255,255,.18)" }} />
                ))}
              </span>
            </div>
          )
        })}
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
          Dès <b className="font-bold text-white">{age} ans</b> · ce que contient ce titre
        </div>
        {axes.map((a) => {
          const lvl = totemLevel(m[a.key])
          const words = a.words ?? TOTEM_WORDS
          return (
            <div key={a.key} className="flex items-center justify-between gap-2.5 py-1">
              <div className="flex min-w-0 flex-col leading-tight">
                <b className="text-[11.5px] font-semibold" style={{ color: "#EDE3D2" }}>{a.label}</b>
                <span className="mt-px text-[9.5px] font-bold" style={{ color: "#A99C88" }}>{words[lvl]}</span>
              </div>
              <span className="flex flex-none gap-0.5">
                {[0, 1, 2].map((i) => (
                  <i key={i} className="block" style={{ width: 8, height: 8, borderRadius: 2, background: i < lvl ? TOTEM_COLORS[lvl] : "rgba(255,255,255,.14)" }} />
                ))}
              </span>
            </div>
          )
        })}
        <div className="mt-2 border-t pt-2 text-[10.5px] font-bold" style={{ borderColor: "rgba(255,255,255,.12)", color: "#D99524" }}>
          + d&apos;autres repères sur la fiche →
        </div>
      </div>
    </>
  )
}
