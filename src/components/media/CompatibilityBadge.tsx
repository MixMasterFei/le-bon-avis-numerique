"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MemberScore {
  memberId: string
  memberName: string
  score: number
  concerns: string[]
}

interface CompatibilityBadgeProps {
  familyScore: number
  memberScores?: MemberScore[]
  hasAnyConcerns?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  showDetails?: boolean
}

export function CompatibilityBadge({
  familyScore,
  memberScores = [],
  hasAnyConcerns = false,
  size = "md",
  className,
  showDetails = true,
}: CompatibilityBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 60) return "bg-yellow-500"
    if (score >= 40) return "bg-orange-500"
    return "bg-red-500"
  }

  const getTextColor = (score: number) => {
    if (score >= 80) return "text-green-700"
    if (score >= 60) return "text-yellow-700"
    if (score >= 40) return "text-orange-700"
    return "text-red-700"
  }

  const getBgColor = (score: number) => {
    if (score >= 80) return "bg-green-50"
    if (score >= 60) return "bg-yellow-50"
    if (score >= 40) return "bg-orange-50"
    return "bg-red-50"
  }

  const getLabel = (score: number) => {
    if (score >= 90) return "Excellent"
    if (score >= 80) return "Tres bien"
    if (score >= 70) return "Bien"
    if (score >= 60) return "Correct"
    if (score >= 50) return "Moyen"
    if (score >= 40) return "A verifier"
    return "Deconseille"
  }

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  }

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        getBgColor(familyScore),
        getTextColor(familyScore),
        sizeClasses[size],
        className
      )}
    >
      {familyScore >= 80 ? (
        <CheckCircle className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      ) : hasAnyConcerns ? (
        <AlertCircle className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      ) : (
        <Info className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      )}
      <span>{familyScore}%</span>
    </div>
  )

  if (!showDetails || memberScores.length === 0) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button className="cursor-help" onClick={() => setIsOpen(!isOpen)}>
            {badge}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="w-64 p-0 bg-white border shadow-lg rounded-lg"
        >
          <div className="p-3 border-b">
            <p className="font-medium text-sm">Compatibilite famille</p>
            <p className="text-xs text-gray-500">{getLabel(familyScore)}</p>
          </div>
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
            {memberScores.map((member) => (
              <div key={member.memberId} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{member.memberName}</span>
                  <span
                    className={cn(
                      "text-xs font-medium px-1.5 py-0.5 rounded",
                      getBgColor(member.score),
                      getTextColor(member.score)
                    )}
                  >
                    {member.score}%
                  </span>
                </div>
                {member.concerns.length > 0 && (
                  <ul className="text-xs text-gray-500 space-y-0.5">
                    {member.concerns.slice(0, 3).map((concern, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                        {concern}
                      </li>
                    ))}
                    {member.concerns.length > 3 && (
                      <li className="text-gray-400">
                        +{member.concerns.length - 3} autres points
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Simple version for use without tooltip
export function CompatibilityScore({
  score,
  size = "md",
  showLabel = false,
  className,
}: {
  score: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-green-600"
    if (s >= 60) return "text-yellow-600"
    if (s >= 40) return "text-orange-600"
    return "text-red-600"
  }

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }

  const getLabel = (s: number) => {
    if (s >= 90) return "Excellent"
    if (s >= 80) return "Tres bien"
    if (s >= 70) return "Bien"
    if (s >= 60) return "OK"
    if (s >= 40) return "Moyen"
    return "Faible"
  }

  return (
    <span
      className={cn(
        "font-medium",
        getColor(score),
        sizeClasses[size],
        className
      )}
    >
      {score}%{showLabel && ` - ${getLabel(score)}`}
    </span>
  )
}
