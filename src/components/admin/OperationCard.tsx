"use client"

import { type LucideIcon, Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  type OperationStatus,
  type OperationProgress,
  type OperationResult,
} from "@/hooks/useOperation"

export interface OperationColors {
  iconBg: string    // e.g. "bg-green-100 text-green-700"
  border: string    // e.g. "border-green-300 hover:bg-green-50"
  progress: string  // e.g. "bg-green-500"
}

interface OperationCardProps {
  label: string
  description: string
  icon: LucideIcon
  colors: OperationColors
  status: OperationStatus
  progress: OperationProgress
  result: OperationResult | null
  elapsed: number
  onRun: () => void
  onCancel: () => void
  statLabels?: Record<string, string>
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs.toString().padStart(2, "0")}s`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs.toString().padStart(2, "0")}s`
}

export function OperationCard({
  label,
  description,
  icon: Icon,
  colors,
  status,
  progress,
  result,
  elapsed,
  onRun,
  onCancel,
  statLabels,
}: OperationCardProps) {
  const pct =
    progress.total && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : null

  return (
    <div className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
      {/* Header row: icon + label + action button */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${colors.iconBg}`}>
            {status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {label}
            </h4>
            {status === "idle" && !result && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {status === "running" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              Annuler
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onRun}
              className={`text-xs ${colors.border}`}
            >
              {status === "error" ? (
                <>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Relancer
                </>
              ) : (
                "Lancer"
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Running: progress bar + live stats */}
      {status === "running" && (
        <div className="mt-3 space-y-2">
          {pct !== null ? (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>
                  {progress.processed}/{progress.total}
                </span>
                <span>{pct}%</span>
              </div>
              <Progress
                value={pct}
                className="h-2"
                indicatorClassName={colors.progress}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>{progress.processed} traites</span>
              {progress.chunks > 1 && (
                <span className="text-gray-400">
                  (lot {progress.chunks})
                </span>
              )}
            </div>
          )}

          {/* Live stat counters */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {statLabels &&
              Object.entries(statLabels).map(([key, lbl]) => {
                const val = (progress as any)[key]
                if (val === undefined || val === null) return null
                return (
                  <span key={key} className="text-gray-600">
                    <span className="font-medium">{val}</span>{" "}
                    <span className="text-gray-400">{lbl}</span>
                  </span>
                )
              })}
            {(progress.errors ?? 0) > 0 && (
              <span className="text-red-600">
                <span className="font-medium">{progress.errors}</span> erreurs
              </span>
            )}
          </div>

          {/* Elapsed time */}
          <div className="text-[10px] text-gray-400">
            {formatElapsed(elapsed)}
          </div>
        </div>
      )}

      {/* Done / Error: result summary */}
      {(status === "done" || status === "error") && result && (
        <div className="mt-3">
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p
                className={`text-xs font-medium ${
                  result.success ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {result.summary}
              </p>
              {result.error && (
                <p className="text-xs text-red-500 mt-0.5">{result.error}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-0.5">
                {formatDuration(result.durationMs)} &middot;{" "}
                {formatDistanceToNow(result.completedAt, {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Idle with previous result: show last run info */}
      {status === "idle" && result && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
          {result.success ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          ) : (
            <XCircle className="h-3 w-3 text-red-400" />
          )}
          <span>
            Dernier :{" "}
            {formatDistanceToNow(result.completedAt, {
              addSuffix: true,
              locale: fr,
            })}
          </span>
          <span className="text-gray-300">|</span>
          <span className="truncate">{result.summary}</span>
        </div>
      )}
    </div>
  )
}
