"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  Search,
  Menu,
  X,
  Film,
  Tv,
  Gamepad2,
  BookOpen,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Info,
  Target,
  Heart,
  BookText,
  Newspaper,
  Microscope,
  Baby,
  Star,
  Bookmark,
  Users,
  Loader2,
  Smartphone,
  Clock,
  Home,
  Gauge,
} from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"
import { useRecentSearches } from "@/hooks/useRecentSearches"
import { ageBadgeLabel } from "@/lib/age-label"

interface NavItem {
  name: string
  href: string
  icon: typeof Film
  // When true, renders as a disabled pill with a "Bientôt" badge
  // instead of a clickable link. Used for verticals being built but
  // not yet ready to ship publicly.
  comingSoon?: boolean
}

// Mangas intentionally omitted from the top nav during soft launch —
// catalog quality is still being calibrated (non-French synopses,
// partial coverage). Admins reach /mangas via direct URL or the admin
// dashboard. Add back here when ready for public launch.
//
// Actualités removed from the top nav (July 2026): the disabled
// "Bientôt" pill was eating ~160px that the search bar needs on iPad
// widths, for a link nobody could click. The news surface lives inside
// the Coin Famille; re-add a nav entry only if a standalone public
// /actualites route ships.
const navigation: NavItem[] = [
  { name: "Films", href: "/films", icon: Film },
  { name: "Séries TV", href: "/series", icon: Tv },
  { name: "Jeux Vidéo", href: "/jeux", icon: Gamepad2 },
]

const ageRanges = [
  { name: "2-4 ans", href: "/age/2-4", description: "Tout-petits" },
  { name: "5-7 ans", href: "/age/5-7", description: "Maternelle / CP" },
  { name: "8-10 ans", href: "/age/8-10", description: "Primaire" },
  { name: "11-12 ans", href: "/age/11-12", description: "Collège" },
  { name: "13-15 ans", href: "/age/13-15", description: "Adolescents" },
  { name: "16+ ans", href: "/age/16-plus", description: "Grands ados" },
]

const moreNavigation = [
  { name: "Collections", href: "/collections", icon: Bookmark },
  { name: "Notre histoire", href: "/a-propos", icon: Info },
  { name: "Notre objectif", href: "/objectif", icon: Target },
  { name: "Nos valeurs & notations", href: "/nos-valeurs", icon: Heart },
  { name: "Notre méthode", href: "/notre-methode", icon: Microscope },
  { name: "Nos guides", href: "/guides", icon: BookText },
  // Blog marked WIP until the editorial team publishes the first
  // posts — currently /blog renders an empty list which feels broken
  // to a visitor. Drop comingSoon once 3+ posts are published.
  { name: "Notre blog", href: "/blog", icon: Newspaper, comingSoon: true },
]

