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

// Editorial tone labels rotate per card index so the showcase stays coherent
// even when the underlying films change. Values are drawn from the site's
// real enrichment vocabulary (tone tags).
const CARD_LABELS = ["Tout doux", "Coup de cœur", "Fait rêver", "Aventureux", "Émouvant"]

const CARD_WIDTH = 170 // px
const CARD_HEIGHT = Math.round((CARD_WIDTH * 4) / 3) // 227px — aspect 3:4

// Five-card "snapshot on a table" arrangement following a 3+2 brick
// stagger: top row drifts down-right, bottom row tucks between the
// top-row gaps. Horizontal steps (180px) are wider than the card
// (170px) so same-row neighbors don't pile up — the layered feel
// comes from the vertical overlap between rows, not from horizontal
// crowding. Rotations alternate sign and stay in the ±4° range.
// Z-order = DOM order (focal card reads forward via deeper shadow).
const CARDS = [
  { top: 0,   left: 0,   tilt: -3 },
  { top: 30,  left: 180, tilt:  4 }, // focal
  { top: 70,  left: 360, tilt: -2 },
  { top: 180, left: 90,  tilt:  3 },
  { top: 200, left: 270, tilt: -4 },
]
const HIGHLIGHT_SHADOW = "0 24px 48px rgba(0,0,0,0.18)"
const DEFAULT_SHADOW = "0 6px 16px rgba(0,0,0,0.10)"

// Stage height = bottom card's top + card height, with a little slack.
const STAGE_HEIGHT = Math.max(...CARDS.map((c) => c.top)) + CARD_HEIGHT + 20

export function ApercuHero({
  serifClass,
}: {
  serifClass: string
  isLoggedIn?: boolean
}) {
  const [picks, setPicks] = useState<HeroPick[]>([])
  const [stats, setStats] = useState<StatsShape | null>(null)
  const p = APERCU_PALETTE

  useEffect(() => {
    fetch("/api/db/expert-picks?limit=8")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data?.items)) {
          setPicks(data.items.filter((i: HeroPick) => i.posterUrl).slice(0, 5))
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
      // overflow-x-clip (not overflow-hidden) so the search autocomplete
      // dropdown can extend vertically past the section's bottom edge.
      // Horizontal clipping is preserved for the decorative card stack
      // that bleeds slightly outside the right edge.
      className="relative overflow-x-clip"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="container mx-auto px-4 md:px-8 pt-4 md:pt-6 pb-10 md:pb-14">
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
              Indépendant · pensé pour les familles
            </div>

            <h1
              className={`${serifClass} text-4xl md:text-5xl lg:text-6xl leading-[1.02] tracking-tight font-medium m-0`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Trouvez les{" "}
              <em className="italic" style={{ color: p.accent }}>
                bons contenus
              </em>
              ,
              <br />
              pour{" "}
              <span className="italic" style={{ color: p.accent2 }}>
                votre famille
              </span>
              .
            </h1>

            <p
              className="mt-6 md:mt-7 max-w-xl text-base md:text-lg leading-relaxed"
              style={{ color: p.ink2 }}
            >
              Une famille, des goûts, des repères sur-mesure.
              <br />
              Créez votre compte en 1 minute.
            </p>

            <div className="mt-8 max-w-xl relative z-30">
              <HeroSearch submitClassName="!bg-[#1E1A15] !text-white hover:!bg-[#2B2620]" />
            </div>

            {/* The "Populaire :" pill row that used to live here was a
                duplicate of the row inside HeroSearch — same intent,
                competing for attention, and rendered immediately
                below the in-component pills. Removed for visual
                clarity; HeroSearch's own pills are the single source. */}

          </div>

          <div
            className="relative hidden md:block mx-auto"
            style={{ height: STAGE_HEIGHT, width: CARDS[2].left + CARD_WIDTH }}
          >
            {picks.length > 0
              ? picks.slice(0, 5).map((pick, idx) => {
                  const c = CARDS[idx]
                  return (
                    <HeroPosterCard
                      key={pick.id}
                      pick={pick}
                      tilt={c.tilt}
                      top={c.top}
                      left={c.left}
                      shadow={idx === 1 ? HIGHLIGHT_SHADOW : DEFAULT_SHADOW}
                      highlighted={idx === 1}
                      label={CARD_LABELS[idx]}
                      serifClass={serifClass}
                    />
                  )
                })
              : CARDS.map((c, idx) => (
                  <div
                    key={idx}
                    className="absolute rounded-2xl animate-pulse"
                    style={{
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                      top: c.top,
                      left: c.left,
                      transform: `rotate(${c.tilt}deg)`,
                      background: p.placeholder,
                    }}
                  />
                ))}

            {totalCatalog !== null && (
              <HeroStatsBadge
                totalCatalog={totalCatalog}
                serifClass={serifClass}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroPosterCard({
  pick,
  tilt,
  top,
  left,
  shadow,
  highlighted,
  label,
  serifClass,
}: {
  pick: HeroPick
  tilt: number
  top: number
  left: number
  shadow: string
  highlighted: boolean
  label: string
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const ageLabel =
    pick.expertAgeRec !== null ? `${pick.expertAgeRec}+` : null

  return (
    <Link
      href={`/media/${toMediaRouteId(pick.type, pick.id)}`}
      className="absolute block transition-transform duration-300 hover:-translate-y-1"
      style={{
        width: CARD_WIDTH,
        top,
        left,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          boxShadow: shadow,
        }}
      >
        <div className="relative aspect-[3/4]" style={{ background: p.placeholder }}>
          {pick.posterUrl && (
            <SafeImage
              src={pick.posterUrl}
              alt={pick.title}
              fill
              className="object-cover"
              sizes={`${CARD_WIDTH}px`}
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
          <div
            className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: highlighted ? p.accent : p.card,
              color: highlighted ? "#fff" : p.ink,
              border: highlighted ? "none" : `1px solid ${p.line2}`,
            }}
          >
            {label}
          </div>
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

/**
 * Small floating pill overlaid on the card stage — replaces what used to
 * be a bottom-of-hero stats row. Sells catalog depth at a glance and
 * reclaims the vertical space.
 */
function HeroStatsBadge({
  totalCatalog,
  serifClass,
}: {
  totalCatalog: number
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <div
      className="absolute z-30 flex items-center gap-3 px-4 py-2.5 rounded-full"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        boxShadow: "0 14px 32px rgba(0,0,0,0.10)",
        left: -16,
        bottom: 12,
      }}
    >
      <span
        className="inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] flex-shrink-0"
        style={{ background: p.accent2, color: "#fff", fontWeight: 600 }}
      >
        ✦
      </span>
      <div
        className="text-[12px] leading-tight whitespace-nowrap"
        style={{ color: p.ink }}
      >
        <strong className={serifClass} style={{ fontWeight: 600 }}>
          {formatCount(totalCatalog)}
        </strong>{" "}
        œuvres{" "}
        <span style={{ color: p.ink2 }}>·</span>{" "}
        <strong style={{ color: p.accent, fontWeight: 600 }}>7</strong> critères{" "}
        <span style={{ color: p.ink2 }}>·</span>{" "}
        <strong style={{ fontWeight: 600 }}>60+</strong> thèmes
      </div>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)} ${(n % 1000).toString().padStart(3, "0")}`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`
  return String(n)
}
