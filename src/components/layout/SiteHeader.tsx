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
  Baby,
  Star,
  Bookmark,
  Users,
} from "lucide-react"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

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
// Actualités is WIP — the news vertical (/apercudecouverte-v3) is
// being polished. Drop the comingSoon flag and update href to the
// public route once the cron is stable and quality is judged ready.
const navigation: NavItem[] = [
  { name: "Films", href: "/films", icon: Film },
  { name: "Séries TV", href: "/series", icon: Tv },
  { name: "Jeux Vidéo", href: "/jeux", icon: Gamepad2 },
  { name: "Actualités", href: "/actualites", icon: Newspaper, comingSoon: true },
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
  { name: "Nos guides", href: "/guides", icon: BookText },
  { name: "BD", href: "/bd", icon: BookOpen, comingSoon: true },
  // Blog marked WIP until the editorial team publishes the first
  // posts — currently /blog renders an empty list which feels broken
  // to a visitor. Drop comingSoon once 3+ posts are published.
  { name: "Notre blog", href: "/blog", icon: Newspaper, comingSoon: true },
]

export function SiteHeader() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [userAvatar, setUserAvatar] = useState<{
    style?: string | null
    seed?: string | null
    options?: Record<string, unknown> | null
  }>({})
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
        }
      })
      .catch(() => {})
  }, [session?.user?.id])

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
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(searchQuery)}`)
      setSearchQuery("")
    }
  }

  const isAdmin = session?.user?.role === "ADMIN"

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

          <div className="hidden lg:flex flex-1 items-center justify-center">
            <nav className="flex items-center space-x-1">
              {navigation.map((item) =>
                item.comingSoon ? (
                  <div
                    key={item.name}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full cursor-not-allowed opacity-60"
                    style={navLinkStyle}
                    title="Bientôt disponible"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-1"
                      style={{ background: p.bg2, color: p.ink2 }}
                    >
                      Bientôt
                    </span>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors hover:opacity-70"
                    style={navLinkStyle}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                ),
              )}

              <div ref={moreMenuRef} className="relative">
                <button
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors hover:opacity-70"
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

            <form
              onSubmit={handleSearch}
              className="hidden md:flex items-center max-w-sm ml-4"
            >
              <div className="relative w-full">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: p.ink2 }}
                />
                <input
                  type="search"
                  placeholder="Rechercher un film, une série, un jeu..."
                  className="pl-11 pr-4 py-2 w-full rounded-full text-sm focus:outline-none transition-colors"
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
          </div>

          <div className="flex items-center space-x-3 shrink-0 ml-auto lg:ml-0">
            <ThemeToggle className="hidden sm:inline-flex" />
            {status === "loading" ? (
              <div
                className="h-8 w-8 sm:w-20 animate-pulse rounded-full"
                style={{ background: p.placeholder }}
              />
            ) : session?.user ? (
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
                  <span className="hidden sm:inline">
                    {session.user.name || session.user.email?.split("@")[0]}
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
                        href="/profil"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:opacity-70"
                        style={{ color: p.ink }}
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Users className="h-4 w-4" />
                        Ma famille
                      </Link>
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

        <form onSubmit={handleSearch} className="md:hidden pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: p.ink2 }}
            />
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
                  href="/profil"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-opacity hover:opacity-70"
                  style={{ color: p.ink }}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Users className="h-5 w-5" />
                  Ma famille
                </Link>
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
