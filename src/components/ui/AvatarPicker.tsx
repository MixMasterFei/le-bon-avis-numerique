"use client"

import { useState, useMemo, useCallback } from "react"
import { getAvatarDataUri, AVATAR_STYLES, BACKGROUND_COLORS, randomSeed, DEFAULT_STYLE } from "@/lib/avatar"
import { cn } from "@/lib/utils"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface AvatarValue {
  style: string
  seed: string
  options?: Record<string, unknown>
}

interface AvatarPickerProps {
  value: AvatarValue
  onChange: (value: AvatarValue) => void
  className?: string
}

export function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  const [selectedBg, setSelectedBg] = useState<string | null>(
    (value.options?.backgroundColor as string) ?? null
  )

  const handleStyleChange = useCallback(
    (styleId: string) => {
      onChange({
        ...value,
        style: styleId,
      })
    },
    [value, onChange]
  )

  const handleShuffle = useCallback(() => {
    onChange({
      ...value,
      seed: randomSeed(),
    })
  }, [value, onChange])

  const handleBgChange = useCallback(
    (color: string) => {
      const newBg = selectedBg === color ? null : color
      setSelectedBg(newBg)
      onChange({
        ...value,
        options: newBg
          ? { ...value.options, backgroundColor: [newBg] }
          : (() => {
              const opts = { ...value.options }
              delete opts.backgroundColor
              return Object.keys(opts).length > 0 ? opts : undefined
            })(),
      })
    },
    [value, onChange, selectedBg]
  )

  // Live preview (large)
  const previewUri = useMemo(
    () => getAvatarDataUri(value.style, value.seed, value.options, 192),
    [value.style, value.seed, value.options]
  )

  // Style previews (smaller, for the grid)
  const stylePreviews = useMemo(
    () =>
      AVATAR_STYLES.map((s) => ({
        ...s,
        preview: getAvatarDataUri(s.id, value.seed, undefined, 80),
      })),
    [value.seed]
  )

  return (
    <div className={cn("space-y-4", className)}>
      {/* Live preview */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <img
            src={previewUri}
            alt="Aperçu de l'avatar"
            width={96}
            height={96}
            className="rounded-full bg-gray-50 ring-4 ring-violet-100 transition-all duration-300"
            draggable={false}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleShuffle}
          className="gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Nouveau visage
        </Button>
      </div>

      {/* Style grid */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Style</p>
        <div className="grid grid-cols-4 gap-2">
          {stylePreviews.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStyleChange(s.id)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-200",
                "hover:border-violet-300 hover:bg-violet-50/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                value.style === s.id
                  ? "border-violet-500 bg-violet-50"
                  : "border-gray-200 bg-white"
              )}
              aria-label={`Style ${s.label}`}
              aria-pressed={value.style === s.id}
            >
              <img
                src={s.preview}
                alt={s.label}
                width={40}
                height={40}
                className="rounded-full"
                draggable={false}
              />
              <span className="text-[10px] font-medium text-gray-600 leading-tight text-center">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Background color palette */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Couleur de fond</p>
        <div className="flex gap-2 flex-wrap">
          {BACKGROUND_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleBgChange(color)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-all duration-200",
                "hover:scale-110",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                selectedBg === color
                  ? "border-violet-500 ring-2 ring-violet-200"
                  : "border-gray-200"
              )}
              style={{ backgroundColor: `#${color}` }}
              aria-label={`Couleur #${color}`}
              aria-pressed={selectedBg === color}
            />
          ))}
          {/* No background option */}
          <button
            type="button"
            onClick={() => handleBgChange("")}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all duration-200",
              "hover:scale-110 bg-white",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
              !selectedBg
                ? "border-violet-500 ring-2 ring-violet-200"
                : "border-gray-200"
            )}
            aria-label="Sans couleur de fond"
            aria-pressed={!selectedBg}
          >
            <span className="text-xs text-gray-400">∅</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Create a default AvatarValue for new members.
 */
export function defaultAvatarValue(): AvatarValue {
  return {
    style: DEFAULT_STYLE,
    seed: randomSeed(),
  }
}
