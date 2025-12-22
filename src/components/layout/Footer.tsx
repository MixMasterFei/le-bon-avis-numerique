import Link from "next/link"
import Image from "next/image"
import { Film, Tv, Gamepad2, BookOpen, Smartphone, Heart } from "lucide-react"

const categories = [
  { name: "Films", href: "/films", icon: Film },
  { name: "Séries TV", href: "/series", icon: Tv },
  { name: "Jeux Vidéo", href: "/jeux", icon: Gamepad2 },
  { name: "Livres", href: "/livres", icon: BookOpen },
  { name: "Applications", href: "/apps", icon: Smartphone },
]

const ages = [
  { name: "2-4 ans", href: "/age/2-4" },
  { name: "5-7 ans", href: "/age/5-7" },
  { name: "8-9 ans", href: "/age/8-9" },
  { name: "10-12 ans", href: "/age/10-12" },
  { name: "13+ ans", href: "/age/13-plus" },
]

const legal = [
  { name: "Mentions Légales", href: "/mentions-legales" },
  { name: "Politique de Confidentialité", href: "/confidentialite" },
  { name: "Gestion des Cookies", href: "/cookies" },
  { name: "Contact", href: "/contact" },
]

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-700 text-white font-bold text-lg">
                BA
              </div>
              <div>
                <span className="text-lg font-bold text-white">Le Bon Avis</span>
                <span className="text-lg font-light text-gray-400"> Numérique</span>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Aider les parents à faire les meilleurs choix médias pour leurs enfants grâce à des critiques indépendantes et des recommandations par âge.
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Le Bon Avis Numérique - Le guide média pour les familles françaises.
            </p>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <Image
                  src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                  alt="TMDB Logo"
                  width={100}
                  height={10}
                  className="h-2.5 w-auto"
                />
              </a>
              <a
                href="https://www.igdb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Données jeux: IGDB
              </a>
              <a
                href="https://books.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Données livres: Google Books
              </a>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Ce produit utilise les APIs TMDB, IGDB et Google Books mais n&apos;est pas affilié à ces services.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-white font-semibold mb-4">Catégories</h3>
            <ul className="space-y-2">
              {categories.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Age Groups */}
          <div>
            <h3 className="text-white font-semibold mb-4">Par Âge</h3>
            <ul className="space-y-2">
              {ages.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Informations</h3>
            <ul className="space-y-2">
              {legal.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
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
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Le Bon Avis Numérique. Tous droits réservés.
            </p>
            <div className="flex items-center gap-4">
              <p className="flex items-center gap-1 text-sm text-gray-500">
                Fait avec <Heart className="h-4 w-4 text-red-500 fill-red-500" /> pour les familles francophones
              </p>
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="h-4 w-auto" viewBox="0 0 185 133" fill="currentColor">
                  <path d="M51.77 112.5c0 5.385-4.388 9.75-9.8 9.75H9.8c-5.412 0-9.8-4.365-9.8-9.75V20.25C0 14.865 4.388 10.5 9.8 10.5h32.17c5.412 0 9.8 4.365 9.8 9.75v92.25zM9.8 17.25c-1.65 0-2.995 1.343-2.995 2.99v92.27c0 1.65 1.345 2.99 2.995 2.99h32.17c1.65 0 2.995-1.34 2.995-2.99V20.24c0-1.647-1.345-2.99-2.995-2.99H9.8z"/>
                  <path d="M25.885 43.5c-9.35 0-16.96 7.574-16.96 16.875S16.536 77.25 25.885 77.25c9.35 0 16.96-7.574 16.96-16.875S35.234 43.5 25.885 43.5zm0 27c-5.59 0-10.135-4.523-10.135-10.125s4.544-10.125 10.135-10.125c5.59 0 10.135 4.523 10.135 10.125S31.476 70.5 25.885 70.5z"/>
                </svg>
                Données TMDB
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

