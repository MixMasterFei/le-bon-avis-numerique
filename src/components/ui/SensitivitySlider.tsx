"use client"

import { cn } from "@/lib/utils"

interface SensitivityOption {
  value: number
  label: string
  description?: string
}

interface SensitivitySliderProps {
  label: string
  icon?: React.ReactNode
  value: number
  onChange: (value: number) => void
  options?: SensitivityOption[]
  type?: "sensitivity" | "preference"
  className?: string
}

const DEFAULT_SENSITIVITY_OPTIONS: SensitivityOption[] = [
  { value: 0, label: "Pas de restriction", description: "Tout contenu accepté" },
  { value: 1, label: "Tolérant", description: "Tolérance élevée" },
  { value: 2, label: "Modéré", description: "Modération standard" },
  { value: 3, label: "Strict", description: "Restrictions strictes" },
]

const DEFAULT_PREFERENCE_OPTIONS: SensitivityOption[] = [
  { value: 0, label: "Indifférent", description: "Pas d'importance" },
  { value: 1, label: "Apprécié", description: "C'est un plus" },
  { value: 2, label: "Préféré", description: "Important" },
  { value: 3, label: "Requis", description: "Indispensable" },
]

export function SensitivitySlider({
  label,
  icon,
  value,
  onChange,
  options,
  type = "sensitivity",
  className,
}: SensitivitySliderProps) {
  const defaultOptions = type === "sensitivity" ? DEFAULT_SENSITIVITY_OPTIONS : DEFAULT_PREFERENCE_OPTIONS
  const activeOptions = options || defaultOptions

  const currentOption = activeOptions.find(o => o.value === value) || activeOptions[2]

  // Color based on type and value
  const getColor = (v: number, active: boolean) => {
    if (!active) return "bg-gray-200 hover:bg-gray-300"

    if (type === "sensitivity") {
      // For sensitivity: 0 = green (permissive), 3 = red (strict)
      switch (v) {
        case 0: return "bg-green-500"
        case 1: return "bg-yellow-500"
        case 2: return "bg-orange-500"
        case 3: return "bg-red-500"
        default: return "bg-gray-500"
      }
    } else {
      // For preferences: all positive = blue shades
      switch (v) {
        case 0: return "bg-gray-400"
        case 1: return "bg-blue-300"
        case 2: return "bg-blue-500"
        case 3: return "bg-blue-700"
        default: return "bg-gray-500"
      }
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="font-medium text-sm">{label}</span>
        </div>
        <span className="text-xs text-gray-500">{currentOption.label}</span>
      </div>

      <div className="flex items-center gap-1">
        {activeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-3 flex-1 rounded-full transition-all duration-200",
              getColor(option.value, value >= option.value),
              value === option.value && "ring-2 ring-offset-1 ring-gray-400"
            )}
            title={option.description}
            aria-label={`${label}: ${option.label}`}
          />
        ))}
      </div>

      {currentOption.description && (
        <p className="text-xs text-gray-500">{currentOption.description}</p>
      )}
    </div>
  )
}
