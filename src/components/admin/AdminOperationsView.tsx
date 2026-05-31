"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { RefreshCw, Settings, Upload, Sparkles, FileWarning, Wrench, CalendarClock, Loader2 } from "lucide-react"
import {
  QuickActionsBar,
  ImportPresetsBar,
  OperationsCenter,
} from "@/components/admin"
import { CronLogsSection } from "@/components/admin/CronLogsSection"
import { AdminShell } from "./shared/AdminShell"
import { OperationsSectionNav } from "./OperationsSectionNav"
import { adminPalette } from "./shared/admin-ui"
import { AdminSectionCard } from "./shared/AdminSectionCard"

const EnrichmentPanel = dynamic(
  () => import("./panels/EnrichmentPanel").then((m) => m.EnrichmentPanel),
  {
    loading: () => (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: adminPalette.accent }} />
      </div>
    ),
  },
)

const ModerationPanel = dynamic(
  () => import("./panels/ModerationPanel").then((m) => m.ModerationPanel),
  {
    loading: () => (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: adminPalette.accent }} />
      </div>
    ),
  },
)

interface Props {
  initialEnrichType?: string
}

export function AdminOperationsView({ initialEnrichType }: Props) {
  const [loading, setLoading] = useState(false)
  const [importKey, setImportKey] = useState(0)
  const p = adminPalette

  const bump = useCallback(() => {
    setImportKey((k) => k + 1)
  }, [])

  const onRefresh = useCallback(() => {
    setLoading(true)
    bump()
    setTimeout(() => setLoading(false), 400)
  }, [bump])

  useEffect(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash
    if (!hash) return
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }, [])

  return (
    <AdminShell
      active="operations"
      eyebrow="Opérations"
      icon={Settings}
      title={
        <>
          Boîte à <em className="italic" style={{ color: p.accent }}>outils</em>
        </>
      }
      subtitle="Tout sur une page — import, enrichissement, modération, maintenance et jobs."
      actions={
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      }
    >
      <OperationsSectionNav />

      <div id="import" className="scroll-mt-28">
        <AdminSectionCard
          icon={Upload}
          title="Importer du contenu"
          subtitle="Recherche ciblée ou lots prédéfinis"
        >
          <QuickActionsBar key={`qa-${importKey}`} embedded onImportComplete={bump} />
          <ImportPresetsBar embedded onImportComplete={bump} />
        </AdminSectionCard>
      </div>

      <div id="enrich" className="scroll-mt-28">
        <AdminSectionCard
          icon={Sparkles}
          title="Enrichissement IA"
          subtitle="Pass 1 (batch) et pass 2 (profond) — âge expert et métriques contenu"
        >
          <EnrichmentPanel initialType={initialEnrichType} />
        </AdminSectionCard>
      </div>

      <div id="moderation" className="scroll-mt-28">
        <AdminSectionCard
          icon={FileWarning}
          title="Modération"
          subtitle="Corrections utilisateurs et demandes de nouveaux contenus"
        >
          <ModerationPanel />
        </AdminSectionCard>
      </div>

      <div id="maintenance" className="scroll-mt-28">
        <AdminSectionCard
          icon={Wrench}
          title="Maintenance catalogue"
          subtitle="Opérations groupées — filtrez par mot-clé"
        >
          <OperationsCenter onComplete={bump} startCollapsed />
        </AdminSectionCard>
      </div>

      <div id="cron" className="scroll-mt-28">
        <AdminSectionCard
          icon={CalendarClock}
          title="Historique des jobs"
          subtitle="Dernières exécutions cron et taux d'erreur sur 30 jours"
        >
          <CronLogsSection variant="apercu" />
        </AdminSectionCard>
      </div>
    </AdminShell>
  )
}