export function SiteHeader({ showCoinFamille = true }: { showCoinFamille?: boolean }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  // Top-nav search autocomplete — same /api/autocomplete endpoint as
  // the homepage HeroSearch, so users get dynamic suggestions instead
  // of having to press Enter / click Rechercher to see anything.
  // IMDB-style: type filter on the left, poster + year + age badge
  // per result, identical surface in nav and hero.
  const [searchType, setSearchType] = useState<"ALL" | "MOVIE" | "TV" | "GAME" | "BOOK">("ALL")
  const [showSearchTypeMenu, setShowSearchTypeMenu] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{
    id: string
    title: string
    type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
    posterUrl: string | null
    year: number | null
    ageRec: number | null
  }>>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  // Recents panel — shown on focus when query is empty/too-short.
  // Same localStorage store as HeroSearch (single source of history),
  // so a search typed in the hero shows up here too.
  const [showSearchRecents, setShowSearchRecents] = useState(false)
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchTypeMenuRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const { entries: searchRecents, add: addSearchRecent, remove: removeSearchRecent, clear: clearSearchRecents } = useRecentSearches()
  const [userAvatar, setUserAvatar] = useState<{
    style?: string | null
    seed?: string | null
    options?: Record<string, unknown> | null
  }>({})
  // Display family name ("Famille Dupont") — replaces the account name in
  // the top-right when the user has set one (profil → Modifier le profil).
  const [familyName, setFamilyName] = useState<string | null>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const p = APERCU_PALETTE

  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUserAvatar({
            style: data.user.avatarStyle,
            seed: data.user.avatarSeed,
            options: data.user.avatarOptions,
          })
          setFamilyName(typeof data.user.familyName === "string" && data.user.familyName ? data.user.familyName : null)
        }
      })
      .catch(() => {})
  }, [session?.user?.id])

  // Live update when the profile dialog saves a new family name — without
  // this the header only learned about it on the next full reload.
  useEffect(() => {
    const onProfileUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ familyName?: string | null }>).detail
      if (detail && "familyName" in detail) {
        setFamilyName(detail.familyName || null)
      }
    }
    window.addEventListener("totem:profile-updated", onProfileUpdated)
    return () => window.removeEventListener("totem:profile-updated", onProfileUpdated)
  }, [])

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isMenuOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false)
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false)
        setShowSearchRecents(false)
      }
      if (searchTypeMenuRef.current && !searchTypeMenuRef.current.contains(event.target as Node)) {
        setShowSearchTypeMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced autocomplete fetch for the top-nav search. Re-runs on
  // type change too — switching filter from "Tout" to "Films" should
  // immediately re-query without waiting for the user to retype.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (searchQuery.trim().length < 2) {
      setSearchSuggestions([])
      setShowSearchDropdown(false)
      return
    }
    setSearchLoading(true)
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: searchQuery.trim() })
        if (searchType !== "ALL") params.set("type", searchType)
        const res = await fetch(`/api/autocomplete?${params}`)
        if (res.ok) {
          const data = await res.json()
          setSearchSuggestions(data.suggestions || [])
          setShowSearchDropdown(true)
          setSearchSelectedIndex(-1)
        }
      } catch {
        // Network blip — silently degrade; user can still press Enter
        // to navigate to /recherche?q=...
      } finally {
        setSearchLoading(false)
      }
    }, 200)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery, searchType])

  const goToSuggestion = (s: { id: string; title: string }) => {
    setShowSearchDropdown(false)
    setShowSearchRecents(false)
    setSearchQuery(s.title)
    addSearchRecent({ q: s.title, href: `/media/${s.id}`, title: s.title })
    router.push(`/media/${s.id}`)
  }

  const goToSearchRecent = (entry: { q: string; href?: string }) => {
    setShowSearchDropdown(false)
    setShowSearchRecents(false)
    setSearchQuery(entry.q)
    addSearchRecent({ q: entry.q, href: entry.href })
    router.push(entry.href ?? `/recherche?q=${encodeURIComponent(entry.q)}`)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchDropdown || searchSuggestions.length === 0) return
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSearchSelectedIndex((prev) => (prev < searchSuggestions.length - 1 ? prev + 1 : prev))
        break
      case "ArrowUp":
        e.preventDefault()
        setSearchSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        if (searchSelectedIndex >= 0 && searchSelectedIndex < searchSuggestions.length) {
          e.preventDefault()
          goToSuggestion(searchSuggestions[searchSelectedIndex])
        }
        break
      case "Escape":
        setShowSearchDropdown(false)
        setSearchSelectedIndex(-1)
        break
    }
  }

  const SEARCH_TYPE_ICONS: Record<string, typeof Film> = {
    MOVIE: Film,
    TV: Tv,
    GAME: Gamepad2,
    BOOK: BookOpen,
    APP: Smartphone,
    MANGA: BookOpen,
  }
  const SEARCH_TYPE_LABELS: Record<string, string> = {
    MOVIE: "Film",
    TV: "Série",
    GAME: "Jeu",
    BOOK: "Livre",
    APP: "App",
    MANGA: "Manga",
  }
  // IMDB-style type scoping options. "Tout" = no scoping (drops the
  // ?type= param entirely). MANGA omitted intentionally — admin-only
  // during soft launch, mirrors the API's exclusion.
  const SEARCH_TYPE_FILTERS: { value: typeof searchType; label: string }[] = [
    { value: "ALL", label: "Tout" },
    { value: "MOVIE", label: "Films" },
    { value: "TV", label: "Séries" },
    { value: "GAME", label: "Jeux" },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) {
      addSearchRecent({ q })
      router.push(`/recherche?q=${encodeURIComponent(q)}`)
      setSearchQuery("")
      setShowSearchRecents(false)
    }
  }

  const isAdmin = session?.user?.role === "ADMIN"
  // L'espace de pilotage /steph est en lecture seule : il s'ouvre aussi aux
  // modérateurs, là où /admin reste strictement réservé aux administrateurs.
  const isStaff = isAdmin || session?.user?.role === "MODERATOR"

  const navLinkStyle = {
    color: p.ink,
  }
  const dropdownPanelStyle = {
    background: p.card,
    border: `1px solid ${p.line}`,
  }

  return (
    <header
      className="sticky top-0 z-50 w-full border-b backdrop-blur-md"
      style={{
        background: "var(--color-header-bg)",
        borderColor: p.line,
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-18 items-center">
          <Link
            href="/"
            className="flex items-center gap-2 group shrink-0"
            onClick={() => window.scrollTo({ top: 0 })}
          >
            <Image
              src="/logo-icon.png"
              alt="Totem Avisé"
              width={40}
              height={40}
              className="group-hover:scale-105 transition-transform duration-300"
              priority
            />
            <div className="flex items-baseline gap-1">
              <span
                className="text-xl sm:text-2xl uppercase tracking-tight"
                style={{ fontFamily: "var(--font-anton)", color: p.ink }}
              >
                Totem
              </span>
              <span
                className="text-2xl sm:text-3xl uppercase"
                style={{ fontFamily: "var(--font-edunline)", color: p.accent }}
              >
                Avisé
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex flex-1 items-center min-w-0 pl-6">
            <nav className="flex items-center space-x-0.5 xl:space-x-1">
              {navigation.map((item) =>
                item.comingSoon ? (
                  <div
                    key={item.name}
                    className="flex items-center gap-1.5 px-2.5 xl:px-3 py-2 text-sm font-medium rounded-full cursor-not-allowed opacity-60 whitespace-nowrap"
                    style={navLinkStyle}
                    title="Bientôt disponible"
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.name}
                    <span
                      className="hidden xl:inline text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1"
                      style={{ background: p.bg2, color: p.ink2 }}
                    >
                      Bientôt
                    </span>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-1.5 px-2.5 xl:px-3 py-2 text-sm font-medium rounded-full transition-colors hover:opacity-70 whitespace-nowrap"
                    style={navLinkStyle}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                ),
              )}

              {/* Coin Famille — public since July 2026. Logged-out visitors
                  are redirected to /connexion by the page itself, which then
                  guides them to create their family. Hidden entirely when the
                  kill-switch is on (showCoinFamille) so nobody lands on a 404. */}
              {showCoinFamille && (
                <Link
                  href="/coin-famille"
                  className="flex items-center gap-1.5 px-2.5 xl:px-3 py-2 text-sm font-semibold rounded-full transition-opacity hover:opacity-90 whitespace-nowrap"
                  style={{ background: p.accent, color: "#fff" }}
                >
                  <Home className="h-4 w-4 flex-shrink-0" />
                  Coin Famille
                </Link>
              )}

              <div ref={moreMenuRef} className="relative">
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 xl:px-3 py-2 text-sm font-medium rounded-full transition-colors hover:opacity-70 whitespace-nowrap"
                  style={navLinkStyle}
                >
                  Plus
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${isMoreMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isMoreMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-60 rounded-2xl shadow-xl py-2 z-50 overflow-hidden"
                    style={dropdownPanelStyle}
                  >
                    {moreNavigation.map((item) =>
                      item.comingSoon ? (
                        <div
                          key={item.name}
                          className="flex items-center justify-between px-4 py-2.5 text-sm cursor-not-allowed"
                          style={{ color: p.ink2 }}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="h-4 w-4" />
                            {item.name}
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: p.bg2, color: p.ink2 }}
                          >
                            Bientôt
                          </span>
                        </div>
                      ) : (
                        <Link
                          key={item.name}
                          href={item.href}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                          style={{ color: p.ink }}
                          onClick={() => setIsMoreMenuOpen(false)}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.name}
                        </Link>
                      )
                    )}

                    {/* Par âge — demoted from a top-level dropdown to
                        a sub-section of Plus. The 6 age routes still
                        exist; this just keeps them discoverable
                        without crowding the primary nav. */}
                    <div className="border-t my-1" style={{ borderColor: p.line }} />
                    <div
                      className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2"
                      style={{ color: p.ink2 }}
                    >
                      <Baby className="h-3 w-3" />
                      Par âge
                    </div>
                    {ageRanges.map((range) => (
                      <Link
                        key={range.href}
                        href={range.href}
                        className="flex items-center justify-between px-4 py-2 text-sm transition-colors hover:opacity-70"
                        style={{ color: p.ink }}
                        onClick={() => setIsMoreMenuOpen(false)}
                      >
                        <span className="font-medium">{range.name}</span>
                        <span className="text-xs" style={{ color: p.ink2 }}>
                          {range.description}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </nav>

            {/* Inline search only where it genuinely fits (≥xl). Below xl
                the full-width search row under the header takes over —
                min-w guarantees this pill can never again be flex-crushed
                into a fused circle next to the theme toggle (iPad bug). */}
            <form
              onSubmit={handleSearch}
              className="hidden xl:flex flex-1 items-center min-w-[180px] max-w-md ml-3"
            >
              {/* Outer wrapper anchors the absolutely-positioned
                  dropdowns. Cannot use overflow-hidden here — the
                  type-filter menu and autocomplete dropdown both
                  render below the row and would be clipped. The
                  rounded-full chrome lives on the inner row. */}
              <div ref={searchContainerRef} className="relative w-full">
                <div
                  className="flex items-stretch rounded-full"
                  style={{ background: p.card, border: `1px solid ${p.line2}` }}
                >
                  {/* IMDB-style type scoping — pre-filters
                      /api/autocomplete so the dropdown only shows
                      matching media. */}
                  <div ref={searchTypeMenuRef} className="relative flex-shrink-0 flex items-center pl-4 pr-3 border-r" style={{ borderColor: p.line }}>
                    <button
                      type="button"
                      onClick={() => setShowSearchTypeMenu((v) => !v)}
                      className="flex items-center gap-1 text-xs font-medium hover:opacity-70 transition-opacity"
                      style={{ color: p.ink2 }}
                      aria-label="Filtrer par type"
                    >
                      {SEARCH_TYPE_FILTERS.find((t) => t.value === searchType)?.label ?? "Tout"}
                      <ChevronDown className={`h-3 w-3 transition-transform ${showSearchTypeMenu ? "rotate-180" : ""}`} />
                    </button>
                    {showSearchTypeMenu && (
                      <div
                        className="absolute top-full left-0 mt-1 w-32 rounded-xl shadow-xl py-1 z-[210]"
                        style={{ background: p.card, border: `1px solid ${p.line2}` }}
                      >
                        {SEARCH_TYPE_FILTERS.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => {
                              setSearchType(t.value)
                              setShowSearchTypeMenu(false)
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:opacity-70"
                            style={{
                              color: p.ink,
                              fontWeight: searchType === t.value ? 600 : 400,
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inner wrapper for input + icons — keeps the search
                      icon naturally positioned at left-3 of the input
                      area, instead of doing absolute math against the
                      whole row. */}
                  <div className="relative flex-1 flex items-center">
                    <button
                      type="submit"
                      aria-label="Rechercher"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 rounded-full transition-opacity hover:opacity-70"
                      style={{ color: p.ink2 }}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    {searchLoading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin opacity-60" />
                    )}
                    <input
                      type="search"
                      placeholder="Rechercher..."
                      className="pl-10 pr-9 py-2 min-h-11 w-full text-sm focus:outline-none bg-transparent rounded-r-full"
                      style={{ color: p.ink }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      onFocus={() => {
                        if (searchSuggestions.length > 0 && searchQuery.trim().length >= 2) {
                          setShowSearchDropdown(true)
                        } else if (searchQuery.trim().length < 2 && searchRecents.length > 0) {
                          setShowSearchRecents(true)
                        }
                      }}
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Recents — empty/short query + we have history.
                    Same store as the homepage HeroSearch (single
                    localStorage key). */}
                {showSearchRecents && !showSearchDropdown && searchRecents.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-2xl shadow-xl z-[200] overflow-hidden"
                    style={{ background: p.card, border: `1px solid ${p.line2}` }}
                  >
                    <div
                      className="flex items-center justify-between px-3 py-2 border-b"
                      style={{ borderColor: p.line }}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: p.ink2 }}>
                        Recherches récentes
                      </span>
                      <button
                        type="button"
                        onClick={() => clearSearchRecents()}
                        className="text-[10px] hover:opacity-70 transition-opacity"
                        style={{ color: p.ink2 }}
                      >
                        Effacer tout
                      </button>
                    </div>
                    <ul className="py-1 max-h-72 overflow-y-auto">
                      {searchRecents.map((entry) => (
                        <li key={`${entry.q}:${entry.ts}`} className="group">
                          <div className="w-full flex items-center transition-colors" style={{ color: p.ink }}>
                            <button
                              type="button"
                              onClick={() => goToSearchRecent(entry)}
                              className="flex-1 px-3 py-1.5 flex items-center gap-2.5 text-left text-sm hover:opacity-70"
                            >
                              <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: p.ink2 }} />
                              <span className="truncate">{entry.q}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSearchRecent(entry.q)}
                              aria-label={`Retirer ${entry.q}`}
                              className="px-2.5 py-1.5 transition-opacity opacity-0 group-hover:opacity-100 hover:opacity-100"
                              style={{ color: p.ink2 }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Autocomplete dropdown — IMDB-style row: poster
                    thumbnail, title, year, age badge. Sits OUTSIDE
                    the rounded-full row so it isn't clipped. */}
                {showSearchDropdown && searchSuggestions.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-2xl shadow-xl z-[200] overflow-hidden"
                    style={{ background: p.card, border: `1px solid ${p.line2}` }}
                  >
                    <ul className="py-1 max-h-96 overflow-y-auto">
                      {searchSuggestions.map((s, index) => {
                        const Icon = SEARCH_TYPE_ICONS[s.type] || Film
                        return (
                          <li key={`${s.type}:${s.id}`}>
                            <button
                              type="button"
                              className="w-full px-3 py-2 flex items-center gap-3 text-left text-sm transition-colors"
                              style={{
                                color: p.ink,
                                background: index === searchSelectedIndex ? p.bg2 : "transparent",
                              }}
                              onClick={() => goToSuggestion(s)}
                              onMouseEnter={() => setSearchSelectedIndex(index)}
                            >
                              {/* Poster thumb (32×48, 2:3) — fallback
                                  to type icon when no poster exists. */}
                              <div
                                className="relative w-8 h-12 rounded overflow-hidden flex-shrink-0 flex items-center justify-center"
                                style={{ background: p.placeholder }}
                              >
                                {s.posterUrl ? (
                                  <Image
                                    src={s.posterUrl}
                                    alt={s.title}
                                    fill
                                    sizes="32px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <Icon className="h-4 w-4 opacity-40" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{s.title}</div>
                                <div className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: p.ink2 }}>
                                  <span>{SEARCH_TYPE_LABELS[s.type]}</span>
                                  {s.year && (
                                    <>
                                      <span style={{ color: p.line2 }}>·</span>
                                      <span>{s.year}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {ageBadgeLabel(s.ageRec) && (
                                <span
                                  className="text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{ background: p.bg2, color: p.ink }}
                                >
                                  {ageBadgeLabel(s.ageRec)}
                                </span>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="flex items-center space-x-3 shrink-0 ml-auto lg:ml-0">
            <ThemeToggle className="hidden sm:inline-flex" />
            {/* Auth slot — reserve the logged-out button footprint so the
                loading-skeleton → Connexion/S'inscrire swap can't reflow the
                header. This was the /inscription CLS the perf budget flagged:
                an 80px skeleton growing into ~215px of buttons after the
                session resolved (amplified under CI network throttling, where
                the skeleton lingers). No reservation when logged-in — that
                slot is the avatar, and its (unmeasured) resolve is unchanged. */}
            <div
              className={`flex items-center gap-3 justify-end ${
                session?.user ? "" : "sm:min-w-[13.75rem]"
              }`}
            >
            {status === "loading" ? (
              <div className="flex items-center gap-3" aria-hidden="true">
                <span
                  className="h-9 w-9 sm:hidden animate-pulse rounded-full"
                  style={{ background: p.placeholder }}
                />
                <span
                  className="hidden sm:block h-9 w-[104px] animate-pulse rounded-full"
                  style={{ background: p.placeholder }}
                />
                <span
                  className="hidden sm:block h-9 w-[98px] animate-pulse rounded-full"
                  style={{ background: p.placeholder }}
                />
              </div>
            ) : session?.user ? (
              <>
                <NotificationBell />
                <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-2 sm:px-3 py-2 text-sm font-medium rounded-full transition-colors hover:opacity-70"
                  style={{ color: p.ink }}
                >
                  <span
                    className="inline-flex rounded-full"
                    style={{ boxShadow: `0 0 0 2px ${p.line2}` }}
                  >
                    <MemberAvatar
                      avatarStyle={userAvatar.style}
                      avatarSeed={userAvatar.seed}
                      avatarOptions={userAvatar.options}
                      avatarEmoji={session.user.image}
                      name={session.user.name}
                      size={32}
                    />
                  </span>
                  <span className="hidden xl:inline whitespace-nowrap">
                    {familyName ? `Famille ${familyName}` : session.user.name || session.user.email?.split("@")[0]}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div
                      className="absolute right-0 mt-2 w-52 rounded-2xl shadow-xl py-2 z-50 overflow-hidden"
                      style={dropdownPanelStyle}
                    >
                      {showCoinFamille && (
                        <Link
                          href="/coin-famille"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors hover:opacity-70"
                          style={{ color: p.accent }}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Home className="h-4 w-4" />
                          Coin Famille
                        </Link>
                      )}
                      <Link
                        href="/profil"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors hover:opacity-70"
                        style={{ color: p.accent }}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <User className="h-4 w-4" />
                        Mon profil
                      </Link>
                      <hr className="my-1" style={{ borderColor: p.line }} />
                      <Link
                        href="/mes-favoris"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                        style={{ color: p.ink }}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Star className="h-4 w-4" />
                        Mes favoris
                      </Link>
                      <Link
                        href="/ma-liste"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                        style={{ color: p.ink }}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Bookmark className="h-4 w-4" />
                        Ma liste
                      </Link>
                      <Link
                        href="/profil?tab=lists#discovery"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                        style={{ color: p.ink }}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Newspaper className="h-4 w-4" />
                        À lire plus tard
                      </Link>
                      <Link
                        href="/profil"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                        style={{ color: p.ink }}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Users className="h-4 w-4" />
                        Ma famille
                      </Link>
                      {isStaff && (
                        <Link
                          href="/steph"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                          style={{ color: p.ink }}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Gauge className="h-4 w-4" />
                          Pilotage
                        </Link>
                      )}
                      {isAdmin && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                          style={{ color: p.ink }}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Settings className="h-4 w-4" />
                          Administration
                        </Link>
                      )}
                      <hr className="my-1" style={{ borderColor: p.line }} />
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false)
                          signOut({ callbackUrl: "/" })
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm w-full transition-colors hover:opacity-70"
                        style={{ color: p.accent }}
                      >
                        <LogOut className="h-4 w-4" />
                        Déconnexion
                      </button>
                    </div>
                  </>
                )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/connexion"
                  className="sm:hidden p-2 rounded-full"
                  style={{ color: p.ink }}
                  aria-label="Connexion"
                >
                  <User className="h-5 w-5" />
                </Link>
                <Link
                  href="/connexion"
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium rounded-full transition-opacity hover:opacity-70"
                  style={{
                    color: p.ink,
                    border: `1px solid ${p.line2}`,
                  }}
                >
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm font-medium rounded-full transition-opacity hover:opacity-80"
                  style={{
                    background: p.ink,
                    color: p.bg,
                  }}
                >
                  S&apos;inscrire
                </Link>
              </>
            )}
            </div>

            <button
              className="lg:hidden p-2"
              style={{ color: p.ink }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Full-width search row for every viewport that doesn't get the
            inline pill (phones, iPad portrait AND landscape). This is the
            "search is always there" guarantee: one of the two bars renders
            at every width, with no crushable in-between band. */}
        <form onSubmit={handleSearch} className="xl:hidden pb-2">
          <div className="relative">
            <button
              type="submit"
              aria-label="Rechercher"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 rounded-full transition-opacity hover:opacity-70"
              style={{ color: p.ink2 }}
            >
              <Search className="h-4 w-4" />
            </button>
            <input
              type="search"
              placeholder="Rechercher..."
              className="pl-10 pr-4 py-2 w-full rounded-full text-sm focus:outline-none"
              style={{
                background: p.card,
                border: `1px solid ${p.line2}`,
                color: p.ink,
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

        <nav className="lg:hidden flex items-center gap-1 pb-2 overflow-x-auto -mx-1 px-1">
          {showCoinFamille && (
            <Link
              href="/coin-famille"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full whitespace-nowrap"
              style={{ background: p.accent, color: "#fff", border: `1px solid ${p.accent}` }}
            >
              <Home className="h-3.5 w-3.5" />
              Coin Famille
            </Link>
          )}
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-opacity hover:opacity-70"
              style={{
                background: p.card,
                color: p.ink,
                border: `1px solid ${p.line}`,
              }}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.name}
            </Link>
          ))}
          <Link
            href="/collections"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-opacity hover:opacity-70"
            style={{
              background: p.card,
              color: p.ink,
              border: `1px solid ${p.line}`,
            }}
          >
            <Bookmark className="h-3.5 w-3.5" />
            Collections
          </Link>
        </nav>
      </div>

      {isMenuOpen && (
        <div
          className="lg:hidden border-t max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain touch-pan-y"
          style={{ background: p.bg, borderColor: p.line }}
        >
          <nav className="container mx-auto px-4 py-4 space-y-1">
            {navigation.map((item) =>
              item.comingSoon ? (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-4 py-3 rounded-lg cursor-not-allowed opacity-60"
                  style={{ color: p.ink }}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded font-medium"
                    style={{ background: p.bg2, color: p.ink2 }}
                  >
                    Bientôt
                  </span>
                </div>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: p.ink }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              ),
            )}

            <div className="pt-2 mt-2 border-t" style={{ borderColor: p.line }}>
              <p
                className="px-4 py-2 text-xs font-medium uppercase tracking-wide"
                style={{ color: p.ink2 }}
              >
                Plus
              </p>
              {moreNavigation.map((item) =>
                item.comingSoon ? (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-4 py-3 cursor-not-allowed"
                    style={{ color: p.ink2 }}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: p.bg2, color: p.ink2 }}
                    >
                      Bientôt
                    </span>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: p.ink }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )
              )}

              {/* Par âge — nested inside Plus on mobile too, mirroring
                  the desktop hierarchy. The 6 age routes still exist;
                  this just keeps them discoverable without a dedicated
                  top-nav slot. */}
              <div className="mt-2 pt-2 border-t" style={{ borderColor: p.line }}>
                <p
                  className="px-4 py-2 text-xs font-medium uppercase tracking-wide flex items-center gap-2"
                  style={{ color: p.ink2 }}
                >
                  <Baby className="h-3.5 w-3.5" />
                  Par âge
                </p>
                <div className="grid grid-cols-2 gap-1 px-2">
                  {ageRanges.map((range) => (
                    <Link
                      key={range.href}
                      href={range.href}
                      className="flex flex-col px-3 py-2.5 rounded-lg transition-opacity hover:opacity-70"
                      style={{ color: p.ink }}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="text-sm font-medium">{range.name}</span>
                      <span className="text-xs" style={{ color: p.ink2 }}>
                        {range.description}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {session?.user ? (
              <>
                <hr className="my-2" style={{ borderColor: p.line }} />
                {showCoinFamille && (
                  <Link
                    href="/coin-famille"
                    className="flex items-center gap-3 px-4 py-3 font-semibold rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: p.accent }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Home className="h-5 w-5" />
                    Coin Famille
                  </Link>
                )}
                <Link
                  href="/profil"
                  className="flex items-center gap-3 px-4 py-3 font-medium rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: p.accent }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="h-5 w-5" />
                  Mon profil
                </Link>
                <Link
                  href="/mes-favoris"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: p.ink }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Star className="h-5 w-5" />
                  Mes favoris
                </Link>
                <Link
                  href="/ma-liste"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: p.ink }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Bookmark className="h-5 w-5" />
                  Ma liste
                </Link>
                <Link
                  href="/profil?tab=lists#discovery"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: p.ink }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Newspaper className="h-5 w-5" />
                  À lire plus tard
                </Link>
                <Link
                  href="/profil"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: p.ink }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Users className="h-5 w-5" />
                  Ma famille
                </Link>
                {isStaff && (
                  <Link
                    href="/steph"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: p.ink }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Gauge className="h-5 w-5" />
                    Pilotage
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: p.ink }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Settings className="h-5 w-5" />
                    Administration
                  </Link>
                )}
                <button
                  onClick={() => {
                    setIsMenuOpen(false)
                    signOut({ callbackUrl: "/" })
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70 w-full"
                  style={{ color: p.accent }}
                >
                  <LogOut className="h-5 w-5" />
                  Déconnexion
                </button>
              </>
            ) : (
              <div className="pt-4 flex gap-3">
                <Link
                  href="/connexion"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-opacity hover:opacity-70"
                  style={{
                    color: p.ink,
                    border: `1px solid ${p.line2}`,
                  }}
                >
                  Connexion
                </Link>
                <Link
                  href="/inscription"
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-opacity hover:opacity-80"
                  style={{
                    background: p.ink,
                    color: p.bg,
                  }}
                >
                  S&apos;inscrire
                </Link>
              </div>
            )}

            {/* Theme toggle — always present at the bottom of the mobile menu */}
            <div
              className="pt-4 mt-2 border-t flex items-center justify-between"
              style={{ borderColor: p.line }}
            >
              <span className="text-sm" style={{ color: p.ink2 }}>
                Apparence
              </span>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
