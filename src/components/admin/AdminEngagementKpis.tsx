import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface EngagementStat {
  label: string
  week: number
  prevWeek: number
}

interface AdminEngagementKpisProps {
  serifClass: string
  reactionsWeek: number
  reactionsPrevWeek: number
  reviewsWeek: number
  reviewsPrevWeek: number
  ageVotesWeek: number
  ageVotesPrevWeek: number
  recoClicksWeek: number
  recoClicksPrevWeek: number
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

function delta(current: number, prev: number) {
  if (prev === 0 && current === 0) return { label: "—", tone: "neutral" as const }
  if (prev === 0) return { label: `+${current}`, tone: "up" as const }
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return { label: "stable", tone: "neutral" as const }
  return {
    label: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`,
    tone: pct > 0 ? ("up" as const) : ("down" as const),
  }
}

export function AdminEngagementKpis(props: AdminEngagementKpisProps) {
  const p = APERCU_PALETTE
  const stats: EngagementStat[] = [
    { label: "Réactions", week: props.reactionsWeek, prevWeek: props.reactionsPrevWeek },
    { label: "Avis", week: props.reviewsWeek, prevWeek: props.reviewsPrevWeek },
    { label: "Votes d'âge", week: props.ageVotesWeek, prevWeek: props.ageVotesPrevWeek },
    { label: "Clics reco", week: props.recoClicksWeek, prevWeek: props.recoClicksPrevWeek },
  ]

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2
          className={`${props.serifClass} text-xl md:text-2xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Engagement cette semaine
        </h2>
        <span className="text-xs" style={{ color: p.ink2 }}>
          vs 7 jours précédents
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => {
          const d = delta(s.week, s.prevWeek)
          const deltaStyle =
            d.tone === "up"
              ? { bg: "rgba(92, 138, 92, 0.14)", color: "#3E6640" }
              : d.tone === "down"
              ? { bg: "rgba(209, 106, 74, 0.14)", color: p.accent }
              : { bg: "rgba(30,26,21,0.06)", color: p.ink2 }
          return (
            <div
              key={s.label}
              className="rounded-2xl p-5"
              style={{ background: p.card, border: `1px solid ${p.line}` }}
            >
              <div
                className="text-[11px] uppercase tracking-wide font-semibold mb-1"
                style={{ color: p.ink2 }}
              >
                {s.label}
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={`${props.serifClass} text-3xl font-medium leading-none`}
                  style={{ color: p.ink, letterSpacing: "-0.03em" }}
                >
                  {fmtNumber(s.week)}
                </span>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                  style={deltaStyle}
                >
                  {d.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
