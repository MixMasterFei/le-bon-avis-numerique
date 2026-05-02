import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import type { CronTaskHealth } from "@/lib/admin-kpis"

interface AdminCronStripProps {
  serifClass: string
  tasks: CronTaskHealth[]
  /** Millisecond timestamp captured at render time on the server. */
  now: number
}

// Human labels + ordering for the strip. Any task not listed here is
// rendered at the end in its raw slug form — keeps the UI forward-compatible.
const LABELS: Record<string, string> = {
  import: "Import hebdo",
  "import-games": "Import jeux",
  enrich: "Enrichissement",
  "enrich-deep": "Enrichissement profond",
  quality: "Qualité",
  "backfill-ratings": "Notes TMDB",
  streaming: "Streaming",
  similarity: "Similarité",
  "news-discover": "Découverte",
}
const ORDER = [
  "import",
  "import-games",
  "enrich",
  "enrich-deep",
  "quality",
  "backfill-ratings",
  "streaming",
  "similarity",
  "news-discover",
]

function fmtRelative(d: Date | null, now: number): string {
  if (!d) return "jamais"
  const ms = now - d.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  return `${days} j`
}

function statusDot(task: CronTaskHealth, now: number): { color: string; icon: string } {
  const p = APERCU_PALETTE
  const sage = "#5C8A5C"
  const warn = "#C68A3E"
  const err = p.accent

  if (task.errors7d > 0) return { color: err, icon: "×" }
  if (!task.lastRun) return { color: warn, icon: "·" }

  // Stale threshold per task (rough — imports are weekly, enrich daily, etc.)
  const hours = (now - task.lastRun.getTime()) / 3600000
  const weeklyTasks = new Set(["import", "import-games", "backfill-ratings", "streaming", "similarity"])
  const staleThresholdHours = weeklyTasks.has(task.task) ? 8 * 24 : 36

  if (hours > staleThresholdHours) return { color: warn, icon: "⚠" }
  return { color: sage, icon: "✓" }
}

export function AdminCronStrip({ serifClass, tasks, now }: AdminCronStripProps) {
  const p = APERCU_PALETTE
  const sorted = [...tasks].sort((a, b) => {
    const ai = ORDER.indexOf(a.task)
    const bi = ORDER.indexOf(b.task)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div>
      <h2
        className={`${serifClass} text-lg md:text-xl font-medium mb-3`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        Santé des tâches automatisées
      </h2>
      <div
        className="rounded-2xl px-4 py-3 flex flex-wrap gap-x-5 gap-y-2"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        {sorted.map((t) => {
          const s = statusDot(t, now)
          return (
            <div
              key={t.task}
              className="flex items-center gap-2 text-sm"
              title={
                t.lastRun
                  ? `Dernière exécution: ${t.lastRun.toLocaleString("fr-FR")}${
                      t.errors7d > 0 ? ` · ${t.errors7d} erreurs 7j` : ""
                    }`
                  : "Aucune exécution enregistrée"
              }
            >
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold"
                style={{ background: `${s.color}22`, color: s.color }}
              >
                {s.icon}
              </span>
              <span style={{ color: p.ink }}>{LABELS[t.task] ?? t.task}</span>
              <span className="text-xs" style={{ color: p.ink2 }}>
                {fmtRelative(t.lastRun, now)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
