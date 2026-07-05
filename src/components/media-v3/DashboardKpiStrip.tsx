import type { DashboardMedia } from "@/lib/media-dashboard-data"

/**
 * The scoreboard KPI strip: one big-number-with-dot-meter cell per content
 * dimension. The catalog scores 5 vigilance dimensions + 2 positive ones
 * (there is no per-media "educational" score), so this is a 7-cell strip —
 * 5 olive vigilance cells then 2 terracotta-tinted "points forts" cells.
 *
 * Pure/presentational (server component). Colors are the handoff's exact
 * values; they already match the site's warm art direction.
 */

const EMPTY_DOT = "#E4DAC8"

const VIGILANCE: { key: keyof NonNullable<DashboardMedia["metrics"]>; label: string }[] = [
  { key: "violence", label: "Violence" },
  { key: "sexNudity", label: "Sexe / Nudité" },
  { key: "language", label: "Langage" },
  { key: "consumerism", label: "Consumérisme" },
  { key: "substanceUse", label: "Substances" },
]

const POSITIVE: { key: keyof NonNullable<DashboardMedia["metrics"]>; label: string }[] = [
  { key: "positiveMessages", label: "Messages +" },
  { key: "roleModels", label: "Modèles +" },
]

function Dots({ value, filled }: { value: number; filled: string }) {
  const v = Math.max(0, Math.min(5, value))
  return (
    <div className="mt-[7px] flex justify-center gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: i < v ? filled : EMPTY_DOT }}
        />
      ))}
    </div>
  )
}

function Cell({
  label,
  value,
  positive,
  last,
}: {
  label: string
  value: number
  positive: boolean
  last: boolean
}) {
  const numberColor = positive ? "#C0512E" : value === 0 ? "#9A9082" : "#6E6752"
  const filled = positive ? "#C0512E" : "#6E6752"
  const suffixColor = positive ? "#DCA284" : "#C4B8A0"
  return (
    <div
      className="px-2.5 py-[13px] text-center"
      style={{
        borderRight: last ? "none" : `1px solid #EFE6D6`,
        background: positive ? "#F8EFE4" : "transparent",
      }}
    >
      <div
        className="mb-[5px] text-[9.5px] font-bold uppercase leading-tight"
        style={{ letterSpacing: ".08em", color: positive ? "#A8431F" : "#8A8072" }}
      >
        {label}
      </div>
      <div className="font-serif text-[22px] font-semibold leading-none" style={{ color: numberColor }}>
        {value}
        <span className="text-[12px]" style={{ color: suffixColor }}>
          /5
        </span>
      </div>
      <Dots value={value} filled={filled} />
    </div>
  )
}

export function DashboardKpiStrip({ metrics }: { metrics: NonNullable<DashboardMedia["metrics"]> }) {
  const cells = [
    ...VIGILANCE.map((d) => ({ label: d.label, value: metrics[d.key] as number, positive: false })),
    ...POSITIVE.map((d) => ({ label: d.label, value: metrics[d.key] as number, positive: true })),
  ]
  return (
    <div
      className="grid grid-cols-4 sm:grid-cols-7"
      style={{ borderTop: "1px solid #EFE6D6", background: "#FBF8F2" }}
    >
      {cells.map((c, i) => (
        <Cell key={c.label} label={c.label} value={c.value} positive={c.positive} last={i === cells.length - 1} />
      ))}
    </div>
  )
}
