import Link from "next/link"
import Image from "next/image"
import { Film, Tv, Gamepad2, BookOpen } from "lucide-react"

const browse = [
  { name: "Films", href: "/films", icon: Film },
  { name: "Séries TV", href: "/series", icon: Tv },
  { name: "Jeux Vidéo", href: "/jeux", icon: Gamepad2 },
  { name: "Livres", href: "/livres", icon: BookOpen },
]

const byAge = [
  { name: "2-4 ans", href: "/age/2-4" },
  { name: "5-7 ans", href: "/age/5-7" },
  { name: "8-10 ans", href: "/age/8-10" },
  { name: "11-12 ans", href: "/age/11-12" },
  { name: "13-15 ans", href: "/age/13-15" },
  { name: "16+ ans", href: "/age/16-plus" },
]

const discover = [
  { name: "Collections thématiques", href: "/collections" },
  { name: "Recommandations", href: "/recommandations" },
  { name: "Guides parents", href: "/guides" },
  { name: "En ce moment chez vous", href: "/chez-vous" },
]

const about = [
  { name: "Notre mission", href: "/objectif" },
  { name: "Nos valeurs", href: "/nos-valeurs" },
  { name: "À propos", href: "/a-propos" },
  { name: "Contact", href: "/contact" },
]

export function Footer() {
  return (
    <footer className="bg-gradient-to-br from-gray-900 via-violet-950 to-gray-900 text-gray-300 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl" />

      {/* Main Footer */}
      <div className="container mx-auto px-4 pt-14 pb-10 relative">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 mb-4 lg:mb-0">
            <Link href="/" className="flex items-center gap-2 mb-5">
              <Image
                src="/logo-icon.png"
                alt="Totem Avisé"
                width={36}
                height={36}
                className="brightness-0 invert"
              />
              <div className="flex items-baseline gap-1">
                <span className="text-lg uppercase tracking-tight text-white" style={{ fontFamily: "var(--font-anton)" }}>Totem</span>
                <span className="text-xl uppercase text-violet-300" style={{ fontFamily: "var(--font-edunline)" }}>Avisé</span>
              </div>
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
              Le guide indépendant pour aider les familles françaises à choisir les meilleurs médias pour leurs enfants.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Parcourir</h3>
            <ul className="space-y-2.5">
              {browse.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-violet-300 transition-colors group"
                  >
                    <item.icon className="h-3.5 w-3.5 text-gray-500 group-hover:text-violet-400 transition-colors" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* By Age */}
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Par Âge</h3>
            <ul className="space-y-2.5">
              {byAge.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-pink-300 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Discover */}
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Découvrir</h3>
            <ul className="space-y-2.5">
              {discover.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-violet-300 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Qui sommes-nous</h3>
            <ul className="space-y-2.5">
              {about.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-violet-300 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/5 relative">
        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Totem Avisé
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <Link href="/mentions-legales" className="hover:text-gray-300 transition-colors">
                Mentions légales
              </Link>
              <span className="text-gray-700">·</span>
              <Link href="/confidentialite" className="hover:text-gray-300 transition-colors">
                Confidentialité
              </Link>
              <span className="text-gray-700">·</span>
              <Link href="/cookies" className="hover:text-gray-300 transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

