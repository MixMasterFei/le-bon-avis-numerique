"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react"
import type { SerializedCronTask } from "@/lib/admin-kpis"
import { adminPalette, AdminSectionTitle, fmt } from "./shared/admin-ui"

export type { SerializedCronTask } from "@/lib/admin-kpis"

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
  "news.prewarmImagesV4": "Images actu",
  "news.pressKitScout": "Press kits",
  "weekly-dossier": "Dossier hebdo",
  "family-content-agent": "Agent éditorial",
  "debt-digest": "Dette technique",
  "seo-striking-distance": "SEO striking",
  "cron-supervisor": "Superviseur",
  heartbeat: "Heartbeat",
}

function fmtRelative(iso: string | null, now: number): string {
  if (!iso) return "jamais exécuté"
  const ms = now - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

function isProblematic(task: SerializedCronTask, now: number): boolean {
  if (task.errors7d > 0) return true
  if (!task.lastRun) return true
  const hours = (now - new Date(task.lastRun).getTime()) / 3600000
  const weekly = new Set([
    "import",
    "import-games",
    "backfill-ratings",
    "streaming",
    "similarity",
    "weekly-dossier",
    "family-content-agent",
    "debt-digest",
    "seo-striking-distance",
  ])
  const threshold = weekly.has(task.task) ? 8 * 24 : 36
  return hours > threshold
}

export function AdminCronAlerts({
  tasks,
  now,
}: {
  tasks: SerializedCronTask[]
  now: number
}) {
  const p = adminPalette
  const problems = tasks.filter((t) => isProblematic(t, now))
  const errorCount = tasks.filter((t) => t.errors7d > 0).length

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-4">
        <AdminSectionTitle
          title="Jobs automatiques"
          subtitle={
            problems.length === 0
              ? "Toutes les tâches sont à jour"
              : `${problems.length} tâche${problems.length > 1 ? "s" : ""} nécessite${problems.length > 1 ? "nt" : ""} votre attention`
          }
        />
        <Link
          href="/admin/operations#cron"
          className="text-xs font-semibold inline-flex items-center gap-1 hover:opacity-70 shrink-0"
          style={{ color: p.ink2 }}
        >
          Historique complet <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {problems.length === 0 ? (
        <div
          className="rounded-2xl px-5 py-4 flex items-center gap-3 text-sm"
          style={{ background: "rgba(92,138,92,0.1)", border: `1px solid rgba(92,138,92,0.25)` }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "#5C8A5C" }} />
          <span style={{ color: p.ink }}>
            Pipeline sain — {errorCount === 0 ? "aucune erreur" : `${errorCount} erreur(s)`} sur 7 jours.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {problems.slice(0, 6).map((t) => {
            const reason =
              t.errors7d > 0
                ? `${fmt(t.errors7d)} erreur${t.errors7d > 1 ? "s" : ""} · 7j`
                : !t.lastRun
                  ? "Jamais exécuté"
                  : "Exécution trop ancienne"
            return (
              <div
                key={t.task}
                className="rounded-2xl px-4 py-3 flex items-start gap-3"
                style={{ background: p.card, border: `1px solid ${p.line2}` }}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: p.accent }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: p.ink }}>
                    {LABELS[t.task] ?? t.task}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: p.accent }}>
                    {reason}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: p.ink2 }}>
                    {fmtRelative(t.lastRun, now)}
                  </div>
                </div>
              </div>
            )
          })}
          {problems.length > 6 && (
            <Link
              href="/admin/operations#cron"
              className="rounded-2xl px-4 py-3 flex items-center justify-center text-sm font-semibold"
              style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink }}
            >
              +{problems.length - 6} autres…
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
