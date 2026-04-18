"use client"

import Link from "next/link"
import { APERCU_PALETTE } from "./apercuTheme"

// Warm palette tones — all drawn from the age-grid family so the whole
// page stays in a single chromatic universe. Theme tiles filter by
// genre only: a user clicking "Comédie" or "Aventure" wants the full
// catalog of that genre, not a pre-filtered subset. Age caps belong
// on the age tiles, not here.
const THEMES = [
  { title: "Aventure", sub: "voyages & découvertes", color: "#E8A87C", href: "/films/recherche?genres=Aventure" },
  { title: "Animation", sub: "dessins animés", color: "#F4C7A6", href: "/films/recherche?genres=Animation" },
  { title: "Fantastique", sub: "mondes enchantés", color: "#C9B7D9", href: "/films/recherche?genres=Fantastique" },
  { title: "Comédie", sub: "rires en famille", color: "#F8D775", href: "/films/recherche?genres=Comédie" },
  { title: "Nature", sub: "animaux & planète", color: "#B8D89A", href: "/films/recherche?topics=Nature" },
  { title: "Sci-Fi", sub: "espace & futur", color: "#8DBDC9", href: "/films/recherche?genres=Science-Fiction" },
  { title: "Drame", sub: "histoires émouvantes", color: "#D89AB0", href: "/films/recherche?genres=Drame" },
  { title: "Musique", sub: "comédies musicales", color: "#E9C7A1", href: "/films/recherche?genres=Musique" },
]

export function ApercuCollections({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <div>
      <div className="text-center mb-8">
        <div
          className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
          style={{ color: p.accent }}
        >
          Explorer par thème
        </div>
        <h2
          className={`${serifClass} text-2xl md:text-4xl font-medium m-0 leading-[1.05]`}
          style={{ letterSpacing: "-0.02em", color: p.ink }}
        >
          Un{" "}
          <em className="italic" style={{ color: p.accent }}>
            genre
          </em>
          , une{" "}
          <em className="italic" style={{ color: p.accent2 }}>
            humeur
          </em>
          , une idée.
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {THEMES.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className="group rounded-2xl px-5 py-6 md:px-6 md:py-7 min-h-[140px] md:min-h-[160px] flex flex-col justify-end transition-all hover:-translate-y-1"
            style={{ background: t.color, color: p.ink }}
          >
            <div
              className={`${serifClass} text-xl md:text-2xl font-semibold leading-none`}
              style={{ letterSpacing: "-0.02em" }}
            >
              {t.title}
            </div>
            <div className="text-xs mt-1 opacity-70">{t.sub}</div>
            <div className="text-[11px] mt-3 font-semibold opacity-80">
              Explorer →
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
