"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Search, Film, Tv, Gamepad2, BookOpen, Smartphone, Loader2, X, TrendingUp, ChevronDown } from "lucide-react"
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
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  posterUrl: string | null
  year: number | null
  ageRec: number | null
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

// Type filter ("Tout" = no scoping, others = single MediaType).
// Mirrors IMDB's leftmost dropdown — pre-filters /api/autocomplete
// so users can scope before they finish typing.
type SearchType = "ALL" | "MOVIE" | "TV" | "GAME" | "BOOK"
const typeFilters: { value: SearchType; label: string }[] = [
  { value: "ALL", label: "Tout" },
  { value: "MOVIE", label: "Films" },
  { value: "TV", label: "Séries" },
  { value: "GAME", label: "Jeux" },
  { value: "BOOK", label: "Livres" },
]

interface HeroSearchProps {
  /** Override classes applied to the submit button. Used by the Apercu
   * hero to swap the default violet for the warm ink palette. */
  submitClassName?: string
}

export function HeroSearch({ submitClassName }: HeroSearchProps = {}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState<SearchType>("ALL")
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typeMenuRef = useRef<HTMLDivElement>(null)
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

  // Fetch suggestions with debounce. Re-runs on type change too —
  // switching filter from "Tout" to "Films" should re-query immediately.
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
        const params = new URLSearchParams({ q: query.trim() })
        if (searchType !== "ALL") params.set("type", searchType)
        const res = await fetch(`/api/autocomplete?${params}`)
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
  }, [query, searchType])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setShowTypeMenu(false)
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
          {/* IMDB-style type filter — pre-filters /api/autocomplete
              before the request so the dropdown only shows matching
              media. "Tout" = no scoping. */}
          <div ref={typeMenuRef} className="relative flex-shrink-0 self-stretch flex items-center pl-3 pr-2 sm:pl-4 sm:pr-3 border-r border-gray-200">
            <button
              type="button"
              onClick={() => setShowTypeMenu((v) => !v)}
              className="flex items-center gap-1 text-xs sm:text-sm text-gray-700 font-medium hover:text-gray-900 transition-colors py-1"
              aria-label="Filtrer par type"
            >
              {typeFilters.find((t) => t.value === searchType)?.label ?? "Tout"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTypeMenu ? "rotate-180" : ""}`} />
            </button>
            {showTypeMenu && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-[210]">
                {typeFilters.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setSearchType(t.value)
                      setShowTypeMenu(false)
                      inputRef.current?.focus()
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-gray-50 ${
                      searchType === t.value ? "font-semibold text-gray-900" : "text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Search className="absolute left-[5.5rem] sm:left-[6rem] top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 pointer-events-none hidden sm:block" />
          {loading && (
            <Loader2 className="absolute right-14 sm:right-36 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 animate-spin" />
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
              aria-label="Effacer la recherche"
              className="absolute right-14 sm:right-36 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center text-gray-500 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un film, une série, un jeu..."
            className="w-full pl-3 sm:pl-16 pr-14 sm:pr-36 h-14 sm:h-16 text-base sm:text-lg bg-transparent text-gray-900 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-2xl"
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
            aria-label="Rechercher"
            // On mobile (<sm) the button becomes icon-only so the input has
            // real room to breathe on 360-414px widths. Desktop keeps the
            // "Rechercher" label.
            className={`absolute right-2 h-10 sm:h-12 w-10 sm:w-auto sm:px-6 rounded-xl shadow-lg font-semibold transition-all duration-300 hover:scale-105 flex items-center justify-center ${submitClassName ?? ""}`}
            disabled={query.trim().length < 2}
          >
            <Search className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Rechercher</span>
          </Button>
        </div>
      </form>

      {/* Autocomplete dropdown — IMDB-inspired result row: poster
          thumbnail (with icon fallback), title, year, age badge,
          type pill. Connected look (mt-1) and z-[200] so it rides
          above any sibling section's stacking context. */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[200] overflow-hidden">
          <ul className="py-1 max-h-96 overflow-y-auto">
            {suggestions.map((suggestion, index) => {
              const Icon = typeIcons[suggestion.type] || Film
              return (
                <li key={`${suggestion.type}:${suggestion.id}`}>
                  <button
                    type="button"
                    className={`w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors ${
                      index === selectedIndex ? "bg-gray-50" : ""
                    }`}
                    onClick={() => goToMedia(suggestion)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    {/* Poster thumb (40×60, 2:3) — falls back to a
                        type-icon tile when no poster is available
                        (rare but happens for very recent imports). */}
                    <div className="relative w-10 h-[60px] rounded-md overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {suggestion.posterUrl ? (
                        <Image
                          src={suggestion.posterUrl}
                          alt={suggestion.title}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <Icon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate text-sm">{suggestion.title}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{typeLabels[suggestion.type]}</span>
                        {suggestion.year && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{suggestion.year}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {suggestion.ageRec !== null && (
                      <span className="text-xs font-bold text-gray-700 bg-amber-100 px-2 py-1 rounded-md flex-shrink-0">
                        {suggestion.ageRec}+
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Popular searches — single row on desktop, slightly smaller
          pills so all 4 fit alongside the "Populaire:" label within
          the search bar's max-w-xl width. Mobile keeps wrap as a
          safety net for very narrow viewports. */}
      <div className="mt-4 flex flex-wrap sm:flex-nowrap items-center justify-center gap-2">
        <span className="text-gray-600 text-xs flex items-center gap-1.5 font-medium shrink-0">
          <TrendingUp className="h-3.5 w-3.5" />
          Populaire:
        </span>
        {popularSearches.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-xs bg-white/60 hover:bg-white/80 text-gray-700 hover:text-gray-900 px-2.5 py-1 rounded-full transition-all duration-300 border border-gray-200/50 hover:border-gray-300 font-medium backdrop-blur-sm whitespace-nowrap"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
















