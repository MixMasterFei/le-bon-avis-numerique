"use client"

import { Progress } from "@/components/ui/progress"
import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCompletionItems, type CompletionMember } from "@/lib/profile-completion"

interface CompletionMeterProps {
  member: CompletionMember
  reactionCount: number
  compact?: boolean
  className?: string
}

export function CompletionMeter({ member, reactionCount, compact, className }: CompletionMeterProps) {
  const items = getCompletionItems(member, reactionCount)
  const percentage = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0)
  const missing = items.filter((item) => !item.done)

  const indicatorColor =
    percentage >= 80 ? "bg-emerald-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-400"

  if (compact) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Profil</span>
          <span
            className={cn(
              "text-xs font-bold",
              percentage >= 80 ? "text-emerald-600" : percentage >= 50 ? "text-amber-600" : "text-red-500"
            )}
          >
            {percentage}%
          </span>
        </div>
        <Progress value={percentage} indicatorClassName={indicatorColor} className="h-1.5" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Profil complété</span>
        <span
          className={cn(
            "text-sm font-bold",
            percentage >= 80 ? "text-emerald-600" : percentage >= 50 ? "text-amber-600" : "text-red-500"
          )}
        >
          {percentage}%
        </span>
      </div>

      <Progress value={percentage} indicatorClassName={indicatorColor} />

      {missing.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs font-medium text-gray-500">Prochaines étapes :</p>
          <ul className="space-y-1">
            {missing.slice(0, 3).map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs text-gray-500">
                <Circle className="h-3 w-3 flex-shrink-0 text-gray-300" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {missing.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Profil bien renseigné. Les recommandations s&apos;affinent encore avec vos réactions.
        </p>
      )}
    </div>
  )
}
