"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Film, Tv, Gamepad2, BookOpen, Smartphone, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Suggestion {
  id: string
  title: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP"
  posterUrl: string | null
  year: number | null
  ageRec: number | null
}

const typeIcons: Record<string, any> = {
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

export function HeroSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  const submit = () => {
    const q = query.trim()
    if (!q) return
    setShowDropdown(false)
    router.push(`/recherche?q=${encodeURIComponent(q)}`)
  }

  const goToMedia = (suggestion: Suggestion) => {
    setShowDropdown(false)
    setQuery(suggestion.title)
    router.push(`/media/${suggestion.id}`)
  }

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

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
      } catch (error) {
        console.error("Autocomplete error:", error)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault()
        submit()
      }
      return
    }

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
          goToMedia(suggestions[selectedIndex])
        } else {
          submit()
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
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
        {loading && (
          <Loader2 className="absolute right-36 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin z-10" />
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setSuggestions([])
              setShowDropdown(false)
              inputRef.current?.focus()
            }}
            className="absolute right-36 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 z-10"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <Input
          ref={inputRef}
          type="text"
          placeholder="Rechercher un film, une série, un jeu..."
          className="pl-12 pr-36 h-14 text-lg bg-white text-gray-900 border-0 shadow-xl rounded-xl"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && query.trim().length >= 2) {
              setShowDropdown(true)
            }
          }}
          autoComplete="off"
        />
        <Button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 z-10"
          disabled={query.trim().length < 2}
        >
          Rechercher
        </Button>
      </form>

      {/* Autocomplete dropdown - positioned fixed to avoid overflow clipping */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-2xl border border-gray-200 z-[100]">
          <ul className="py-1 max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => {
              const Icon = typeIcons[suggestion.type] || Film
              return (
                <li key={`${suggestion.type}:${suggestion.id}`}>
                  <button
                    type="button"
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors ${
                      index === selectedIndex ? "bg-blue-50" : ""
                    }`}
                    onClick={() => goToMedia(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900 truncate flex-1">{suggestion.title}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{typeLabels[suggestion.type]}</span>
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





