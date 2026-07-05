import { deriveEducationalValue } from "@/lib/educational-value"

/**
 * The scoreboard KPI strip: one big-number-with-dot-meter cell per content
 * dimension — 5 olive vigilance cells then 3 terracotta-tinted "points forts"
 * cells (Messages +, Modèles +, Éducatif). "Éducatif" isn't stored per media;
 * it's derived from topics + positive scores exactly like the classic fiche
 * (see deriveEducationalValue), so the two agree.
 *
 * Pure/presentational: it takes prebuilt cells so the same strip can render
 * either the Totem (expert) scores or the community averages (a null value
 * renders an honest "—" with empty dots). Colors are the handoff's exact
 * values.
 */

const EMPTY_DOT = "#E4DAC8"

export interface MetricsLike {
  violence: number
  sexNudity: number
  language: number
  consumerism: number
  substanceUse: number
  positiveMessages: number
  roleModels: number
}

export interface ScoreCell {
  label: string
  value: number | null
  positive: boolean
}

const VIGILANCE: { key: keyof MetricsLike; label: string }[] = [
  { key: "violence", label: "Violence" },
  { key: "sexNudity", label: "Sexe / Nudité" },
  { key: "language", label: "Langage" },
  { key: "consumerism", label: "Consumérisme" },
  { key: "substanceUse", label: "Substances" },
]

const POSITIVE: { key: keyof MetricsLike; label: string }[] = [
  { key: "positiveMessages", label: "Messages +" },
  { key: "roleModels", label: "Modèles +" },
]

/** Build the 8 scoreboard cells for a metrics set (null → all "—"). */
export function buildScoreboardCells(m: MetricsLike | null, topics: string[]): ScoreCell[] {
  return [
    ...VIGILANCE.map((d) => ({ label: d.label, value: m ? m[d.key] : null, positive: false })),
    ...POSITIVE.map((d) => ({ label: d.label, value: m ? m[d.key] : null, positive: true })),
    { label: "Éducatif", value: m ? deriveEducationalValue(m, topics) : null, positive: true },
  ]
}

function Dots({ value, filled }: { value: number | null; filled: string }) {
  const v = value == null ? 0 : Math.max(0, Math.min(5, value))
  return (
    <div className="mt-[7px] flex justify-center gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < v ? filled : EMPTY_DOT }} />
      ))}
    </div>
  )
}

function Cell({ cell, last }: { cell: ScoreCell; last: boolean }) {
  const { label, value, positive } = cell
  const numberColor = value == null ? "#9A9082" : positive ? "#C0512E" : value === 0 ? "#9A9082" : "#6E6752"
  const filled = positive ? "#C0512E" : "#6E6752"
  const suffixColor = positive ? "#DCA284" : "#C4B8A0"
  return (
    <div
      className="px-2.5 py-[13px] text-center"
      style={{ borderRight: last ? "none" : "1px solid #EFE6D6", background: positive ? "#F8EFE4" : "transparent" }}
    >
      <div
        className="mb-[5px] text-[9.5px] font-bold uppercase leading-tight"
        style={{ letterSpacing: ".08em", color: positive ? "#A8431F" : "#8A8072" }}
      >
        {label}
      </div>
      <div className="font-serif text-[22px] font-semibold leading-none" style={{ color: numberColor }}>
        {value == null ? (
          "—"
        ) : (
          <>
            {value}
            <span className="text-[12px]" style={{ color: suffixColor }}>
              /5
            </span>
          </>
        )}
      </div>
      <Dots value={value} filled={filled} />
    </div>
  )
}

export function DashboardKpiStrip({ cells }: { cells: ScoreCell[] }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8" style={{ borderTop: "1px solid #EFE6D6", background: "#FBF8F2" }}>
      {cells.map((c, i) => (
        <Cell key={c.label} cell={c} last={i === cells.length - 1} />
      ))}
    </div>
  )
}
