import { APERCU_PALETTE } from "./apercuTheme"
import type { WeekStats } from "@/lib/discover-digest"

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

export function DecouverteWeekStats({ stats }: { stats: WeekStats }) {
  const p = APERCU_PALETTE
  const total = stats.reactions + stats.reviews + stats.newUsers
  if (total === 0) return null

  const items: Array<{ value: number; label: string }> = [
    { value: stats.reactions, label: "réactions" },
    { value: stats.reviews, label: "nouveaux avis" },
    { value: stats.newUsers, label: "nouvelles familles" },
  ].filter((x) => x.value > 0)

  return (
    <section
      className="rounded-2xl px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <span
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: p.ink2 }}
      >
        Cette semaine sur Totem Avisé
      </span>
      {items.map((it, i) => (
        <span key={i} style={{ color: p.ink }}>
          <strong style={{ fontWeight: 600 }}>{fmt(it.value)}</strong>{" "}
          <span style={{ color: p.ink2 }}>{it.label}</span>
        </span>
      ))}
    </section>
  )
}
