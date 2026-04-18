"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { HeroSearch } from "@/components/home/HeroSearch"
import { SafeImage } from "@/components/ui/SafeImage"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { getMemberAge } from "@/lib/age-utils"
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

interface FamilyMember {
  id: string
  name: string
  avatarEmoji?: string | null
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  birthYear: number | null
  birthMonth: number | null
}

// Editorial tone labels rotate per card index so the showcase stays coherent
// even when the underlying films change. Values are drawn from the site's
// real enrichment vocabulary (tone tags).
const CARD_LABELS = ["Tout doux", "Coup de cœur", "Fait rêver", "Aventureux"]
const TILT_STEPS = [-4, 2, 4, -2]

// Four clear diagonal positions — less "crumpled pile", more editorial fan.
// Cards spread vertically with generous gaps so each one breathes.
const POSITIONS = [
  { top: "0%", right: "28%" },
  { top: "8%", right: "4%" },
  { top: "40%", right: "32%" },
  { top: "52%", right: "6%" },
]

const DEMO_FAMILY = [
  { name: "Léa", age: 8 },
  { name: "Tom", age: 11 },
]

export function ApercuHero({
  serifClass,
  isLoggedIn,
}: {
  serifClass: string
  isLoggedIn: boolean
}) {
  const [picks, setPicks] = useState<HeroPick[]>([])
  const [stats, setStats] = useState<StatsShape | null>(null)
  const [family, setFamily] = useState<FamilyMember[]>([])
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

  useEffect(() => {
    if (!isLoggedIn) return
    fetch("/api/user/family")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const members = Array.isArray(data?.members) ? data.members : []
        setFamily(members.slice(0, 3))
      })
      .catch(() => {})
  }, [isLoggedIn])

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
              Indépendant · sans publicité · fait main
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
              choisis{" "}
              <span className="italic" style={{ color: p.accent2 }}>
                en confiance
              </span>
              .
            </h1>

            <p
              className="mt-6 md:mt-7 max-w-xl text-base md:text-lg leading-relaxed"
              style={{ color: p.ink2 }}
            >
              On passe chaque film, série et jeu vidéo au crible. À vous de
              choisir ce qui vous correspond.
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
                { label: "Soirée famille", href: "/films?maxAge=10&maxViolence=2&maxSexual=1&maxLanguage=1" },
                { label: "Ados", href: "/films?maxAge=15&maxViolence=3" },
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
                <Stat
                  n="7"
                  l="critères par œuvre"
                  accent={p.accent}
                  serifClass={serifClass}
                />
                <Stat
                  n="60+"
                  l="thèmes explorés"
                  serifClass={serifClass}
                />
              </div>
            )}
          </div>

          <div className="relative h-[520px] md:h-[560px] lg:h-[600px] hidden md:block">
            {picks.length > 0
              ? picks.slice(0, 4).map((pick, idx) => (
                  <HeroPosterCard
                    key={pick.id}
                    pick={pick}
                    tilt={TILT_STEPS[idx] ?? 0}
                    pos={POSITIONS[idx]}
                    zIndex={10 - idx}
                    highlighted={idx === 1}
                    label={CARD_LABELS[idx]}
                    serifClass={serifClass}
                  />
                ))
              : Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="absolute w-[200px] aspect-[3/4] rounded-2xl animate-pulse"
                    style={{
                      ...POSITIONS[idx],
                      transform: `rotate(${TILT_STEPS[idx]}deg)`,
                      background: p.placeholder,
                    }}
                  />
                ))}

            <ProfilBadge
              family={family}
              isLoggedIn={isLoggedIn}
              serifClass={serifClass}
            />
            <FitBadge serifClass={serifClass} />
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
  label,
  serifClass,
}: {
  pick: HeroPick
  tilt: number
  pos: { top: string; right: string }
  zIndex: number
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
      className="absolute w-[200px] block transition-transform duration-300 hover:-translate-y-1"
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
            ? "0 28px 56px rgba(0,0,0,0.20)"
            : "0 10px 28px rgba(0,0,0,0.10)",
        }}
      >
        <div className="relative aspect-[3/4]" style={{ background: p.placeholder }}>
          {pick.posterUrl && (
            <SafeImage
              src={pick.posterUrl}
              alt={pick.title}
              fill
              className="object-cover"
              sizes="200px"
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

function ProfilBadge({
  family,
  isLoggedIn,
  serifClass,
}: {
  family: FamilyMember[]
  isLoggedIn: boolean
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const useReal = isLoggedIn && family.length > 0

  return (
    <div
      className="absolute top-6 left-0 z-20 rounded-2xl px-4 py-3 flex items-center gap-3 max-w-[260px]"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        boxShadow: "0 14px 32px rgba(0,0,0,0.10)",
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: p.accent2, color: "#fff", fontWeight: 600 }}
      >
        ✓
      </div>
      <div className="min-w-0">
        <div
          className={`${serifClass} text-[13px] font-semibold leading-tight`}
          style={{ color: p.ink }}
        >
          {useReal ? "Votre foyer" : "Profil foyer créé"}
        </div>
        <div
          className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
          style={{ color: p.ink2 }}
        >
          {useReal ? (
            family.map((m, i) => {
              const age = getMemberAge(m.birthYear, m.birthMonth)
              return (
                <span key={m.id} className="flex items-center gap-1">
                  <MemberAvatar
                    avatarStyle={m.avatarStyle ?? null}
                    avatarSeed={m.avatarSeed ?? null}
                    avatarOptions={m.avatarOptions ?? null}
                    avatarEmoji={m.avatarEmoji ?? null}
                    name={m.name}
                    size={16}
                  />
                  <span>
                    {m.name}
                    {age !== null && ` · ${age} ans`}
                  </span>
                  {i < family.length - 1 && (
                    <span style={{ color: p.line2 }}>·</span>
                  )}
                </span>
              )
            })
          ) : (
            DEMO_FAMILY.map((m, i) => (
              <span key={m.name} className="flex items-center gap-1">
                <DemoAvatar name={m.name} />
                <span>
                  {m.name} · {m.age} ans
                </span>
                {i < DEMO_FAMILY.length - 1 && (
                  <span style={{ color: p.line2 }}>·</span>
                )}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function FitBadge({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <div
      className="absolute bottom-6 left-2 z-20 rounded-2xl px-4 py-3 max-w-[260px]"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        boxShadow: "0 14px 32px rgba(0,0,0,0.10)",
      }}
    >
      <div
        className={`${serifClass} text-[13px] font-semibold leading-tight`}
        style={{ color: p.ink }}
      >
        Analyse pour votre foyer
      </div>
      <div className="mt-2 space-y-1">
        <FitRow name="Léa" age={8} verdict="Adapté" color="#5C8A5C" />
        <FitRow name="Tom" age={11} verdict="Attention" color="#D89A4A" />
      </div>
      <div
        className="mt-2 text-[10px] leading-tight"
        style={{ color: p.ink2 }}
      >
        Ce badge s’affiche sur chaque fiche.
      </div>
    </div>
  )
}

function FitRow({
  name,
  age,
  verdict,
  color,
}: {
  name: string
  age: number
  verdict: string
  color: string
}) {
  const p = APERCU_PALETTE
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span style={{ color: p.ink, fontWeight: 600 }}>{verdict}</span>
      <span style={{ color: p.ink2 }}>
        · {name} · {age} ans
      </span>
    </div>
  )
}

function DemoAvatar({ name }: { name: string }) {
  const p = APERCU_PALETTE
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-[9px] font-semibold"
      style={{
        width: 16,
        height: 16,
        background: p.bg2,
        color: p.ink,
        border: `1px solid ${p.line2}`,
      }}
    >
      {name[0]}
    </span>
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
