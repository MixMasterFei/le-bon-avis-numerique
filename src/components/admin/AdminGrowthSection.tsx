import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { AdminGrowthChart } from "./AdminGrowthChart"
import type { DailyGrowthPoint } from "@/lib/admin-kpis"

interface AdminGrowthSectionProps {
  serifClass: string
  usersWeek: number
  usersPrevWeek: number
  usersMonth: number
  familiesTotal: number
  familiesCompleteThree: number
  dailyGrowth: DailyGrowthPoint[]
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

function deltaLabel(current: number, prev: number): {
  label: string
  tone: "up" | "down" | "neutral"
} {
  if (prev === 0 && current === 0) return { label: "—", tone: "neutral" }
  if (prev === 0) return { label: `+${current}`, tone: "up" }
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return { label: "stable", tone: "neutral" }
  return {
    label: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`,
    tone: pct > 0 ? "up" : "down",
  }
}

export function AdminGrowthSection({
  serifClass,
  usersWeek,
  usersPrevWeek,
  usersMonth,
  familiesTotal,
  familiesCompleteThree,
  dailyGrowth,
}: AdminGrowthSectionProps) {
  const p = APERCU_PALETTE
  const wow = deltaLabel(usersWeek, usersPrevWeek)

  return (
    <div
      className="rounded-3xl p-6 md:p-8"
      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: p.accent }}
      >
        Croissance
      </div>
      <h2
        className={`${serifClass} text-2xl md:text-3xl font-medium mb-6`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        Cette semaine
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 md:gap-10 items-center">
        <div className="flex flex-col gap-4">
          <Stat
            label="Nouveaux comptes"
            value={usersWeek}
            delta={wow}
            serifClass={serifClass}
          />
          <Stat
            label="Sur 30 jours"
            value={usersMonth}
            serifClass={serifClass}
            small
          />
          <Stat
            label="Foyers actifs"
            value={familiesTotal}
            serifClass={serifClass}
            small
            hint={`${familiesCompleteThree} ≥ 3 membres`}
          />
        </div>

        <div>
          <AdminGrowthChart data={dailyGrowth} />
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  delta,
  serifClass,
  small,
  hint,
}: {
  label: string
  value: number
  delta?: { label: string; tone: "up" | "down" | "neutral" }
  serifClass: string
  small?: boolean
  hint?: string
}) {
  const p = APERCU_PALETTE
  const deltaBg =
    delta?.tone === "up"
      ? { bg: "rgba(92, 138, 92, 0.14)", color: "#3E6640" }
      : delta?.tone === "down"
      ? { bg: "rgba(209, 106, 74, 0.14)", color: p.accent }
      : { bg: "rgba(30,26,21,0.06)", color: p.ink2 }

  return (
    <div>
      <div
        className="text-[11px] uppercase tracking-wide font-semibold mb-1"
        style={{ color: p.ink2 }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span
          className={`${serifClass} ${small ? "text-2xl" : "text-5xl"} font-medium leading-none`}
          style={{ color: p.ink, letterSpacing: "-0.03em" }}
        >
          {fmtNumber(value)}
        </span>
        {delta && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={deltaBg}
          >
            {delta.label}
          </span>
        )}
      </div>
      {hint && (
        <div className="text-xs mt-1" style={{ color: p.ink2 }}>
          {hint}
        </div>
      )}
    </div>
  )
}
