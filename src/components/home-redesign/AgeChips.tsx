"use client"

import { APERCU_AGE_BUCKETS } from "@/components/home-v2/apercuTheme"

/**
 * The age-band selector chips, shared by the hero (large, two-line) and the
 * sticky filter bar (compact, one-line). Selecting a band filters the whole
 * homepage to content for that age and below (see HomepageRedesign).
 */
export function AgeChips({
  selectedKeys,
  onToggleAge,
  size = "lg",
}: {
  selectedKeys: string[]
  onToggleAge: (key: string) => void
  size?: "lg" | "sm"
}) {
  const compact = size === "sm"
  return (
    // Compact = inside the sticky bar: a single non-wrapping row that scrolls
    // horizontally with the bar (wrapping would make the pill grow tall).
    <div className={compact ? "flex flex-nowrap gap-1.5" : "flex flex-wrap gap-2.5"}>
      {APERCU_AGE_BUCKETS.map((b) => {
        const on = selectedKeys.includes(b.key)
        return (
          <button
            key={b.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggleAge(b.key)}
            className={
              compact
                ? "shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold transition-colors"
                : "flex flex-col items-center rounded-full px-[18px] py-[10px] text-center leading-tight transition-colors"
            }
            style={{
              border: `1.5px solid ${on ? "var(--pine)" : "var(--line)"}`,
              background: on ? "var(--pine)" : "var(--paper-2)",
              color: on ? "#fff" : "var(--ink)",
            }}
          >
            <span className={compact ? "whitespace-nowrap" : "whitespace-nowrap text-[14.5px] font-bold"}>
              {b.label} ans
            </span>
            {!compact && (
              <span className="text-[11.5px] font-semibold" style={{ color: on ? "rgba(255,255,255,.72)" : "var(--ink-3)" }}>
                {b.name}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
