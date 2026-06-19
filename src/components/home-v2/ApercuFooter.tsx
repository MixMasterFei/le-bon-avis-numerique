"use client"

import Link from "next/link"
import Image from "next/image"
import { APERCU_PALETTE } from "./apercuTheme"

const BROWSE = [
  { name: "Films", href: "/films" },
  { name: "Séries TV", href: "/series" },
  { name: "Jeux Vidéo", href: "/jeux" },
]

const BY_AGE = [
  { name: "2–4 ans", href: "/films?maxAge=4" },
  { name: "5–7 ans", href: "/films?maxAge=7" },
  { name: "8–10 ans", href: "/films?maxAge=10" },
  { name: "11–12 ans", href: "/films?maxAge=12" },
  { name: "13–15 ans", href: "/films?maxAge=15" },
  { name: "16+ ans", href: "/films?maxAge=99" },
]

const DISCOVER = [
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

export function ApercuFooter({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE

  return (
    <footer
      data-apercu-footer
      style={{ background: p.ink, color: p.bg }}
      className="relative"
    >
      <div className="container mx-auto px-4 md:px-8 pt-14 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10">
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
                  style={{ fontFamily: "var(--font-anton)", color: p.bg }}
                >
                  Totem
                </span>
                <span
                  className="text-xl uppercase"
                  style={{ fontFamily: "var(--font-edunline)", color: p.accent }}
                >
                  Avisé
                </span>
              </div>
            </Link>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: "rgba(244,239,228,0.60)" }}
            >
              Le guide indépendant pour chaque famille. Sans recommandation
              opaque.
            </p>
            <a
              href="mailto:contact@totemavise.com"
              className="inline-block mt-4 text-sm hover:opacity-100"
              style={{ color: "rgba(244,239,228,0.60)" }}
            >
              contact@totemavise.com
            </a>
          </div>

          {[
            { title: "Parcourir", items: BROWSE },
            { title: "Par âge", items: BY_AGE },
            { title: "Découvrir", items: DISCOVER },
            { title: "À propos", items: ABOUT },
          ].map((col) => (
            <div key={col.title}>
              <h3
                className={`${serifClass} text-sm font-semibold mb-3`}
                style={{ color: p.bg, letterSpacing: "0.02em" }}
              >
                {col.title}
              </h3>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-sm transition-colors hover:opacity-100"
                      style={{ color: "rgba(244,239,228,0.60)" }}
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
        <div className="container mx-auto px-4 md:px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs" style={{ color: "rgba(244,239,228,0.50)" }}>
          <p suppressHydrationWarning>© {new Date().getFullYear()} Totem Avisé</p>
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
