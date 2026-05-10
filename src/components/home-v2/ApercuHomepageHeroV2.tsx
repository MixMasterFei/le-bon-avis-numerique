"use client"

import { useEffect, useState } from "react"
import type { CSSProperties } from "react"
import Link from "next/link"
import { ArrowRight, ShieldCheck, Sparkles, Users } from "lucide-react"
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

const CARD_WIDTH = 162
const CARD_HEIGHT = Math.round((CARD_WIDTH * 4) / 3)
const CARDS = [
  { top: 6, left: 0, tilt: -4 },
  { top: 38, left: 170, tilt: 3 },
  { top: 92, left: 340, tilt: -2 },
  { top: 190, left: 82, tilt: 4 },
  { top: 212, left: 255, tilt: -3 },
]
const STAGE_HEIGHT = Math.max(...CARDS.map((card) => card.top)) + CARD_HEIGHT + 24

export function ApercuHomepageHeroV2({
  serifClass,
  isLoggedIn,
}: {
  serifClass: string
  isLoggedIn: boolean
}) {
  const [picks, setPicks] = useState<HeroPick[]>([])
  const p = APERCU_PALETTE

  useEffect(() => {
    let cancelled = false

    fetch("/api/db/expert-picks?limit=8")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        if (Array.isArray(data?.items)) {
          setPicks(data.items.filter((item: HeroPick) => item.posterUrl).slice(0, 5))
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="relative overflow-x-clip" style={{ background: p.bg, color: p.ink }}>
      <div className="container mx-auto px-4 md:px-8 pt-5 md:pt-8 pb-10 md:pb-14">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-7"
              style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink }}
            >
              <span
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] text-white"
                style={{ background: p.accent2 }}
              >
                <Sparkles className="h-2.5 w-2.5" />
              </span>
              Preview admin - homepage conversion
            </div>

            <h1
              className={`${serifClass} text-4xl md:text-5xl lg:text-6xl leading-[1.02] font-medium m-0`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              Le bon contenu,
              <br />
              pour le{" "}
              <em className="italic" style={{ color: p.accent }}>
                bon enfant
              </em>
              ,
              <br />
              au{" "}
              <span className="italic" style={{ color: p.accent2 }}>
                bon moment
              </span>
              .
            </h1>

            <p className="mt-6 md:mt-7 max-w-xl text-base md:text-lg leading-relaxed" style={{ color: p.ink2 }}>
              Totem Avisé aide les familles à choisir des films, séries et jeux avec des repères concrets :
              âge, scènes sensibles, contexte familial et envie du moment.
            </p>

            <div className="mt-8 max-w-xl relative z-30">
              <HeroSearch submitClassName="!bg-[#1E1A15] !text-white hover:!bg-[#2B2620]" />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link
                href={isLoggedIn ? "/profil" : "/inscription"}
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
                style={{ background: p.ink, color: p.bg }}
              >
                {isLoggedIn ? "Voir mon profil famille" : "Créer mon profil famille"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/notre-methode"
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-opacity hover:opacity-75"
                style={{ border: `1px solid ${p.line2}`, color: p.ink, background: p.card }}
              >
                Comprendre la méthode
              </Link>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl">
              <TrustPill icon={ShieldCheck} label="Scènes sensibles" />
              <TrustPill icon={Users} label="Profil famille" />
              <TrustPill icon={Sparkles} label="Sélection vivante" />
            </div>
          </div>

          <div
            className="relative hidden md:block mx-auto"
            style={{ height: STAGE_HEIGHT, width: CARDS[2].left + CARD_WIDTH }}
          >
            {picks.length > 0
              ? picks.slice(0, 5).map((pick, idx) => (
                  <HeroPosterCard
                    key={pick.id}
                    pick={pick}
                    top={CARDS[idx].top}
                    left={CARDS[idx].left}
                    tilt={CARDS[idx].tilt}
                    highlighted={idx === 1}
                    serifClass={serifClass}
                  />
                ))
              : CARDS.map((card, idx) => (
                  <div
                    key={idx}
                    className="absolute rounded-2xl animate-pulse"
                    style={{
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                      top: card.top,
                      left: card.left,
                      transform: `rotate(${card.tilt}deg)`,
                      background: p.placeholder,
                    }}
                  />
                ))}

            <div
              className="absolute z-30 rounded-2xl px-4 py-3 max-w-[260px]"
              style={{
                left: -20,
                bottom: 8,
                background: p.card,
                border: `1px solid ${p.line}`,
                boxShadow: "0 16px 36px rgba(0,0,0,0.12)",
              }}
            >
              <div className={`${serifClass} text-base font-medium leading-tight`} style={{ color: p.ink }}>
                Avant de lancer, vérifiez pour qui.
              </div>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: p.ink2 }}>
                Le même film peut être parfait pour un ado et trop tôt pour son petit frère.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrustPill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; style?: CSSProperties }>
  label: string
}) {
  const p = APERCU_PALETTE
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs"
      style={{ background: p.bg2, border: `1px solid ${p.line}`, color: p.ink }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: p.accent }} />
      {label}
    </div>
  )
}

function HeroPosterCard({
  pick,
  top,
  left,
  tilt,
  highlighted,
  serifClass,
}: {
  pick: HeroPick
  top: number
  left: number
  tilt: number
  highlighted: boolean
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const ageLabel = pick.expertAgeRec !== null ? `${pick.expertAgeRec}+` : null

  return (
    <Link
      href={`/media/${toMediaRouteId(pick.type, pick.id)}`}
      className="absolute block transition-transform duration-300 hover:-translate-y-1"
      style={{ width: CARD_WIDTH, top, left, transform: `rotate(${tilt}deg)` }}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: p.card,
          border: `1px solid ${p.line}`,
          boxShadow: highlighted ? "0 24px 48px rgba(0,0,0,0.18)" : "0 6px 16px rgba(0,0,0,0.10)",
        }}
      >
        <div className="relative aspect-[3/4]" style={{ background: p.placeholder }}>
          {pick.posterUrl && (
            <SafeImage src={pick.posterUrl} alt={pick.title} fill className="object-cover" sizes={`${CARD_WIDTH}px`} />
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
          <div className={`${serifClass} text-sm line-clamp-1`} style={{ color: p.ink, letterSpacing: "-0.01em" }}>
            {pick.title}
          </div>
          {pick.genres[0] && <div className="text-[10px] mt-0.5 line-clamp-1">{pick.genres[0]}</div>}
        </div>
      </div>
    </Link>
  )
}
