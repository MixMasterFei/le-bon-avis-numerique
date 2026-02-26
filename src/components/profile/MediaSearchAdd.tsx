"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Plus, Check, Loader2, Heart, Film, Tv, Gamepad2, BookOpen, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"

interface Suggestion {
  id: string
  title: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
  posterUrl: string | null
  year: number | null
  ageRec: number | null
}

interface MediaSearchAddProps {
  memberId: string
  memberName: string
  existingMediaIds: Set<string>
  onAdded: (media: { id: string; title: string; posterUrl: string | null; type: string }) => void
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  MOVIE: Film,
  TV: Tv,
  GAME: Gamepad2,
  BOOK: BookOpen,
  APP: Smartphone,
}

const typeLabels: Record<string, string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu",
  BOOK: "Livre",
  APP: "App",
}

export function MediaSearchAdd({ memberId, memberName, existingMediaIds, onAdded }: MediaSearchAddProps) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [addingId, setAddingId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  // Fetch suggestions with debounce
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
        // Silently fail
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleAdd = async (suggestion: Suggestion) => {
    if (existingMediaIds.has(suggestion.id) || addingId) return

    setAddingId(suggestion.id)
    try {
      const res = await fetch("/api/user/reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          familyMemberId: memberId,
          mediaId: suggestion.id,
          reaction: "LOVED",
        }),
      })

      if (res.ok) {
        onAdded({
          id: suggestion.id,
          title: suggestion.title,
          posterUrl: suggestion.posterUrl,
          type: suggestion.type,
        })
        setQuery("")
        setSuggestions([])
        setShowDropdown(false)
      }
    } catch {
      // Silently fail
    } finally {
      setAddingId(null)
    }
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
          handleAdd(suggestions[selectedIndex])
        }
        break
      case "Escape":
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 h-4 w-4 text-gray-400 animate-spin" />
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder={`Ajouter un film, une série, un jeu pour ${memberName}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && query.trim().length >= 2) {
              setShowDropdown(true)
            }
          }}
          autoComplete="off"
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          <ul className="py-1 max-h-72 overflow-y-auto">
            {suggestions.map((suggestion, index) => {
              const Icon = typeIcons[suggestion.type] || Film
              const isExisting = existingMediaIds.has(suggestion.id)
              const isAdding = addingId === suggestion.id

              return (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    disabled={isExisting || isAdding}
                    className={cn(
                      "w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors",
                      index === selectedIndex ? "bg-violet-50" : "hover:bg-gray-50",
                      isExisting ? "opacity-60" : ""
                    )}
                    onClick={() => handleAdd(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {/* Poster thumbnail */}
                    {suggestion.posterUrl ? (
                      <img
                        src={suggestion.posterUrl}
                        alt=""
                        className="w-8 h-12 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-gray-400" />
                      </div>
                    )}

                    {/* Info */}
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

                    {/* Action indicator */}
                    <div className="flex-shrink-0">
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
                      ) : isExisting ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <div className="flex items-center gap-1 text-violet-600">
                          <Heart className="h-3.5 w-3.5" />
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
  )
}
