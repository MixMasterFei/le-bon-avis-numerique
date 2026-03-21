"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Search, Menu, X, Film, Tv, Gamepad2, BookOpen, User, LogOut, Settings, ChevronDown, Info, Target, Heart, BookText, Newspaper, Baby, Star, Bookmark, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MemberAvatar } from "@/components/ui/MemberAvatar"

const navigation = [
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
  { name: "Nos guides", href: "/guides", icon: BookText },
  { name: "BD", href: "/bd", icon: BookOpen, comingSoon: true },
  { name: "Notre blog", href: "/blog", icon: Newspaper, comingSoon: true },
]

export function Header() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [isAgeMenuOpen, setIsAgeMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [userAvatar, setUserAvatar] = useState<{ style?: string | null; seed?: string | null; options?: Record<string, unknown> | null }>({})
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const ageMenuRef = useRef<HTMLDivElement>(null)

  // Fetch user avatar from DB
  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/user/profile")
      .then((r) => r.ok ? r.json() : null)
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isMenuOpen])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false)
      }
      if (ageMenuRef.current && !ageMenuRef.current.contains(event.target as Node)) {
        setIsAgeMenuOpen(false)
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e)
    }
  }

  const isAdmin = session?.user?.role === "ADMIN"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto px-4">
        <div className="flex h-18 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0" onClick={() => window.scrollTo({ top: 0 })}>
            <Image
              src="/logo-icon.png"
              alt="Totem Avisé"
              width={40}
              height={40}
              className="group-hover:scale-105 transition-transform duration-300"
              priority
            />
            <div className="flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl uppercase tracking-tight text-gray-900" style={{ fontFamily: "var(--font-anton)" }}>Totem</span>
              <span className="text-2xl sm:text-3xl uppercase text-gray-900" style={{ fontFamily: "var(--font-edunline)" }}>Avisé</span>
            </div>
          </Link>

          {/* Center: Nav + Search */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
          <nav className="flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200 hover:shadow-sm"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}

            {/* Par âge Dropdown */}
            <div ref={ageMenuRef} className="relative">
              <button
                onClick={() => setIsAgeMenuOpen(!isAgeMenuOpen)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                <Baby className="h-4 w-4" />
                Par âge
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isAgeMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {isAgeMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 overflow-hidden">
                  {ageRanges.map((range) => (
                    <Link
                      key={range.href}
                      href={range.href}
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-violet-700 transition-colors"
                      onClick={() => setIsAgeMenuOpen(false)}
                    >
                      <span className="font-medium">{range.name}</span>
                      <span className="text-xs text-gray-500">{range.description}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* More Dropdown */}
            <div ref={moreMenuRef} className="relative">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
              >
                Plus
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isMoreMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 overflow-hidden">
                  {moreNavigation.map((item) =>
                    item.comingSoon ? (
                      <div
                        key={item.name}
                        className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" />
                          {item.name}
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                          Bientôt
                        </span>
                      </div>
                    ) : (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-violet-700 transition-colors"
                        onClick={() => setIsMoreMenuOpen(false)}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          </nav>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center max-w-sm ml-4">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Rechercher un film, une série, un jeu..."
                className="pl-11 pr-4 bg-gray-50 border-gray-200 focus:bg-white focus:border-primary focus:ring-primary/20 rounded-full transition-all duration-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </form>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3 shrink-0">
            {status === "loading" ? (
              <div className="h-8 w-8 sm:w-20 bg-gray-100 animate-pulse rounded-full" />
            ) : session?.user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-2 sm:px-3 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
                >
                  <MemberAvatar
                    avatarStyle={userAvatar.style}
                    avatarSeed={userAvatar.seed}
                    avatarOptions={userAvatar.options}
                    avatarEmoji={session.user.image}
                    name={session.user.name}
                    size={32}
                    className="ring-2 ring-gray-200"
                  />
                  <span className="hidden sm:inline">
                    {session.user.name || session.user.email?.split("@")[0]}
                  </span>
                </button>

                {/* User Dropdown */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50 overflow-hidden">
                      <Link
                        href="/profil"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-gray-50 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <User className="h-4 w-4" />
                        Mon profil
                      </Link>
                      <hr className="my-1 border-gray-200" />
                      <Link
                        href="/mes-favoris"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-violet-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Star className="h-4 w-4" />
                        Mes favoris
                      </Link>
                      <Link
                        href="/ma-liste"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-violet-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Bookmark className="h-4 w-4" />
                        Ma liste
                      </Link>
                      <Link
                        href="/profil"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-violet-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Users className="h-4 w-4" />
                        Ma famille
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin/import"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-violet-700 transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <Settings className="h-4 w-4" />
                          Administration
                        </Link>
                      )}
                      <hr className="my-1 border-gray-200" />
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false)
                          signOut({ callbackUrl: "/" })
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 w-full transition-colors"
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
                <Button variant="ghost" size="sm" className="sm:hidden p-2 rounded-full" asChild>
                  <Link href="/connexion">
                    <User className="h-5 w-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="hidden sm:inline-flex rounded-full" asChild>
                  <Link href="/connexion">Connexion</Link>
                </Button>
                <Button size="sm" className="hidden sm:inline-flex rounded-full shadow-md transition-all duration-300" asChild>
                  <Link href="/inscription">S&apos;inscrire</Link>
                </Button>
              </>
            )}

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-gray-600 hover:text-primary"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <form onSubmit={handleSearch} className="md:hidden pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Rechercher..."
              className="pl-10 pr-4 bg-gray-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

        {/* Mobile Category Row */}
        <nav className="lg:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors whitespace-nowrap"
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.name}
            </Link>
          ))}
          <Link
            href="/collections"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors whitespace-nowrap"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Collections
          </Link>
        </nav>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="lg:hidden border-t bg-white max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain touch-pan-y">
          <nav className="container mx-auto px-4 py-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}

            {/* Par âge section in mobile */}
            <div className="pt-2 mt-2 border-t">
              <p className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Par âge</p>
              <div className="grid grid-cols-2 gap-1 px-2">
                {ageRanges.map((range) => (
                  <Link
                    key={range.href}
                    href={range.href}
                    className="flex flex-col px-3 py-2.5 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="text-sm font-medium">{range.name}</span>
                    <span className="text-xs text-gray-500">{range.description}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* More section in mobile */}
            <div className="pt-2 mt-2 border-t">
              <p className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Plus</p>
              {moreNavigation.map((item) =>
                item.comingSoon ? (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-4 py-3 text-gray-500 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      Bientôt
                    </span>
                  </div>
                ) : (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )
              )}
            </div>

            {session?.user ? (
              <>
                <hr className="my-2" />
                <Link
                  href="/profil"
                  className="flex items-center gap-3 px-4 py-3 font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="h-5 w-5" />
                  Mon profil
                </Link>
                <Link
                  href="/mes-favoris"
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Star className="h-5 w-5" />
                  Mes favoris
                </Link>
                <Link
                  href="/ma-liste"
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Bookmark className="h-5 w-5" />
                  Ma liste
                </Link>
                <Link
                  href="/profil"
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Users className="h-5 w-5" />
                  Ma famille
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin/import"
                    className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
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
                  className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full"
                >
                  <LogOut className="h-5 w-5" />
                  Déconnexion
                </button>
              </>
            ) : (
              <div className="pt-4 flex gap-3">
                <Button variant="outline" className="flex-1" asChild>
                  <Link href="/connexion">Connexion</Link>
                </Button>
                <Button className="flex-1" asChild>
                  <Link href="/inscription">S&apos;inscrire</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
