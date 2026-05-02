import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { EnrichmentStockpile } from "./EnrichmentStockpile"
import type { UnenrichedByType } from "@/lib/admin-kpis"

interface QueueItem {
  count: number
  label: string
  href: string
}

interface AdminActionQueueProps {
  serifClass: string
  correctionsPending: number
  requestsPending: number
  catalogUnenriched: number
  catalogUnenrichedByType: UnenrichedByType[]
  newsReportsPending?: number
  disagreedAgeItems?: number
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n)
}

export function AdminActionQueue({
  serifClass,
  correctionsPending,
  requestsPending,
  catalogUnenriched,
  catalogUnenrichedByType,
  newsReportsPending = 0,
  disagreedAgeItems = 0,
}: AdminActionQueueProps) {
  const p = APERCU_PALETTE
  // Triage queues without enrichment — that one gets its own drillable
  // widget below since it's the only count with a meaningful breakdown.
  const items: QueueItem[] = [
    {
      count: disagreedAgeItems,
      label: "désaccords communautaires",
      href: "/admin/disagreed-items",
    },
    {
      count: correctionsPending,
      label: "corrections en attente",
      href: "/admin/corrections",
    },
    {
      count: requestsPending,
      label: "demandes de contenu",
      href: "/admin/requests",
    },
    {
      count: newsReportsPending,
      label: "signalements de commentaires",
      href: "/admin/news-reports",
    },
  ]

  const nothingToDo = items.every((i) => i.count === 0) && catalogUnenriched === 0

  return (
    <div>
      <h2
        className={`${serifClass} text-xl md:text-2xl font-medium mb-4`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        À faire
      </h2>
      {nothingToDo ? (
        <div
          className="rounded-2xl p-6 text-center text-sm"
          style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink2 }}
        >
          Aucune action requise. Tout est à jour.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((it) => {
            const urgent = it.count > 0
            return (
              <Link
                key={it.href}
                href={it.href}
                className="group rounded-2xl p-5 flex items-center justify-between transition-transform hover:-translate-y-0.5"
                style={{
                  background: urgent ? p.card : "transparent",
                  border: `1px solid ${urgent ? p.line2 : p.line}`,
                  opacity: urgent ? 1 : 0.55,
                }}
              >
                <div>
                  <div
                    className={`${serifClass} text-3xl font-medium leading-none mb-1`}
                    style={{
                      color: urgent ? p.accent : p.ink,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {fmtNumber(it.count)}
                  </div>
                  <div className="text-sm" style={{ color: p.ink }}>
                    {it.label}
                  </div>
                </div>
                <ArrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  style={{ color: p.ink2 }}
                />
              </Link>
            )
          })}
          <EnrichmentStockpile
            serifClass={serifClass}
            total={catalogUnenriched}
            byType={catalogUnenrichedByType}
          />
        </div>
      )}
    </div>
  )
}
