"use client"

import Link from "next/link"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Search, Menu, X, Film, Tv, Gamepad2, BookOpen, User, LogOut, Settings, ChevronDown, Info, Target, Heart, BookText, Newspaper, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const navigation = [
  { name: "Films", href: "/films", icon: Film },
  { name: "Jeux Vidéo", href: "/jeux", icon: Gamepad2 },
  { name: "Séries TV", href: "/series", icon: Tv },
  { name: "BD", href: "/bd", icon: BookOpen, comingSoon: true },
]

const moreNavigation = [
  { name: "Notre histoire", href: "/a-propos", icon: Info },
  { name: "Notre objectif", href: "/objectif", icon: Target },
  { name: "Nos valeurs & notations", href: "/nos-valeurs", icon: Heart },
  { name: "Nos guides", href: "/guides", icon: BookText, comingSoon: true },
  { name: "Notre blog", href: "/blog", icon: Newspaper, comingSoon: true },
]

export function Header() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const moreMenuRef = useRef<HTMLDivElement>(null)

  // Close more menu when clicking outside
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(e)
    }
  }

  const isAdmin = session?.user?.role === "ADMIN"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto px-4">
        <div className="flex h-18 items-center justify-between">
          {/* Logo - Bold asymmetric design */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl rounded-br-sm bg-primary text-white font-black text-lg shadow-md group-hover:scale-105 transition-all duration-300">
              BA
            </div>
            <div className="hidden sm:block">
              <span className="text-xl font-black text-gray-900">Le Bon Avis</span>
              <span className="text-xl font-light text-gray-400"> Numérique</span>
            </div>
          </Link>

          {/* Desktop Navigation - Playful pill design */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navigation.map((item) =>
              item.comingSoon ? (
                <div
                  key={item.name}
                  className="relative group"
                >
                  <span className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </span>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                    Bientôt disponible
                  </div>
                </div>
              ) : (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200 hover:shadow-sm"
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            )}

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
                        className="flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed"
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

          {/* Search Bar - Distinctive rounded design */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-md mx-6">
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

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            {status === "loading" ? (
              <div className="h-8 w-20 bg-gray-100 animate-pulse rounded-full" />
            ) : session?.user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="h-8 w-8 rounded-full ring-2 ring-gray-200"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-md">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
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
                        href="/chez-vous"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-gray-50 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <Home className="h-4 w-4" />
                        Chez vous
                      </Link>
                      <hr className="my-1 border-gray-200" />
                      <Link
                        href="/profil"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-violet-700 transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <User className="h-4 w-4" />
                        Mon profil
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
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <form onSubmit={handleSearch} className="md:hidden pb-3">
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
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="lg:hidden border-t bg-white">
          <nav className="container mx-auto px-4 py-4 space-y-1">
            {navigation.map((item) =>
              item.comingSoon ? (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-4 py-3 text-gray-400 cursor-not-allowed"
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

            {/* More section in mobile */}
            <div className="pt-2 mt-2 border-t">
              <p className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Plus</p>
              {moreNavigation.map((item) =>
                item.comingSoon ? (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-4 py-3 text-gray-400 cursor-not-allowed"
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
                  href="/chez-vous"
                  className="flex items-center gap-3 px-4 py-3 font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Home className="h-5 w-5" />
                  Chez vous
                </Link>
                <Link
                  href="/profil"
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="h-5 w-5" />
                  Mon profil
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
                  Deconnexion
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
