"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { EnrichmentStockpile } from "./EnrichmentStockpile"
import type { UnenrichedByType } from "@/lib/admin-kpis"
import { AdminSectionTitle } from "./shared/admin-ui"

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

  const items = [
    { count: disagreedAgeItems, label: "désaccords communautaires", href: "/admin/disagreed-items" },
    { count: correctionsPending, label: "corrections en attente", href: "/admin/operations#moderation" },
    { count: requestsPending, label: "demandes de contenu", href: "/admin/operations#moderation" },
    { count: newsReportsPending, label: "signalements commentaires", href: "/admin/news-reports" },
  ]
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count - a.count)

  const nothingToDo = items.length === 0 && catalogUnenriched === 0

  return (
    <div>
      <AdminSectionTitle
        title="À traiter"
        subtitle={
          nothingToDo
            ? "Aucune file d'attente — vous pouvez vous concentrer sur le catalogue."
            : "Priorités triées par volume — cliquez pour agir."
        }
      />

      {nothingToDo ? (
        <div
          className="rounded-2xl p-6 text-center text-sm"
          style={{ background: "rgba(92,138,92,0.08)", border: `1px solid rgba(92,138,92,0.2)`, color: p.ink }}
        >
          Tout est à jour.{" "}
          <Link href="/admin/operations" className="underline font-medium" style={{ color: p.ink }}>
            Ouvrir les outils
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="group rounded-2xl p-5 flex items-center justify-between transition-transform hover:-translate-y-0.5"
              style={{ background: p.card, border: `1px solid ${p.line2}` }}
            >
              <div>
                <div
                  className={`${serifClass} text-3xl font-medium leading-none mb-1`}
                  style={{ color: p.accent, letterSpacing: "-0.03em" }}
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
          ))}
          {catalogUnenriched > 0 && (
            <EnrichmentStockpile
              serifClass={serifClass}
              total={catalogUnenriched}
              byType={catalogUnenrichedByType}
            />
          )}
        </div>
      )}
    </div>
  )
}
