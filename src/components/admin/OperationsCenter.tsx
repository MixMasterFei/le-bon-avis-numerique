"use client"

import { useEffect, useRef } from "react"
import {
  Database,
  Globe,
  RefreshCw,
  Play,
  Sparkles,
  Camera,
  Shield,
  FileDown,
  HardDrive,
  BadgeCheck,
  Gamepad2,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { useOperation, type OperationConfig } from "@/hooks/useOperation"
import { OperationCard, type OperationColors } from "./OperationCard"

// ── Single operation wrapper (safe hook usage) ─────────────

interface OperationItemProps {
  config: OperationConfig
  label: string
  description: string
  icon: LucideIcon
  colors: OperationColors
  statLabels?: Record<string, string>
  onComplete?: () => void
}

function OperationItem({
  config,
  label,
  description,
  icon,
  colors,
  statLabels,
  onComplete,
}: OperationItemProps) {
  const op = useOperation(config)
  const prevStatus = useRef(op.status)

  useEffect(() => {
    if (
      prevStatus.current === "running" &&
      (op.status === "done" || op.status === "error")
    ) {
      onComplete?.()
    }
    prevStatus.current = op.status
  }, [op.status, onComplete])

  return (
    <OperationCard
      label={label}
      description={description}
      icon={icon}
      colors={colors}
      status={op.status}
      progress={op.progress}
      result={op.result}
      elapsed={op.elapsed}
      onRun={op.run}
      onCancel={op.cancel}
      statLabels={statLabels}
    />
  )
}

// ── Color presets (full Tailwind class names for JIT) ──────

const COLORS: Record<string, OperationColors> = {
  green: {
    iconBg: "bg-green-100 text-green-700",
    border: "border-green-300 hover:bg-green-50",
    progress: "bg-green-500",
  },
  blue: {
    iconBg: "bg-blue-100 text-blue-700",
    border: "border-blue-300 hover:bg-blue-50",
    progress: "bg-blue-500",
  },
  yellow: {
    iconBg: "bg-yellow-100 text-yellow-700",
    border: "border-yellow-300 hover:bg-yellow-50",
    progress: "bg-yellow-500",
  },
  purple: {
    iconBg: "bg-purple-100 text-purple-700",
    border: "border-purple-300 hover:bg-purple-50",
    progress: "bg-purple-500",
  },
  indigo: {
    iconBg: "bg-indigo-100 text-indigo-700",
    border: "border-indigo-300 hover:bg-indigo-50",
    progress: "bg-indigo-500",
  },
  cyan: {
    iconBg: "bg-cyan-100 text-cyan-700",
    border: "border-cyan-300 hover:bg-cyan-50",
    progress: "bg-cyan-500",
  },
  amber: {
    iconBg: "bg-amber-100 text-amber-700",
    border: "border-amber-300 hover:bg-amber-50",
    progress: "bg-amber-500",
  },
  emerald: {
    iconBg: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-300 hover:bg-emerald-50",
    progress: "bg-emerald-500",
  },
  red: {
    iconBg: "bg-red-100 text-red-700",
    border: "border-red-300 hover:bg-red-50",
    progress: "bg-red-500",
  },
}

// ── Operation configs ──────────────────────────────────────

const OPERATIONS: Array<{
  config: OperationConfig
  label: string
  description: string
  icon: LucideIcon
  color: string
  statLabels?: Record<string, string>
}> = [
  {
    config: {
      key: "syncDb",
      endpoint: "/api/admin/db/sync",
      method: "POST",
      chunked: false,
      extractProgress: (data) => ({
        processed: data.results?.length || 0,
        total: data.results?.length || 0,
        errors: data.results?.filter((r: any) => !r.success).length || 0,
      }),
      buildSummary: (stats) => {
        const errs = stats.errors || 0
        const ok = (stats.processed || 0) - errs
        return `${ok} migrations OK${errs ? `, ${errs} erreurs` : ""}`
      },
    },
    label: "Sync schema DB",
    description: "Synchroniser les migrations",
    icon: Database,
    color: "green",
  },
  {
    config: {
      key: "backfillLanguage",
      endpoint: "/api/admin/db/backfill-language",
      method: "POST",
      body: { limit: 50, offset: 0 },
      chunked: true,
      delayMs: 1000,
      accumKeys: ["processed", "errors"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.remaining ? (data.processed || 0) + data.remaining : null,
        errors: data.errors || 0,
      }),
      isDone: (data) => data.done === true,
      buildSummary: (stats) => {
        const errs = stats.errors || 0
        return `${stats.processed || 0} traites${errs ? `, ${errs} erreurs` : ""}`
      },
    },
    label: "Backfill langues",
    description: "Remplir les langues manquantes via TMDB",
    icon: Globe,
    color: "blue",
  },
  {
    config: {
      key: "computeQuality",
      endpoint: "/api/admin/quality/compute",
      method: "POST",
      body: { limit: 200, offset: 0 },
      chunked: true,
      delayMs: 500,
      accumKeys: ["processed"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.total || null,
      }),
      isDone: (data) => data.done === true,
      buildSummary: (stats) =>
        `${stats.processed || 0} scores recalcules`,
    },
    label: "Recalculer qualite",
    description: "Recalculer les scores de qualite des fiches",
    icon: RefreshCw,
    color: "yellow",
  },
  {
    config: {
      key: "cacheStreaming",
      endpoint: "/api/admin/streaming/cache",
      method: "POST",
      body: { limit: 10 },
      chunked: true,
      delayMs: 1000,
      accumKeys: ["processed", "updated", "errors"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.remaining ? (data.processed || 0) + data.remaining : null,
        updated: data.updated || 0,
        errors: data.errors || 0,
      }),
      isDone: (data) => data.done === true,
      buildSummary: (stats) => {
        const errs = stats.errors || 0
        return `${stats.processed || 0} traites, ${stats.updated || 0} mis a jour${errs ? `, ${errs} erreurs` : ""}`
      },
    },
    label: "MAJ streaming",
    description: "Mettre a jour les disponibilites streaming",
    icon: Play,
    color: "purple",
    statLabels: { updated: "maj" },
  },
  {
    config: {
      key: "computeSimilarity",
      endpoint: "/api/admin/similarity/compute",
      method: "POST",
      body: { limit: 20 },
      chunked: true,
      delayMs: 500,
      accumKeys: ["processed", "updated"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.total || null,
        updated: (data.created || 0) + (data.updated || 0),
      }),
      isDone: (data) => data.done === true,
      getNextParams: (data, params) => {
        if (!data.nextOffset) return null
        params.set("offset", String(data.nextOffset))
        return params
      },
      buildSummary: (stats) =>
        `${stats.processed || 0} paires, ${stats.updated || 0} similarites`,
    },
    label: "Similarites",
    description: "Calculer les similarites entre contenus",
    icon: Sparkles,
    color: "indigo",
    statLabels: { updated: "similarites" },
  },
  {
    config: {
      key: "importScreenshots",
      endpoint: "/api/admin/screenshots/import",
      method: "POST",
      body: {
        mediaType: "ALL",
        limit: 10,
        screenshotsPerMedia: 6,
        skipExisting: true,
      },
      chunked: true,
      delayMs: 3000,
      accumKeys: ["processed", "updated", "skipped", "errors"],
      extractProgress: (data) => ({
        processed: data.stats?.total || 0,
        total: data.remaining ? (data.stats?.total || 0) + data.remaining : null,
        updated: data.stats?.imported || 0,
        skipped: data.stats?.skipped || 0,
        errors: data.stats?.errors || 0,
      }),
      isDone: (data) => data.done === true,
      getNextParams: (data, params) => {
        if (!data.lastId) return null
        params.set("afterId", data.lastId)
        return params
      },
      detectRateLimit: (_data, consecutiveEmpty) => consecutiveEmpty >= 2,
      buildSummary: (stats) => {
        const errs = stats.errors || 0
        return `${stats.updated || 0} importes, ${stats.skipped || 0} ignores${errs ? `, ${errs} erreurs` : ""}`
      },
    },
    label: "Screenshots",
    description: "Importer les captures d'ecran depuis TMDB/IGDB",
    icon: Camera,
    color: "cyan",
    statLabels: { updated: "importes", skipped: "ignores" },
  },
  {
    config: {
      key: "fixTP",
      endpoint: "/api/admin/fix-default-tp",
      method: "POST",
      chunked: true,
      delayMs: 1000,
      accumKeys: ["processed", "matched", "updated", "errors", "skipped"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.totalTP || null,
        matched: data.resetToNull || 0,
        updated: data.updatedToReal || 0,
        skipped: data.keptAsTP || 0,
        errors: data.errors || 0,
      }),
      isDone: (data) => data.done === true,
      buildSummary: (stats) => {
        const parts: string[] = []
        if (stats.matched) parts.push(`${stats.matched} remis a null`)
        if (stats.updated) parts.push(`${stats.updated} corriges`)
        if (stats.skipped) parts.push(`${stats.skipped} confirmes TP`)
        if (stats.errors) parts.push(`${stats.errors} erreurs`)
        return parts.join(", ") || `${stats.processed || 0} traites`
      },
    },
    label: "Fix faux TP",
    description: "Corriger les faux 'Tous publics' via TMDB",
    icon: Shield,
    color: "amber",
    statLabels: { matched: "remis a null", updated: "corriges", skipped: "confirmes TP" },
  },
  {
    config: {
      key: "backfillCertifications",
      endpoint: "/api/admin/backfill-certifications",
      method: "POST",
      body: { limit: 20, mediaType: "ALL" },
      chunked: true,
      delayMs: 1500,
      accumKeys: ["processed", "updated", "skipped", "errors"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.remaining ? (data.processed || 0) + data.remaining : null,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
      }),
      isDone: (data) => data.done === true,
      getNextParams: (data, params) => {
        if (!data.lastId) return null
        params.set("afterId", data.lastId)
        return params
      },
      detectRateLimit: (_data, consecutiveEmpty) => consecutiveEmpty >= 3,
      buildSummary: (stats) => {
        const errs = stats.errors || 0
        return `${stats.updated || 0} classifies, ${stats.skipped || 0} sans classif. TMDB${errs ? `, ${errs} erreurs` : ""}`
      },
    },
    label: "Backfill classif.",
    description: "Remplir les classif. manquantes via TMDB",
    icon: BadgeCheck,
    color: "amber",
    statLabels: { updated: "classifies", skipped: "sans donnees" },
  },
  {
    config: {
      key: "fixGameCovers",
      endpoint: "/api/admin/fix-game-covers",
      method: "POST",
      chunked: false,
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.processed || 0,
        updated: data.updated || 0,
      }),
      buildSummary: (stats) =>
        `${stats.updated || 0} covers mises a jour en 720p`,
    },
    label: "Fix covers jeux",
    description: "Upgrader les covers IGDB en haute resolution (720p)",
    icon: Gamepad2,
    color: "indigo",
    statLabels: { updated: "upgradees" },
  },
  {
    config: {
      key: "importCNC",
      endpoint: "/api/admin/import-cnc-ratings",
      method: "POST",
      chunked: true,
      delayMs: 1000,
      accumKeys: ["processed", "matched", "updated", "errors", "skipped"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.totalRemaining || null,
        matched: data.matched || 0,
        updated: data.updated || 0,
        skipped: data.skipped || 0,
        errors: data.errors || 0,
      }),
      isDone: (data) => data.done === true || !data.nextOffset,
      buildSummary: (stats) => {
        const parts: string[] = []
        parts.push(`${stats.processed || 0} traites`)
        if (stats.matched) parts.push(`${stats.matched} correspondances`)
        if (stats.updated) parts.push(`${stats.updated} mis a jour`)
        if (stats.errors) parts.push(`${stats.errors} erreurs`)
        return parts.join(", ")
      },
    },
    label: "Import CNC",
    description: "Importer les classif. officielles depuis le CNC",
    icon: FileDown,
    color: "emerald",
    statLabels: { matched: "trouves", updated: "mis a jour" },
  },
  {
    config: {
      key: "migrateStorage",
      endpoint: "/api/admin/storage/migrate",
      method: "POST",
      body: {
        target: "all",
        limit: 10,
      },
      chunked: true,
      delayMs: 2000,
      accumKeys: ["processed", "updated", "skipped", "errors"],
      extractProgress: (data) => ({
        processed: data.stats?.total || 0,
        total: data.remaining ? (data.stats?.total || 0) + data.remaining : null,
        updated: data.stats?.imported || 0,
        skipped: data.stats?.skipped || 0,
        errors: data.stats?.errors || 0,
      }),
      isDone: (data) => data.done === true,
      getNextParams: (data, params) => {
        if (!data.lastId) return null
        params.set("afterId", data.lastId)
        return params
      },
      detectRateLimit: (_data, consecutiveEmpty) => consecutiveEmpty >= 3,
      buildSummary: (stats) => {
        const errs = stats.errors || 0
        return `${stats.updated || 0} images migrees, ${stats.skipped || 0} ignorees${errs ? `, ${errs} erreurs` : ""}`
      },
    },
    label: "Migration images",
    description: "Copier les images vers Supabase Storage",
    icon: HardDrive,
    color: "purple",
    statLabels: { updated: "migrees", skipped: "ignorees" },
  },
  {
    config: {
      key: "cleanupNonFrench",
      endpoint: "/api/admin/cleanup-non-french",
      method: "POST",
      body: { limit: 30 },
      chunked: true,
      delayMs: 2000,
      accumKeys: ["processed", "deleted", "kept", "errors"],
      extractProgress: (data) => ({
        processed: data.processed || 0,
        total: data.remaining ? (data.processed || 0) + data.remaining : null,
        deleted: data.deleted || 0,
        kept: data.kept || 0,
        errors: data.errors || 0,
      }),
      isDone: (data) => data.done === true,
      getNextParams: (data, params) => {
        if (!data.lastId) return null
        params.set("afterId", data.lastId)
        return params
      },
      buildSummary: (stats) => {
        const parts: string[] = []
        if (stats.deleted) parts.push(`${stats.deleted} supprimes`)
        if (stats.kept) parts.push(`${stats.kept} conserves`)
        if (stats.errors) parts.push(`${stats.errors} erreurs`)
        return parts.join(", ") || `${stats.processed || 0} traites`
      },
    },
    label: "Nettoyage catalogue",
    description: "Supprimer les contenus non disponibles en France",
    icon: Trash2,
    color: "red",
    statLabels: { deleted: "supprimes", kept: "conserves" },
  },
]

// ── Component ──────────────────────────────────────────────

interface OperationsCenterProps {
  onComplete?: () => void
}

export function OperationsCenter({ onComplete }: OperationsCenterProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {OPERATIONS.map((op) => (
        <OperationItem
          key={op.config.key}
          config={op.config}
          label={op.label}
          description={op.description}
          icon={op.icon}
          colors={COLORS[op.color]}
          statLabels={op.statLabels}
          onComplete={onComplete}
        />
      ))}
    </div>
  )
}
