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

const FACES_PER_PAGE = 8

/** Generate a batch of deterministic seeds */
function generateSeedBatch(batchId: number): string[] {
  const seeds: string[] = []
  for (let i = 0; i < FACES_PER_PAGE; i++) {
    // Use a deterministic-ish seed so the batch stays stable during renders
    seeds.push(`pick-${batchId}-${i}-${Math.random().toString(36).slice(2, 8)}`)
  }
  return seeds
}

export function AvatarPicker({ value, onChange, className }: AvatarPickerProps) {
  const [selectedBg, setSelectedBg] = useState<string | null>(
    (value.options?.backgroundColor as string) ?? null
  )
  const [seedBatch, setSeedBatch] = useState<string[]>(() => {
    // Initial batch: include current seed + random ones
    const batch: string[] = [value.seed]
    for (let i = 1; i < FACES_PER_PAGE; i++) {
      batch.push(randomSeed())
    }
    return batch
  })

  const handleStyleChange = useCallback(
    (styleId: string) => {
      onChange({
        ...value,
        style: styleId,
      })
    },
    [value, onChange]
  )

  const handlePickFace = useCallback(
    (seed: string) => {
      onChange({
        ...value,
        seed,
      })
    },
    [value, onChange]
  )

  const handleShowMore = useCallback(() => {
    // Generate a new batch, keeping the current selection in slot 0
    const batch: string[] = [value.seed]
    for (let i = 1; i < FACES_PER_PAGE; i++) {
      batch.push(randomSeed())
    }
    setSeedBatch(batch)
  }, [value.seed])

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

  // Style selector previews (one per style)
  const stylePreviews = useMemo(
    () =>
      AVATAR_STYLES.map((s) => ({
        ...s,
        preview: getAvatarDataUri(s.id, value.seed, undefined, 80),
      })),
    [value.seed]
  )

  // Face grid: all seeds rendered in the current style with current bg
  const faceOptions = useMemo(
    () =>
      seedBatch.map((seed) => ({
        seed,
        uri: getAvatarDataUri(value.style, seed, value.options, 96),
      })),
    [seedBatch, value.style, value.options]
  )

  return (
    <div className={cn("space-y-4", className)}>
      {/* Style selector (wrapping grid) */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Style</p>
        <div className="grid grid-cols-4 gap-1.5">
          {stylePreviews.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleStyleChange(s.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 p-1.5 rounded-lg border-2 transition-all duration-200",
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
                width={32}
                height={32}
                className="rounded-full"
                draggable={false}
              />
              <span className="text-[9px] font-medium text-gray-600 leading-tight text-center truncate w-full">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Face grid — pick your favorite */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Choisissez un visage</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleShowMore}
            className="gap-1.5 text-xs text-violet-600 hover:text-violet-700 h-7"
          >
            <RefreshCw className="w-3 h-3" />
            Autres visages
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {faceOptions.map(({ seed, uri }) => (
            <button
              key={seed}
              type="button"
              onClick={() => handlePickFace(seed)}
              className={cn(
                "aspect-square rounded-xl border-2 p-1 transition-all duration-200",
                "hover:border-violet-300 hover:scale-105",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                value.seed === seed
                  ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200 scale-105"
                  : "border-gray-200 bg-white"
              )}
              aria-label="Choisir ce visage"
              aria-pressed={value.seed === seed}
            >
              <img
                src={uri}
                alt=""
                className="w-full h-full rounded-lg"
                draggable={false}
              />
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
              "w-8 h-8 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
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
