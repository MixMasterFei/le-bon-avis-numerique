"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { toMediaRouteId } from "@/lib/media-route"
import { APERCU_PALETTE } from "./apercuTheme"

interface PulseItem {
  id: string
  type: string
  title: string
  posterUrl: string | null
}

interface StatsShape {
  counts: {
    movies: number
    series: number
    games: number
    families: number
    reactions: number
    ageVotes: number
    reviews: number
  }
  lastImportAt: string | null
  latestAdditions: (PulseItem & { addedAt: string })[]
  weeklyBuzz: (PulseItem & { reactionCount: number })[]
}

export function ApercuPulse({ serifClass }: { serifClass: string }) {
  const [data, setData] = useState<StatsShape | null>(null)
  const p = APERCU_PALETTE

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {})
  }, [])

  if (!data) {
    return (
      <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
        <div className="container mx-auto px-4 md:px-8">
          <div className="h-40 rounded-2xl animate-pulse" style={{ background: p.placeholder }} />
        </div>
      </section>
    )
  }

  const totalCatalog =
    data.counts.movies + data.counts.series + data.counts.games

  return (
    <section
      className="py-10 md:py-14"
      style={{ background: p.bg2, color: p.ink }}
    >
      <div className="container mx-auto px-4 md:px-8">
        <div className="text-center mb-8 md:mb-10">
          <div
            className="text-[11px] font-semibold mb-1.5 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            En direct
          </div>
          <h2
            className={`${serifClass} text-2xl md:text-4xl font-medium m-0`}
            style={{ letterSpacing: "-0.03em" }}
          >
            Ça <em className="italic" style={{ color: p.accent }}>bouge</em>{" "}
            sur Totem Avisé
          </h2>
        </div>

        {/* Row 1: catalog counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          <CountTile
            serifClass={serifClass}
            n={totalCatalog}
            label="contenus évalués"
            accent={p.accent}
          />
          <CountTile
            serifClass={serifClass}
            n={data.counts.movies}
            label="films"
          />
          <CountTile
            serifClass={serifClass}
            n={data.counts.series}
            label="séries"
          />
          <CountTile
            serifClass={serifClass}
            n={data.counts.games}
            label="jeux vidéo"
          />
        </div>

        {/* Row 2: activity stats */}
        {(data.counts.reactions > 0 ||
          data.counts.ageVotes > 0 ||
          data.counts.reviews > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
            {data.counts.reactions > 0 && (
              <ActivityTile
                serifClass={serifClass}
                n={data.counts.reactions}
                label="réactions de membres de famille"
              />
            )}
            {data.counts.ageVotes > 0 && (
              <ActivityTile
                serifClass={serifClass}
                n={data.counts.ageVotes}
                label="votes sur les âges recommandés"
              />
            )}
            {data.counts.reviews > 0 && (
              <ActivityTile
                serifClass={serifClass}
                n={data.counts.reviews}
                label="avis rédigés par les parents"
              />
            )}
          </div>
        )}

        {/* Row 3: latest additions */}
        {data.latestAdditions.length > 0 && (
          <div className="mb-9">
            <div className="flex items-baseline justify-between mb-4">
              <h3
                className={`${serifClass} text-lg md:text-xl font-medium`}
                style={{ letterSpacing: "-0.02em" }}
              >
                Fraîchement ajoutés
              </h3>
              <Link
                href="/films?sort=newest"
                className="text-sm hover:opacity-70"
                style={{ color: p.ink2 }}
              >
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {data.latestAdditions.map((item) => (
                <PulsePoster
                  key={item.id}
                  item={item}
                  subtitle={timeAgo(item.addedAt)}
                  serifClass={serifClass}
                />
              ))}
            </div>
          </div>
        )}

        {/* Row 4: weekly buzz */}
        {data.weeklyBuzz.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h3
                className={`${serifClass} text-lg md:text-xl font-medium`}
                style={{ letterSpacing: "-0.02em" }}
              >
                Cette semaine, les familles regardent
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {data.weeklyBuzz.map((item) => (
                <PulsePoster
                  key={item.id}
                  item={item}
                  subtitle={`${item.reactionCount} réaction${item.reactionCount > 1 ? "s" : ""}`}
                  serifClass={serifClass}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function CountTile({
  serifClass,
  n,
  label,
  accent,
}: {
  serifClass: string
  n: number
  label: string
  accent?: string
}) {
  const p = APERCU_PALETTE
  return (
    <div
      className="rounded-2xl p-6 md:p-7"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div
        className={`${serifClass} text-3xl md:text-5xl font-medium leading-none`}
        style={{ letterSpacing: "-0.03em", color: accent ?? p.ink }}
      >
        {n.toLocaleString("fr-FR")}
      </div>
      <div className="text-sm mt-2" style={{ color: p.ink2 }}>
        {label}
      </div>
    </div>
  )
}

function ActivityTile({
  serifClass,
  n,
  label,
}: {
  serifClass: string
  n: number
  label: string
}) {
  const p = APERCU_PALETTE
  return (
    <div
      className="rounded-2xl p-5 flex items-baseline gap-4"
      style={{ background: "transparent", border: `1px solid ${p.line}` }}
    >
      <div
        className={`${serifClass} text-2xl md:text-3xl font-medium`}
        style={{ letterSpacing: "-0.02em", color: p.accent2 }}
      >
        {n.toLocaleString("fr-FR")}
      </div>
      <div className="text-sm" style={{ color: p.ink2 }}>
        {label}
      </div>
    </div>
  )
}

function PulsePoster({
  item,
  subtitle,
  serifClass,
}: {
  item: PulseItem
  subtitle: string
  serifClass: string
}) {
  const p = APERCU_PALETTE
  return (
    <Link
      href={`/media/${toMediaRouteId(item.type as "MOVIE" | "TV" | "GAME", item.id)}`}
      className="group block"
    >
      <div
        className="relative aspect-[2/3] rounded-xl overflow-hidden transition-transform group-hover:-translate-y-1"
        style={{ background: p.placeholder, border: `1px solid ${p.line}` }}
      >
        {item.posterUrl && (
          <SafeImage
            src={item.posterUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 20vw"
          />
        )}
      </div>
      <div className="mt-2">
        <div
          className={`${serifClass} text-sm line-clamp-2 font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.01em" }}
        >
          {item.title}
        </div>
        <div className="text-xs mt-0.5" style={{ color: p.ink2 }}>
          {subtitle}
        </div>
      </div>
    </Link>
  )
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return "aujourd’hui"
  if (days === 1) return "hier"
  if (days < 7) return `il y a ${days} jours`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return "il y a 1 semaine"
  if (weeks < 5) return `il y a ${weeks} semaines`
  const months = Math.floor(days / 30)
  if (months < 2) return "il y a 1 mois"
  return `il y a ${months} mois`
}
