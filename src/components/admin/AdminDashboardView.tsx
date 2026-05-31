"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, RefreshCw, Settings, Bot, Sparkles } from "lucide-react"
import { formatRelativeTimeFr } from "@/lib/utils"
import type { SerializedAdminKpis } from "@/lib/admin-kpis"
import { AdminShell } from "./shared/AdminShell"
import {
  adminPalette,
  adminSerifClass,
  fmt,
  wowLabel,
  AdminKpiTile,
  AdminSectionTitle,
} from "./shared/admin-ui"
import { AdminGrowthChart } from "./AdminGrowthChart"
import { AdminActionQueue } from "./AdminActionQueue"
import { AdminCronAlerts } from "./AdminCronAlerts"

export function AdminDashboardView({ kpis }: { kpis: SerializedAdminKpis }) {
  const router = useRouter()
  const p = adminPalette
  const now = Date.now()

  const pendingModeration =
    kpis.correctionsPending +
    kpis.requestsPending +
    kpis.newsReportsPending +
    kpis.disagreedAgeItems

  return (
    <AdminShell
      active="dashboard"
      eyebrow="Tableau de bord"
      icon={LayoutDashboard}
      title={
        <>
          Briefing · <em className="italic" style={{ color: p.accent }}>aujourd&apos;hui</em>
        </>
      }
      subtitle="Ce qui demande votre attention, puis la tendance utilisateurs."
      actions={
        <>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </button>
          <span className="text-xs px-2" style={{ color: p.ink2 }}>
            {formatRelativeTimeFr(kpis.generatedAt, { now })}
          </span>
        </>
      }
    >
      {/* 1 — Priorités */}
      <AdminActionQueue
        serifClass={adminSerifClass}
        correctionsPending={kpis.correctionsPending}
        requestsPending={kpis.requestsPending}
        catalogUnenriched={kpis.catalogUnenriched}
        catalogUnenrichedByType={kpis.catalogUnenrichedByType}
        newsReportsPending={kpis.newsReportsPending}
        disagreedAgeItems={kpis.disagreedAgeItems}
      />

      {/* 2 — Traction (compact) + croissance */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
        <div className="flex flex-col gap-3">
          <AdminKpiTile
            label="Modération"
            value={fmt(pendingModeration)}
            sub="files en attente"
            wow={
              pendingModeration === 0
                ? { text: "à jour", tone: "neutral" }
                : { text: "à traiter", tone: "down" }
            }
          />
          <AdminKpiTile
            label="Nouveaux comptes"
            value={fmt(kpis.usersWeek)}
            sub={`${fmt(kpis.usersMonth)} sur 30 j`}
            wow={wowLabel(kpis.usersWeek, kpis.usersPrevWeek)}
          />
          <AdminKpiTile
            label="Réactions"
            value={fmt(kpis.reactionsWeek)}
            sub="7 derniers jours"
            wow={wowLabel(kpis.reactionsWeek, kpis.reactionsPrevWeek)}
          />
          <AdminKpiTile
            label="Foyers"
            value={fmt(kpis.familiesTotal)}
            sub={`${fmt(kpis.familiesCompleteThree)} complets (≥3)`}
          />
        </div>

        <div
          className="rounded-2xl p-5 md:p-6 min-w-0"
          style={{ background: p.bg2, border: `1px solid ${p.line}` }}
        >
          <AdminSectionTitle
            title="Croissance · 30 jours"
            subtitle={`${fmt(kpis.catalogTotal)} œuvres · ${kpis.cronErrors7d === 0 ? "cron OK" : `${kpis.cronErrors7d} err. cron 7j`}`}
          />
          <AdminGrowthChart data={kpis.dailyGrowth} />
        </div>
      </div>

      {/* 3 — Jobs : alertes seulement */}
      <AdminCronAlerts tasks={kpis.cronTasks} now={now} />

      {/* Accès rapides */}
      <div className="flex flex-wrap gap-2 pt-2">
        <QuickLink href="/admin/operations" icon={Settings} label="Outils & import" primary />
        <QuickLink href="/admin/totem" icon={Bot} label="Assistant Totem" />
        <QuickLink href="/admin/enrich" icon={Sparkles} label="Enrichir" />
      </div>
    </AdminShell>
  )
}

function QuickLink({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  primary?: boolean
}) {
  const p = adminPalette
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
      style={{
        background: primary ? p.ink : p.card,
        color: primary ? p.bg : p.ink,
        border: `1px solid ${primary ? p.ink : p.line}`,
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </Link>
  )
}
