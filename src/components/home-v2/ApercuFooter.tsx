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
              Le guide indépendant pour des choix médias éclairés en famille.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[
                {
                  name: "Instagram",
                  href: "https://www.instagram.com/totemavise",
                  path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
                },
                {
                  name: "TikTok",
                  href: "https://www.tiktok.com/@totemavise",
                  path: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46v-7.15a8.16 8.16 0 005.58 2.18v-3.45a4.85 4.85 0 01-1.58-.27 4.83 4.83 0 01-2.42-1.72V6.69h4z",
                },
                {
                  name: "Facebook",
                  href: "https://www.facebook.com/totemavise",
                  path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
                },
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="p-2 rounded-full transition-colors hover:opacity-100"
                  style={{
                    background: "rgba(244,239,228,0.08)",
                    color: "rgba(244,239,228,0.70)",
                  }}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
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
