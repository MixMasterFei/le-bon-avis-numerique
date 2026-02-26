"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Film, Tv, Gamepad2, BookOpen, Smartphone, Loader2, X, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Popular search suggestions shown below the search bar
const popularSearches = [
  { label: "Films pour enfants", href: "/age/5-7" },
  { label: "Animation", href: "/recherche?q=animation" },
  { label: "Aventure", href: "/recherche?q=aventure" },
  { label: "Comédie", href: "/recherche?q=comédie" },
]

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
        className="relative"
      >
        <div className="relative flex items-center bg-white rounded-2xl shadow-2xl shadow-black/20 ring-4 ring-white/10">
          <Search className="absolute left-5 h-5 w-5 text-gray-400 pointer-events-none" />
          {loading && (
            <Loader2 className="absolute right-36 h-4 w-4 text-gray-400 animate-spin" />
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
              className="absolute right-36 h-6 w-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un film, une série, un jeu..."
            className="w-full pl-14 pr-36 h-16 text-lg bg-transparent text-gray-900 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-2xl"
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
            className="absolute right-2 h-12 px-6 rounded-xl shadow-lg font-semibold transition-all duration-300 hover:scale-105"
            disabled={query.trim().length < 2}
          >
            Rechercher
          </Button>
        </div>
      </form>

      {/* Autocomplete dropdown - Bold styling */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[100] overflow-hidden">
          <ul className="py-2 max-h-72 overflow-y-auto">
            {suggestions.map((suggestion, index) => {
              const Icon = typeIcons[suggestion.type] || Film
              return (
                <li key={`${suggestion.type}:${suggestion.id}`}>
                  <button
                    type="button"
                    className={`w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-gray-50 transition-all duration-200 ${
                      index === selectedIndex ? "bg-gray-50 border-l-4 border-primary" : ""
                    }`}
                    onClick={() => goToMedia(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="p-2 rounded-xl bg-gray-100">
                      <Icon className="h-4 w-4 text-gray-600 flex-shrink-0" />
                    </div>
                    <span className="font-semibold text-gray-800 truncate flex-1">{suggestion.title}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-medium flex-shrink-0">{typeLabels[suggestion.type]}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Popular searches - Single line pills */}
      <div className="mt-5 flex items-center justify-center gap-3">
        <span className="text-gray-600 text-sm flex items-center gap-1.5 font-medium shrink-0">
          <TrendingUp className="h-4 w-4" />
          Populaire:
        </span>
        {popularSearches.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 px-4 py-1.5 rounded-full transition-all duration-300 border border-gray-200/50 hover:border-gray-300 font-medium backdrop-blur-sm whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
















