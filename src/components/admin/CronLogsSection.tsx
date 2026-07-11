"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Brain,
  BarChart3,
  Play,
  Sparkles,
  RefreshCw,
  SpellCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface CronLog {
  id: string
  task: string
  status: string
  summary: string | null
  details: Record<string, unknown> | null
  duration: number | null
  createdAt: string
}

interface TaskSummary {
  task: string
  totalRuns: number
  lastRun: string | null
  last30Days: number
  errors30Days: number
}

const TASK_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  import: { label: "Import TMDB", icon: Download, color: "bg-blue-100 text-blue-700" },
  enrich: { label: "Enrichissement IA", icon: Brain, color: "bg-purple-100 text-purple-700" },
  "backfill-ratings": { label: "Notes TMDB", icon: BarChart3, color: "bg-amber-100 text-amber-700" },
  quality: { label: "Scores qualite", icon: RefreshCw, color: "bg-green-100 text-green-700" },
  streaming: { label: "Plateformes", icon: Play, color: "bg-cyan-100 text-cyan-700" },
  similarity: { label: "Similarites", icon: Sparkles, color: "bg-indigo-100 text-indigo-700" },
  "synopsis-audit": { label: "Audit synopsis", icon: SpellCheck, color: "bg-emerald-100 text-emerald-700" },
}

const STATUS_ICON: Record<string, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  partial: AlertTriangle,
}

const STATUS_COLOR: Record<string, string> = {
  success: "text-green-600",
  error: "text-red-600",
  partial: "text-amber-600",
}

function formatDuration(ms: number | null): string {
  if (!ms) return "-"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function CronLogsSection({ variant = "default" }: { variant?: "default" | "apercu" }) {
  const [logs, setLogs] = useState<CronLog[]>([])
  const [summary, setSummary] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const p = APERCU_PALETTE
  const isApercu = variant === "apercu"

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fetchLogs = () => {
    setLoading(true)
    fetch("/api/admin/cron-logs?limit=20")
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs || [])
        setSummary(data.summary || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchLogs() }, [])

  const inner = (
    <>
      {isApercu && (
        <div className="flex justify-end mb-3 -mt-1">
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold disabled:opacity-50"
            style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </button>
        </div>
      )}

      {summary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {summary.map((s) => {
            const meta = TASK_META[s.task] || { label: s.task, icon: Clock, color: "bg-gray-100 text-gray-700" }
            const Icon = meta.icon
            const errorRate = s.last30Days > 0 ? Math.round((s.errors30Days / s.last30Days) * 100) : 0
            return (
              <div
                key={s.task}
                className="rounded-xl p-2 text-center"
                style={
                  isApercu
                    ? { background: p.bg2, border: `1px solid ${p.line}` }
                    : undefined
                }
              >
                <div className={`inline-flex p-1.5 rounded-lg ${meta.color} mb-1`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-medium truncate" style={isApercu ? { color: p.ink } : undefined}>
                  {meta.label}
                </p>
                <p className="text-[10px]" style={{ color: isApercu ? p.ink2 : undefined }}>
                  {s.last30Days} runs / 30j
                  {errorRate > 0 && (
                    <span style={{ color: p.accent }} className="ml-1">
                      ({errorRate}% err)
                    </span>
                  )}
                </p>
                {s.lastRun && (
                  <p className="text-[10px]" style={{ color: isApercu ? p.ink2 : undefined }}>
                    {formatDistanceToNow(new Date(s.lastRun), { addSuffix: true, locale: fr })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {logs.length === 0 && !loading ? (
        <p className="text-center py-4 text-sm" style={{ color: isApercu ? p.ink2 : undefined }}>
          Aucun job automatique enregistré
        </p>
      ) : (
        <div
          className="max-h-80 overflow-y-auto"
          style={isApercu ? { borderTop: `1px solid ${p.line}` } : undefined}
        >
          {logs.map((log, idx) => {
            const meta = TASK_META[log.task] || { label: log.task, icon: Clock, color: "bg-gray-100 text-gray-700" }
            const TaskIcon = meta.icon
            const StatusIcon = STATUS_ICON[log.status] || AlertTriangle
            const statusColor = STATUS_COLOR[log.status] || "text-gray-500"
            const hasDetails = !!log.details && Object.keys(log.details).length > 0
            const isOpen = expanded.has(log.id)

            return (
              <div
                key={log.id}
                className="py-2.5"
                style={
                  isApercu && idx > 0 ? { borderTop: `1px solid ${p.line}` } : undefined
                }
              >
                <div
                  className={`flex items-start gap-2 ${hasDetails ? "cursor-pointer" : ""}`}
                  onClick={hasDetails ? () => toggleExpanded(log.id) : undefined}
                >
                  <div className={`p-1.5 rounded-lg ${meta.color} mt-0.5`}>
                    <TaskIcon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium" style={isApercu ? { color: p.ink } : undefined}>
                        {meta.label}
                      </span>
                      <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                      {log.duration && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {formatDuration(log.duration)}
                        </Badge>
                      )}
                    </div>
                    {log.summary && (
                      <p
                        className={isOpen ? "text-xs mt-0.5" : "text-xs mt-0.5 truncate"}
                        style={{ color: isApercu ? p.ink2 : undefined }}
                      >
                        {log.summary}
                      </p>
                    )}
                    <p className="text-[10px] mt-0.5" style={{ color: isApercu ? p.ink2 : undefined }}>
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                  {hasDetails && (
                    <span className="mt-0.5 shrink-0" style={{ color: isApercu ? p.ink2 : undefined }}>
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                  )}
                </div>
                {hasDetails && isOpen && (
                  <pre
                    className="mt-2 ml-7 max-h-64 overflow-auto rounded-lg p-2 text-[10px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{
                      background: isApercu ? p.bg2 : "var(--muted, #f4f4f5)",
                      border: `1px solid ${isApercu ? p.line : "var(--border, #e4e4e7)"}`,
                      color: isApercu ? p.ink2 : undefined,
                    }}
                  >
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  if (isApercu) {
    return <div>{inner}</div>
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Jobs automatiques
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  )
}
