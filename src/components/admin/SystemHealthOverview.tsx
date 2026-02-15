"use client"

import { useEffect, useState } from "react"
import { Shield, Camera, Brain, Play, BarChart3 } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface HealthData {
  total: number
  ratings: { count: number; pct: number }
  screenshots: { count: number; pct: number }
  enriched: { count: number; pct: number }
  streaming: { count: number; pct: number }
  quality: { avg: number }
}

function pctColor(pct: number): string {
  if (pct >= 70) return "text-emerald-700"
  if (pct >= 40) return "text-amber-600"
  return "text-red-600"
}

function progressColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-500"
  if (pct >= 40) return "bg-amber-500"
  return "bg-red-500"
}

const METRICS = [
  {
    key: "ratings" as const,
    label: "Classif. officielle",
    icon: Shield,
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    key: "screenshots" as const,
    label: "Screenshots",
    icon: Camera,
    bg: "bg-cyan-50",
    iconColor: "text-cyan-600",
  },
  {
    key: "enriched" as const,
    label: "Enrichi IA",
    icon: Brain,
    bg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    key: "streaming" as const,
    label: "Streaming",
    icon: Play,
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
]

export function SystemHealthOverview() {
  const [data, setData] = useState<HealthData | null>(null)

  useEffect(() => {
    fetch("/api/admin/health")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
  }, [])

  if (!data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {METRICS.map(({ key, label, icon: Icon, bg, iconColor }) => {
        const metric = data[key]
        return (
          <div key={key} className={`rounded-lg p-3 ${bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-4 w-4 ${iconColor}`} />
              <span className="text-xs font-medium text-gray-600 truncate">
                {label}
              </span>
            </div>
            <div className={`text-2xl font-bold ${pctColor(metric.pct)}`}>
              {metric.pct}%
            </div>
            <Progress
              value={metric.pct}
              className="h-1.5 mt-1.5 bg-white/60"
              indicatorClassName={progressColor(metric.pct)}
            />
            <div className="text-[10px] text-gray-500 mt-1">
              {metric.count}/{data.total}
            </div>
          </div>
        )
      })}

      {/* Quality score */}
      <div className="rounded-lg p-3 bg-green-50">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-green-600" />
          <span className="text-xs font-medium text-gray-600 truncate">
            Qualite moy.
          </span>
        </div>
        <div className={`text-2xl font-bold ${pctColor(data.quality.avg)}`}>
          {data.quality.avg}%
        </div>
        <Progress
          value={data.quality.avg}
          className="h-1.5 mt-1.5 bg-white/60"
          indicatorClassName={progressColor(data.quality.avg)}
        />
        <div className="text-[10px] text-gray-500 mt-1">
          Score moyen
        </div>
      </div>
    </div>
  )
}
