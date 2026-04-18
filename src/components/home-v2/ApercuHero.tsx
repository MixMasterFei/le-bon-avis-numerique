"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { HeroSearch } from "@/components/home/HeroSearch"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import { APERCU_PALETTE } from "./apercuTheme"

interface HeroPick {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
}

interface StatsShape {
  counts: {
    movies: number
    series: number
    games: number
    families: number
    reactions: number
    reviews: number
  }
}

const TILT_STEPS = [-6, 3, 5, -3]
const POSITIONS = [
  { top: "0%", right: "22%" },
  { top: "12%", right: "48%" },
  { top: "32%", right: "4%" },
  { top: "58%", right: "38%" },
]

export function ApercuHero({ serifClass }: { serifClass: string }) {
  const [picks, setPicks] = useState<HeroPick[]>([])
  const [stats, setStats] = useState<StatsShape | null>(null)
  const p = APERCU_PALETTE

  useEffect(() => {
    fetch("/api/db/expert-picks?limit=6")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) {
          setPicks(data.items.filter((i: HeroPick) => i.posterUrl).slice(0, 4))
        }
      })
      .catch(() => {})
    fetch("/api/stats/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setStats(data))
      .catch(() => {})
  }, [])

  const totalCatalog = stats
    ? stats.counts.movies + stats.counts.series + stats.counts.games
    : null

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="container mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-7"
              style={{
                background: p.bg2,
                border: `1px solid ${p.line}`,
                color: p.ink,
              }}
            >
              <span
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] text-white"
                style={{ background: p.accent2 }}
              >
                ✦
              </span>
              Le guide indépendant des familles · sans publicité
            </div>

            <h1
              className={`${serifClass} text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-tight font-medium m-0`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Les{" "}
              <em className="italic" style={{ color: p.accent }}>
                bons contenus
              </em>
              ,
              <br />
              pour{" "}
              <span className="italic" style={{ color: p.accent2 }}>
                chaque
              </span>{" "}
              âge du foyer.
            </h1>

            <p
              className="mt-6 md:mt-7 max-w-xl text-base md:text-lg leading-relaxed"
              style={{ color: p.ink2 }}
            >
              Films, séries et jeux vidéo analysés en détail — pour des choix
              médias éclairés, adaptés aux goûts et aux sensibilités de chaque
              membre du foyer.
            </p>

            <div className="mt-8 max-w-xl relative z-30">
              <HeroSearch />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: p.ink2 }}>
                Populaire :
              </span>
              {[
                { label: "Animation", href: "/films/recherche?genres=Animation" },
                { label: "Soirée famille", href: "/films?maxAge=10" },
                { label: "Ados", href: "/films?maxAge=15" },
                { label: "Sans violence", href: "/films/recherche?maxViolence=1" },
                { label: "Écologie", href: "/films/recherche?topics=Nature" },
              ].map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  className="px-3 py-1 rounded-full text-xs hover:opacity-80 transition-opacity"
                  style={{
                    background: p.bg2,
                    border: `1px solid ${p.line}`,
                    color: p.ink2,
                  }}
                >
                  {t.label}
                </Link>
              ))}
            </div>

            {totalCatalog !== null && (
              <div
                className="mt-10 pt-7 flex flex-wrap gap-8 md:gap-10"
                style={{ borderTop: `1px solid ${p.line}` }}
              >
                <Stat
                  n={formatCount(totalCatalog)}
                  l="œuvres analysées"
                  serifClass={serifClass}
                />
                {stats && stats.counts.families > 0 && (
                  <Stat
                    n={formatCount(stats.counts.families)}
                    l="foyers actifs"
                    serifClass={serifClass}
                  />
                )}
                {stats && stats.counts.reviews > 0 && (
                  <Stat
                    n={formatCount(stats.counts.reviews)}
                    l="avis de parents"
                    accent={p.accent}
                    serifClass={serifClass}
                  />
                )}
              </div>
            )}
          </div>

          <div className="relative h-[380px] md:h-[460px] hidden md:block">
            {picks.length > 0
              ? picks.slice(0, 4).map((pick, idx) => (
                  <HeroPosterCard
                    key={pick.id}
                    pick={pick}
                    tilt={TILT_STEPS[idx] ?? 0}
                    pos={POSITIONS[idx]}
                    zIndex={10 - idx}
                    highlighted={idx === 2}
                    serifClass={serifClass}
                  />
                ))
              : Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="absolute w-[180px] aspect-[3/4] rounded-2xl animate-pulse"
                    style={{
                      ...POSITIONS[idx],
                      transform: `rotate(${TILT_STEPS[idx]}deg)`,
                      background: p.placeholder,
                    }}
                  />
                ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroPosterCard({
  pick,
  tilt,
  pos,
  zIndex,
  highlighted,
  serifClass,
}: {
  pick: HeroPick
  tilt: number
  pos: { top: string; right: string }
  zIndex: number
  highlighted: boolean
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const ageLabel =
    pick.expertAgeRec !== null ? `${pick.expertAgeRec}+` : null

  return (
    <Link
      href={`/media/${toMediaRouteId(pick.type, pick.id)}`}
      className="absolute w-[180px] block transition-transform duration-300 hover:-translate-y-1"
      style={{
        ...pos,
        zIndex,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          boxShadow: highlighted
            ? "0 24px 48px rgba(0,0,0,0.18)"
            : "0 8px 24px rgba(0,0,0,0.10)",
        }}
      >
        <div className="relative aspect-[3/4]" style={{ background: p.placeholder }}>
          {pick.posterUrl && (
            <SafeImage
              src={pick.posterUrl}
              alt={pick.title}
              fill
              className="object-cover"
              sizes="180px"
            />
          )}
          {ageLabel && (
            <div
              className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: "#B8D89A", color: "#2D3E1E" }}
            >
              {ageLabel}
            </div>
          )}
        </div>
        <div className="px-3.5 py-2.5" style={{ color: p.ink2 }}>
          <div
            className={`${serifClass} text-sm line-clamp-1`}
            style={{ color: p.ink, letterSpacing: "-0.01em" }}
          >
            {pick.title}
          </div>
          {pick.genres[0] && (
            <div className="text-[10px] mt-0.5 line-clamp-1">
              {pick.genres[0]}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

function Stat({
  n,
  l,
  accent,
  serifClass,
}: {
  n: string
  l: string
  accent?: string
  serifClass: string
}) {
  return (
    <div>
      <div
        className={`${serifClass} text-2xl md:text-3xl font-medium`}
        style={{
          letterSpacing: "-0.02em",
          color: accent ?? "inherit",
        }}
      >
        {n}
      </div>
      <div className="text-xs mt-0.5" style={{ color: "rgba(0,0,0,0.55)" }}>
        {l}
      </div>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)} ${(n % 1000).toString().padStart(3, "0")}`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`
  return String(n)
}
