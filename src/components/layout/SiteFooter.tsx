import Link from "next/link"
import Image from "next/image"

// "Mangas" intentionally omitted — admin-only until catalog quality
// passes review. Admins access /mangas via the header.
const BROWSE = [
  { name: "Films", href: "/films" },
  { name: "Séries TV", href: "/series" },
  { name: "Jeux Vidéo", href: "/jeux" },
  { name: "Livres", href: "/livres" },
]

const BY_AGE = [
  { name: "2–4 ans", href: "/age/2-4" },
  { name: "5–7 ans", href: "/age/5-7" },
  { name: "8–10 ans", href: "/age/8-10" },
  { name: "11–12 ans", href: "/age/11-12" },
  { name: "13–15 ans", href: "/age/13-15" },
  { name: "16+ ans", href: "/age/16-plus" },
]

const DISCOVER = [
  { name: "Jeux : quel âge ?", href: "/jeux/quel-age" },
  { name: "Collections thématiques", href: "/collections" },
  { name: "Recommandations", href: "/recommandations" },
  { name: "Guides parents", href: "/guides" },
  { name: "Mon espace", href: "/profil" },
]

const ABOUT = [
  { name: "Notre mission", href: "/objectif" },
  { name: "Notre méthode", href: "/notre-methode" },
  { name: "Comment ça marche", href: "/nos-valeurs" },
  { name: "Contact", href: "/contact" },
]

const COLUMNS = [
  { title: "Parcourir", items: BROWSE },
  { title: "Par âge", items: BY_AGE },
  { title: "Découvrir", items: DISCOVER },
  { title: "À propos", items: ABOUT },
]

export function SiteFooter() {
  // Footer uses hardcoded brand colors (dark band regardless of theme)
  // instead of palette tokens, so the dark-mode palette doesn't invert
  // it. Keep the dim rgba here for the secondary link colors.
  const dim = "rgba(244,239,228,0.60)"

  return (
    <footer
      // Footer stays as a fixed dark brand band in both light and dark
      // modes — prevents the inversion where p.ink (=off-white in dark)
      // would flip the footer to a light band inside a dark page.
      style={{ background: "#1E1A15", color: "#F5F1E9" }}
      className="relative"
    >
      <div className="container mx-auto px-4 md:px-8 pt-14 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 md:gap-8 lg:gap-10">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/logo-icon.png"
                alt="Totem Avisé"
                width={32}
                height={32}
                className="brightness-0 invert"
              />
              <div className="flex items-baseline gap-1">
                <span
                  className="text-lg uppercase tracking-tight"
                  style={{ fontFamily: "var(--font-anton)", color: "#F5F1E9" }}
                >
                  Totem
                </span>
                <span
                  className="text-xl uppercase"
                  style={{ fontFamily: "var(--font-edunline)", color: "#D16A4A" }}
                >
                  Avisé
                </span>
              </div>
            </Link>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: dim }}
            >
              Le guide indépendant pour chaque famille. Sans recommandation
              opaque.
            </p>
            <a
              href="mailto:contact@totemavise.com"
              className="inline-block mt-4 text-sm hover:opacity-100"
              style={{ color: dim }}
            >
              contact@totemavise.com
            </a>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3
                className="text-sm font-semibold mb-3"
                style={{
                  color: "#F5F1E9",
                  letterSpacing: "0.02em",
                  fontFamily: "var(--font-serif)",
                }}
              >
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm transition-colors hover:opacity-100"
                      style={{ color: dim }}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div
        className="border-t"
        style={{ borderColor: "rgba(244,239,228,0.08)" }}
      >
        <div
          className="container mx-auto px-4 md:px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs"
          style={{ color: "rgba(244,239,228,0.50)" }}
        >
          <p>© {new Date().getFullYear()} Totem Avisé</p>
          <div className="flex items-center gap-4">
            <Link href="/mentions-legales" className="hover:opacity-100">
              Mentions légales
            </Link>
            <span style={{ color: "rgba(244,239,228,0.30)" }}>·</span>
            <Link href="/confidentialite" className="hover:opacity-100">
              Confidentialité
            </Link>
            <span style={{ color: "rgba(244,239,228,0.30)" }}>·</span>
            <Link href="/cookies" className="hover:opacity-100">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
