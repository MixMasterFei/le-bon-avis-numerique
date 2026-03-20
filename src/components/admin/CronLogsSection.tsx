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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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

export function CronLogsSection() {
  const [logs, setLogs] = useState<CronLog[]>([])
  const [summary, setSummary] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)

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
      <CardContent>
        {/* Summary cards */}
        {summary.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            {summary.map((s) => {
              const meta = TASK_META[s.task] || { label: s.task, icon: Clock, color: "bg-gray-100 text-gray-700" }
              const Icon = meta.icon
              const errorRate = s.last30Days > 0 ? Math.round((s.errors30Days / s.last30Days) * 100) : 0
              return (
                <div key={s.task} className="border rounded-lg p-2 text-center">
                  <div className={`inline-flex p-1.5 rounded-lg ${meta.color} mb-1`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-medium truncate">{meta.label}</p>
                  <p className="text-[10px] text-gray-500">
                    {s.last30Days} runs / 30j
                    {errorRate > 0 && (
                      <span className="text-red-500 ml-1">({errorRate}% err)</span>
                    )}
                  </p>
                  {s.lastRun && (
                    <p className="text-[10px] text-gray-400">
                      {formatDistanceToNow(new Date(s.lastRun), { addSuffix: true, locale: fr })}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Recent logs */}
        {logs.length === 0 && !loading ? (
          <p className="text-gray-500 text-center py-4 text-sm">
            Aucun job automatique enregistre
          </p>
        ) : (
          <div className="divide-y max-h-80 overflow-y-auto">
            {logs.map((log) => {
              const meta = TASK_META[log.task] || { label: log.task, icon: Clock, color: "bg-gray-100 text-gray-700" }
              const TaskIcon = meta.icon
              const StatusIcon = STATUS_ICON[log.status] || AlertTriangle
              const statusColor = STATUS_COLOR[log.status] || "text-gray-500"

              return (
                <div key={log.id} className="py-2 flex items-start gap-2">
                  <div className={`p-1.5 rounded-lg ${meta.color} mt-0.5`}>
                    <TaskIcon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{meta.label}</span>
                      <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                      {log.duration && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {formatDuration(log.duration)}
                        </Badge>
                      )}
                    </div>
                    {log.summary && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate">{log.summary}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
