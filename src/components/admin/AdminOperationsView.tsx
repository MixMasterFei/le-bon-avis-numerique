"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Settings, Upload, Wrench, CalendarClock } from "lucide-react"
import {
  QuickActionsBar,
  ImportPresetsBar,
  OperationsCenter,
} from "@/components/admin"
import { CronLogsSection } from "@/components/admin/CronLogsSection"
import { AdminShell } from "./shared/AdminShell"
import { AdminOpsShortcuts } from "./AdminOpsShortcuts"
import { adminPalette } from "./shared/admin-ui"
import { AdminSectionCard } from "./shared/AdminSectionCard"

export function AdminOperationsView() {
  const [loading, setLoading] = useState(false)
  const [importKey, setImportKey] = useState(0)
  const [requestImportOpen, setRequestImportOpen] = useState(false)
  const importRef = useRef<HTMLDivElement>(null)
  const p = adminPalette

  const bump = useCallback(() => {
    setImportKey((k) => k + 1)
  }, [])

  const openImport = useCallback(() => {
    importRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    setRequestImportOpen(true)
  }, [])

  // OperationsCenter gère son propre état ; on ne charge plus tout le dashboard API.
  const onRefresh = useCallback(() => {
    setLoading(true)
    bump()
    setTimeout(() => setLoading(false), 400)
  }, [bump])

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const el = document.querySelector(window.location.hash)
      el?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
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
      subtitle="Import manuel, maintenance catalogue et suivi des jobs automatiques."
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
      <AdminOpsShortcuts onQuickImport={openImport} />

      <div ref={importRef} id="import">
        <AdminSectionCard
          icon={Upload}
          title="Importer du contenu"
          subtitle="Recherche ciblée ou lots prédéfinis"
        >
          <QuickActionsBar
            key={`qa-${importKey}`}
            embedded
            onImportComplete={bump}
            requestOpen={requestImportOpen}
            onOpenHandled={() => setRequestImportOpen(false)}
          />
          <ImportPresetsBar embedded onImportComplete={bump} />
        </AdminSectionCard>
      </div>

      <div id="maintenance">
        <AdminSectionCard
          icon={Wrench}
          title="Maintenance catalogue"
          subtitle="Opérations groupées — utilisez la recherche pour filtrer"
        >
          <OperationsCenter onComplete={bump} startCollapsed />
        </AdminSectionCard>
      </div>

      <div id="cron">
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
