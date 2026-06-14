"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { APERCU_AGE_BUCKETS, buildAgeBucketHref } from "@/components/home-v2/apercuTheme"
import { Band, Wrap, SectionHead, Em } from "./parts"

// ── Par âge ──────────────────────────────────────────────────────────
export function AgeGridRedesign() {
  const [counts, setCounts] = useState<Record<string, number | null>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const entries = await Promise.all(
        APERCU_AGE_BUCKETS.map(async (b) => {
          try {
            const params = new URLSearchParams({
              maxAge: String(b.maxAge),
              requirePoster: "true",
              language: "fr,en",
              limit: "1",
              page: "1",
            })
            for (const [k, v] of Object.entries(b.caps)) {
              if (typeof v === "number") params.set(k, String(v))
            }
            const res = await fetch(`/api/db/movies?${params}`, { cache: "force-cache" })
            if (!res.ok) return [b.key, null] as const
            const data = await res.json()
            const total =
              typeof data?.pagination?.total === "number"
                ? data.pagination.total
                : Array.isArray(data?.movies)
                  ? data.movies.length
                  : null
            return [b.key, total] as const
          } catch {
            return [b.key, null] as const
          }
        }),
      )
      if (cancelled) return
      const map: Record<string, number | null> = {}
      for (const [k, v] of entries) map[k] = v
      setCounts(map)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <Band id="par-age">
      <Wrap>
        <SectionHead
          eyebrow="Par âge"
          title={<>Adapté à <Em tone="terra">chaque</Em> étape</>}
          lead="Pas juste une étiquette d'âge. On regarde le contenu réel — pas l'année de naissance."
          action={{ label: "Toutes les tranches", href: "/films" }}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {APERCU_AGE_BUCKETS.map((b) => {
            const n = counts[b.key]
            return (
              <Link
                key={b.key}
                href={buildAgeBucketHref(b)}
                className="group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-[14px] p-[22px] transition-transform hover:-translate-y-1"
                style={{ background: b.color, color: "#1E1A15", boxShadow: "var(--shadow-sm, 0 10px 26px -22px rgba(40,28,12,.6))" }}
              >
                <span className="absolute right-[22px] top-5 text-[20px] opacity-70">→</span>
                <div className="text-[13px] font-bold uppercase tracking-[0.1em] opacity-80">{b.label} ans</div>
                <div>
                  <div className="text-[26px] font-bold leading-none" style={{ fontFamily: "var(--font-bricolage)" }}>{b.name}</div>
                  <div className="mt-2 text-[13px] opacity-80">
                    {n == null ? "…" : `${n.toLocaleString("fr-FR")} titres analysés`}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </Wrap>
    </Band>
  )
}

// ── Explorer par thème (genres) ──────────────────────────────────────
const GENRE_TILES = [
  { name: "Aventure", sub: "voyages & découvertes", color: "#E0936B", href: "/films/recherche?genres=Aventure" },
  { name: "Animation", sub: "dessins animés", color: "#F0D2B6", href: "/films/recherche?genres=Animation" },
  { name: "Fantastique", sub: "mondes enchantés", color: "#C9B6DD", href: "/films/recherche?genres=Fantastique" },
  { name: "Comédie", sub: "rires en famille", color: "#F0CE72", href: "/films/recherche?genres=Comédie" },
  { name: "Nature", sub: "animaux & planète", color: "#A9CE8A", href: "/films/recherche?topics=Nature" },
  { name: "Sci-Fi", sub: "espace & futur", color: "#86B2CC", href: "/films/recherche?genres=Science-Fiction" },
  { name: "Drame", sub: "histoires émouvantes", color: "#CE8FA8", href: "/films/recherche?genres=Drame" },
  { name: "Musique", sub: "comédies musicales", color: "#E2C49C", href: "/films/recherche?genres=Musique" },
]

export function GenresGrid() {
  return (
    <Band id="genres">
      <Wrap>
        <SectionHead eyebrow="Explorer par thème" title={<>Un <Em tone="terra">genre</Em>, une <Em tone="pine">humeur</Em>, une idée.</>} />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {GENRE_TILES.map((t) => (
            <Link
              key={t.name}
              href={t.href}
              className="group flex min-h-[152px] flex-col justify-end overflow-hidden rounded-[14px] p-[22px] transition-all hover:-translate-y-1 hover:brightness-[0.985] hover:saturate-[1.07]"
              style={{ background: t.color, color: "#2A211A", boxShadow: "var(--shadow-sm, 0 10px 26px -22px rgba(40,28,12,.6))" }}
            >
              <div className="text-[21px] font-bold leading-tight" style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.01em" }}>{t.name}</div>
              <div className="mt-1 text-[13px]" style={{ color: "rgba(38,28,16,.62)" }}>{t.sub}</div>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-bold transition-all group-hover:gap-2.5">Explorer →</div>
            </Link>
          ))}
        </div>
      </Wrap>
    </Band>
  )
}

// ── Final CTA ────────────────────────────────────────────────────────
export function FinalCTARedesign({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <Band alt id="cta">
      <Wrap className="text-center">
        <h2
          className="mx-auto max-w-[18ch] text-[clamp(30px,4.4vw,52px)] font-bold leading-[1.04]"
          style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em", color: "var(--ink)" }}
        >
          Prêts à composer votre <Em tone="terra">prochaine soirée</Em> ?
        </h2>
        <p className="mx-auto mt-4 max-w-[44ch] text-[17px]" style={{ color: "var(--ink-2)" }}>
          Gratuit et indépendant. Des analyses honnêtes, pensées pour les familles.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {isLoggedIn ? (
            <>
              <CtaLink href="/profil" primary>Mon espace</CtaLink>
              <CtaLink href="/films">Parcourir le catalogue</CtaLink>
            </>
          ) : (
            <>
              <CtaLink href="/inscription" primary>Créer ma famille gratuitement</CtaLink>
              <CtaLink href="/recherche">Découvrir sans compte</CtaLink>
            </>
          )}
        </div>
      </Wrap>
    </Band>
  )
}

function CtaLink({ href, primary, children }: { href: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full px-[26px] py-[15px] text-[16px] font-bold transition-transform active:translate-y-px"
      style={
        primary
          ? { background: "var(--terra)", color: "#fff" }
          : { background: "var(--card)", color: "var(--ink)", border: "1px solid var(--line)" }
      }
    >
      {children}
    </Link>
  )
}
