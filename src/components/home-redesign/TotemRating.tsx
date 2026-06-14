import {
  totemLevel,
  TOTEM_AXES,
  TOTEM_COLORS,
  TOTEM_WORDS,
  type TotemMetrics,
} from "./totem"

interface TotemRatingProps {
  age: number | null | undefined
  metrics: TotemMetrics | null | undefined
  variant: "compact" | "full" | "popover"
}

/**
 * The signature "totem" rating. Three renderings over the same data:
 * - `compact`  — dark glass age badge + a row of 4 thin axis bars (dense cards)
 * - `full`     — taller chip: age + 4 labelled 3-dot meters (large cards)
 * - `popover`  — hover explainer anchored in the poster (per-axis label + word)
 * Colors/words come from totem.ts; CSS vars resolve inside [data-home="v2"].
 */
export function TotemRating({ age, metrics, variant }: TotemRatingProps) {
  const ageLabel = typeof age === "number" && age > 0 ? `${age}+` : "?"
  const m = metrics ?? {}

  if (variant === "compact") {
    return (
      <div
        className="absolute right-3 top-3 z-30 flex flex-col items-center gap-1 rounded-[9px] px-2 py-1.5 backdrop-blur-[3px]"
        style={{ background: "rgba(15,12,8,.55)", border: "1px solid rgba(255,255,255,.22)", minWidth: 34 }}
      >
        <span className="text-[14px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-bricolage)" }}>
          {ageLabel}
        </span>
        <div className="flex gap-0.5">
          {TOTEM_AXES.map((a) => {
            const lvl = totemLevel(m[a.key])
            return (
              <i
                key={a.key}
                className="block"
                style={{ width: 4, height: 11, borderRadius: 1, background: TOTEM_COLORS[lvl], opacity: lvl === 0 ? 0.35 : 1 }}
              />
            )
          })}
        </div>
      </div>
    )
  }

  if (variant === "full") {
    return (
      <div
        className="absolute right-3 top-3 z-30 inline-flex flex-col gap-1.5 rounded-[11px] px-2.5 py-2.5 backdrop-blur-[3px]"
        style={{ background: "rgba(15,12,8,.5)", border: "1px solid rgba(255,255,255,.2)" }}
      >
        <span className="text-center text-[17px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-bricolage)" }}>
          {ageLabel}
        </span>
        {TOTEM_AXES.map((a) => {
          const lvl = totemLevel(m[a.key])
          return (
            <div key={a.key} className="flex items-center gap-1.5 text-[10px] font-bold text-white/90">
              <span className="w-[11px] opacity-70">{a.short}</span>
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <i
                    key={i}
                    className="block"
                    style={{ width: 7, height: 7, borderRadius: 2, background: i < lvl ? TOTEM_COLORS[lvl] : "rgba(255,255,255,.18)" }}
                  />
                ))}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // popover — revealed on card hover (parent has `group`)
  return (
    <div
      className="pointer-events-none absolute bottom-[9px] left-[9px] right-[9px] z-40 translate-y-2 rounded-[13px] px-3 py-3 opacity-0 backdrop-blur-[5px] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
      style={{
        background: "rgba(18,14,9,.95)",
        border: "1px solid rgba(255,255,255,.16)",
        color: "#F3ECDF",
        boxShadow: "0 20px 44px -16px rgba(0,0,0,.7)",
      }}
    >
      <div className="mb-2 text-[11px] font-semibold leading-snug" style={{ color: "#C9BCA8" }}>
        Dès <b className="font-bold text-white">{age} ans</b> · ce que contient ce titre
      </div>
      {TOTEM_AXES.map((a) => {
        const lvl = totemLevel(m[a.key])
        return (
          <div key={a.key} className="flex items-center justify-between gap-2.5 py-1">
            <div className="flex min-w-0 flex-col leading-tight">
              <b className="text-[11.5px] font-semibold" style={{ color: "#EDE3D2" }}>{a.label}</b>
              <span className="mt-px text-[9.5px] font-bold" style={{ color: "#A99C88" }}>{TOTEM_WORDS[lvl]}</span>
            </div>
            <span className="flex flex-none gap-0.5">
              {[0, 1, 2].map((i) => (
                <i
                  key={i}
                  className="block"
                  style={{ width: 8, height: 8, borderRadius: 2, background: i < lvl ? TOTEM_COLORS[lvl] : "rgba(255,255,255,.14)" }}
                />
              ))}
            </span>
          </div>
        )
      })}
      <div className="mt-2 border-t pt-2 text-[10.5px] font-bold" style={{ borderColor: "rgba(255,255,255,.12)", color: "#D99524" }}>
        + d&apos;autres repères sur la fiche →
      </div>
    </div>
  )
}
