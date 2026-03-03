"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

const ICON_CATEGORIES = {
  "Personnes": [
    "👧", "👦", "👶", "🧒", "👩", "👨", "🧑", "👴", "👵",
    "👧🏻", "👦🏻", "👶🏻", "🧒🏻", "👩🏻", "👨🏻",
    "👧🏽", "👦🏽", "👶🏽", "🧒🏽", "👩🏽", "👨🏽",
    "👧🏿", "👦🏿", "👶🏿", "🧒🏿", "👩🏿", "👨🏿",
    "🧔", "👩‍🦱", "👨‍🦱", "👩‍🦰", "👨‍🦰",
  ],
  "Animaux": [
    "🐱", "🐶", "🐰", "🦊", "🐻", "🐼", "🦁", "🐸", "🦄",
    "🐲", "🦋", "🐝", "🦉", "🐧", "🐨", "🦈", "🐙", "🦖",
    "🐢", "🦜",
  ],
  "Objets": [
    "🎮", "🎸", "🎨", "🏀", "⚽", "🎭", "🚀", "🛹", "🏄",
    "🎯", "🌟", "💫", "🌈", "🎪", "🎬", "📚", "🔬", "🧩",
  ],
  "Abstrait": [
    "🌊", "🌿", "🔥", "❄️", "🌙", "⭐", "💜", "💙", "💚",
    "🧡", "💛", "❤️", "🤍", "🖤", "🤎",
  ],
} as const

type CategoryName = keyof typeof ICON_CATEGORIES

interface IconPickerProps {
  value: string
  onChange: (emoji: string) => void
  className?: string
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryName>("Personnes")

  const categories = Object.keys(ICON_CATEGORIES) as CategoryName[]

  return (
    <div className={cn("space-y-3", className)}>
      {/* Large preview */}
      <div className="flex items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-pink-100 border-2 border-violet-200 flex items-center justify-center shadow-inner">
          <span className="text-5xl" role="img" aria-label="Avatar sélectionné">
            {value || "👤"}
          </span>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors",
              activeCategory === cat
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto p-1">
        {ICON_CATEGORIES[activeCategory].map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-lg text-xl transition-all hover:scale-110 hover:bg-violet-50",
              value === emoji
                ? "bg-violet-100 ring-2 ring-violet-400 scale-110"
                : "bg-transparent"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

// Export flat list for backward compatibility with existing EMOJI_OPTIONS usage
export const ALL_ICONS = Object.values(ICON_CATEGORIES).flat()
