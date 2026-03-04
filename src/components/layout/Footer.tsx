import Link from "next/link"
import Image from "next/image"
import { Film, Tv, Gamepad2, BookOpen, Mail } from "lucide-react"

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
  { name: "Mon espace", href: "/profil" },
]

const about = [
  { name: "Notre mission", href: "/objectif" },
  { name: "Comment ça marche", href: "/nos-valeurs" },
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
              Trouvez les films, séries et jeux parfaits pour chaque membre de votre famille.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://www.instagram.com/totemavise"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-pink-400 transition-colors"
                aria-label="Instagram"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a
                href="https://www.tiktok.com/@totemavise"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label="TikTok"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46v-7.15a8.16 8.16 0 005.58 2.18v-3.45a4.85 4.85 0 01-1.58-.27 4.83 4.83 0 01-2.42-1.72V6.69h4z"/></svg>
              </a>
              <a
                href="https://www.facebook.com/totemavise"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-colors"
                aria-label="Facebook"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
            </div>
            <a
              href="mailto:contact@totemavise.com"
              className="inline-flex items-center gap-2 mt-3 text-sm text-gray-400 hover:text-violet-300 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              contact@totemavise.com
            </a>
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

