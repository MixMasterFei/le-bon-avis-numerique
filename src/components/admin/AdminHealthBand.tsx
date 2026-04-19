import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { formatRelativeTimeFr } from "@/lib/utils"

interface AdminHealthBandProps {
  catalogTotal: number
  catalogUnenriched: number
  cronErrors7d: number
  lastNewsRun: Date | null
  generatedAt: Date
  /** Millisecond timestamp captured at render time on the server. */
  now: number
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

export function AdminHealthBand({
  catalogTotal,
  catalogUnenriched,
  cronErrors7d,
  lastNewsRun,
  generatedAt,
  now,
}: AdminHealthBandProps) {
  const p = APERCU_PALETTE
  const systemOk = cronErrors7d === 0
  const dotOk = "#5C8A5C" // sage
  const dotWarn = "#C68A3E"
  const dotErr = p.accent

  const newsFresh =
    lastNewsRun !== null && now - lastNewsRun.getTime() < 36 * 3600 * 1000

  const items = [
    {
      label: systemOk ? "Système OK" : "Erreurs cron ce mois",
      dot: systemOk ? dotOk : dotErr,
    },
    {
      label: `${cronErrors7d} erreur${cronErrors7d === 1 ? "" : "s"} cron 7j`,
      dot: cronErrors7d === 0 ? dotOk : cronErrors7d < 3 ? dotWarn : dotErr,
    },
    {
      label: `Catalogue ${fmtNumber(catalogTotal)} œuvres`,
      dot: dotOk,
    },
    {
      label: `${fmtNumber(catalogUnenriched)} à enrichir`,
      dot: catalogUnenriched > 1000 ? dotWarn : dotOk,
    },
    {
      label: `Découverte synthétisée ${formatRelativeTimeFr(lastNewsRun, { now })}`,
      dot: newsFresh ? dotOk : dotWarn,
    },
  ]

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 rounded-2xl"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: item.dot }}
          />
          <span style={{ color: p.ink }}>{item.label}</span>
        </div>
      ))}
      <span
        className="ml-auto text-xs"
        style={{ color: p.ink2 }}
      >
        dernière mise à jour {formatRelativeTimeFr(generatedAt, { now })}
      </span>
    </div>
  )
}
