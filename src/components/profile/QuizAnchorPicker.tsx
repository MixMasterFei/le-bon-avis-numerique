"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import {
  Search, Plus, Check, Loader2, Heart, X,
  Film, Tv, Gamepad2, BookOpen, Smartphone, Library,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Quiz anchor: a title the parent declares the member loves or rejects, BEFORE
// any watch event. Stored as a `MediaReaction` with `source: "quiz_anchor"`
// and reaction `LOVED` or `NOT_FOR_ME` so engagement stats stay clean (organic
// only) while the family-fit affinity layer picks up the signal.

export type AnchorSentiment = "love" | "dislike"

interface Suggestion {
  id: string
  title: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  posterUrl: string | null
  year: number | null
  ageRec: number | null
}

export interface AnchorEntry {
  id: string
  title: string
  posterUrl: string | null
  type: string
}

interface QuizAnchorPickerProps {
  memberId: string
  memberName: string
  sentiment: AnchorSentiment
  // Existing anchors (loved or disliked) keyed by mediaId so the dropdown can
  // mark already-picked titles. Updated optimistically when the user adds.
  picks: AnchorEntry[]
  // Combined exclusion set so the same title can't appear in BOTH panes.
  alreadyTaken: Set<string>
  onChange: (picks: AnchorEntry[]) => void
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  MOVIE: Film, TV: Tv, GAME: Gamepad2, BOOK: BookOpen, APP: Smartphone, MANGA: Library,
}
const typeLabels: Record<string, string> = {
  MOVIE: "Film", TV: "Série", GAME: "Jeu", BOOK: "Livre", APP: "App", MANGA: "Manga",
}

const SENTIMENT_CONFIG = {
  love: {
    reaction: "LOVED" as const,
    placeholder: "Ajouter un film, une série, un jeu adoré…",
    chipBg: "bg-rose-50",
    chipBorder: "border-rose-200",
    chipText: "text-rose-700",
    accent: "text-rose-600",
    Icon: Heart,
  },
  dislike: {
    reaction: "NOT_FOR_ME" as const,
    placeholder: "Ajouter un titre à ne pas recommander…",
    chipBg: "bg-slate-50",
    chipBorder: "border-slate-200",
    chipText: "text-slate-700",
    accent: "text-slate-600",
    Icon: X,
  },
} as const

export function QuizAnchorPicker({
  memberId,
  memberName,
  sentiment,
  picks,
  alreadyTaken,
  onChange,
}: QuizAnchorPickerProps) {
  const cfg = SENTIMENT_CONFIG[sentiment]

  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [addingId, setAddingId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions || [])
          setShowDropdown(true)
          setSelectedIndex(-1)
        }
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const addPick = async (suggestion: Suggestion) => {
    if (alreadyTaken.has(suggestion.id) || addingId) return
    setAddingId(suggestion.id)
    try {
      const res = await fetch("/api/user/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMemberId: memberId,
          mediaId: suggestion.id,
          reaction: cfg.reaction,
          source: "quiz_anchor",
        }),
      })
      if (res.ok) {
        onChange([
          ...picks,
          {
            id: suggestion.id,
            title: suggestion.title,
            posterUrl: suggestion.posterUrl,
            type: suggestion.type,
          },
        ])
        setQuery("")
        setSuggestions([])
        setShowDropdown(false)
      }
    } catch {
      // silent
    } finally {
      setAddingId(null)
    }
  }

  const removePick = async (entry: AnchorEntry) => {
    try {
      await fetch(
        `/api/user/reaction?familyMemberId=${memberId}&mediaId=${entry.id}`,
        { method: "DELETE" },
      )
    } catch {
      // silent — optimistic UI
    }
    onChange(picks.filter((p) => p.id !== entry.id))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          addPick(suggestions[selectedIndex])
        }
        break
      case "Escape":
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  const Icon = cfg.Icon

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Search */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 h-4 w-4 text-gray-400 animate-spin" />
        )}
        <input
          type="text"
          placeholder={cfg.placeholder.replace("{name}", memberName)}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && query.trim().length >= 2) setShowDropdown(true)
          }}
          autoComplete="off"
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
            <ul className="py-1 max-h-72 overflow-y-auto">
              {suggestions.map((suggestion, index) => {
                const TypeIcon = typeIcons[suggestion.type] || Film
                const isTaken = alreadyTaken.has(suggestion.id)
                const isAdding = addingId === suggestion.id
                return (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      disabled={isTaken || isAdding}
                      className={cn(
                        "w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors",
                        index === selectedIndex ? "bg-violet-50" : "hover:bg-gray-50",
                        isTaken ? "opacity-60" : "",
                      )}
                      onClick={() => addPick(suggestion)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      {suggestion.posterUrl ? (
                        <Image
                          src={suggestion.posterUrl}
                          alt=""
                          width={32}
                          height={48}
                          unoptimized
                          className="w-8 h-12 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                          <TypeIcon className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{suggestion.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {typeLabels[suggestion.type]}
                          </span>
                          {suggestion.year && (
                            <span className="text-xs text-gray-400">{suggestion.year}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {isAdding ? (
                          <Loader2 className={cn("h-4 w-4 animate-spin", cfg.accent)} />
                        ) : isTaken ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <div className={cn("flex items-center gap-1", cfg.accent)}>
                            <Icon className="h-3.5 w-3.5" />
                            <Plus className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Current picks as removable chips */}
      {picks.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picks.map((entry) => (
            <li key={entry.id}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                  cfg.chipBg,
                  cfg.chipBorder,
                  cfg.chipText,
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="truncate max-w-[160px]">{entry.title}</span>
                <button
                  type="button"
                  onClick={() => removePick(entry)}
                  className="hover:opacity-70"
                  aria-label={`Retirer ${entry.title}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {picks.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          {sentiment === "love"
            ? "Aucun titre ajouté — vous pouvez passer cette étape."
            : "Aucun titre ajouté — facultatif."}
        </p>
      )}
    </div>
  )
}
