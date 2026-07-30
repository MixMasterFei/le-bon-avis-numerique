"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { SafeImage } from "@/components/ui/SafeImage"
import { tmdbPosterAtSize } from "@/lib/tmdb-image"
import { toMediaRouteId } from "@/lib/media-route"
import { genreLabelFr } from "@/components/home-v2/apercuTheme"
import { Band, Wrap, Em } from "./parts"
import { totemLevel, totemAxesFor, hasTotemData, TOTEM_COLORS, TOTEM_WORDS, type TotemMetrics } from "./totem"

interface DecoderItem {
  id: string
  type: "MOVIE" | "TV" | "GAME"
  title: string
  posterUrl: string | null
  expertAgeRec: number | null
  genres: string[]
  contentMetrics: TotemMetrics | null
}

const TYPE_LABELS: Record<DecoderItem["type"], string> = { MOVIE: "Film", TV: "Série", GAME: "Jeu" }

function metricsSum(m: TotemMetrics | null): number {
  if (!m) return -1
  return (m.violence ?? 0) + (m.sexNudity ?? 0) + (m.language ?? 0) + (m.substanceUse ?? 0)
}

/** "Notre méthode" trust band — pine card + a live totem decoder of one real
 * title (the most illustrative pick, i.e. the one with the richest totem). */
export function MethodeBand() {
  const [item, setItem] = useState<DecoderItem | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/db/expert-picks?limit=12")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr: DecoderItem[] = Array.isArray(data?.items) ? data.items : []
        // hasTotemData, not a truthy check: a ContentMetrics row can exist with
        // every axis null, which would render a decoder showing four "Aucun" —
        // a demo of the totem that demonstrates nothing.
        const withMetrics = arr.filter((m) => hasTotemData(m.contentMetrics, m.type))
        const best = [...withMetrics].sort((a, b) => metricsSum(b.contentMetrics) - metricsSum(a.contentMetrics))[0] ?? arr[0] ?? null
        if (best) setItem(best)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <Band alt>
      <Wrap>
        <div
          className="grid items-center gap-8 rounded-[24px] p-8 md:p-10 lg:grid-cols-[1.05fr_1fr]"
          style={{ background: "var(--pine)", color: "#EAF2EC" }}
        >
          <div>
            <div className="flex items-center gap-2.5 text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--gold)" }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--gold)" }} />
              Notre méthode
            </div>
            <h2 className="mt-3 text-[clamp(26px,3.2vw,38px)] font-bold leading-[1.05] text-white" style={{ fontFamily: "var(--font-bricolage)", letterSpacing: "-0.02em" }}>
              Le <Em tone="gold">totem</Em>, notre repère en un coup d&apos;œil.
            </h2>
            <p className="mt-3.5 text-[15.5px]" style={{ color: "#CFE0D5" }}>
              Chaque titre est analysé sur ce qui compte vraiment. Pas un avis opaque : un âge conseillé, plus quatre repères de sensibilité, lisibles d&apos;un regard. Vous décidez en connaissance de cause.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/notre-methode" className="rounded-full px-5 py-3 text-[14.5px] font-bold" style={{ background: "var(--gold)", color: "#23201C" }}>
                Comment ça marche
              </Link>
              <Link href="/nos-valeurs" className="rounded-full px-5 py-3 text-[14.5px] font-bold text-white" style={{ border: "1px solid rgba(255,255,255,.35)" }}>
                Notre indépendance
              </Link>
            </div>
          </div>

          <Decoder item={item} />
        </div>
      </Wrap>
    </Band>
  )
}

function Decoder({ item }: { item: DecoderItem | null }) {
  const shell = { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.16)" }
  if (!item) {
    return <div className="min-h-[280px] animate-pulse rounded-[18px] p-[22px]" style={shell} />
  }
  const href = `/media/${toMediaRouteId(item.type, item.id)}`
  const genres = item.genres.slice(0, 2).map(genreLabelFr).join(", ")
  const metrics = item.contentMetrics ?? {}
  return (
    <div className="rounded-[18px] p-[22px]" style={shell}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={href} className="flex min-w-0 items-center gap-3">
          <div className="relative h-[62px] w-[46px] flex-none overflow-hidden rounded-[9px]" style={{ background: "rgba(0,0,0,.3)" }}>
            {item.posterUrl && (
              <SafeImage src={tmdbPosterAtSize(item.posterUrl, "w185")} alt={item.title} fill className="object-cover" sizes="46px" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[15.5px] font-bold text-white">{item.title}</div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "#A9C4B3" }}>
              {TYPE_LABELS[item.type]}{genres ? ` · ${genres}` : ""}
            </div>
          </div>
        </Link>
        {typeof item.expertAgeRec === "number" && item.expertAgeRec > 0 && (
          <span className="rounded-[8px] px-[9px] py-[3px] text-[15px] font-extrabold" style={{ background: "var(--gold)", color: "#23201C", fontFamily: "var(--font-bricolage)" }}>
            {item.expertAgeRec}+
          </span>
        )}
      </div>
      {totemAxesFor(item.type).map((a) => {
        // `totemLevel`, NOT `vigilanceAxisLevel`. The vigilance mapping is a
        // card-badge SIGNAL ("y a-t-il un point à surveiller ?"): it folds raw
        // 0–2 into one bucket and caps young-rated titles. That is fine for a
        // coloured dot, but here the level is rendered as a WORD, and the two
        // contracts are not interchangeable — with the vigilance mapping this
        // card printed "Aucun" for axes our own analysis had scored 1/5, and
        // "Léger" for a violence 3/5 that the fiche shows in its amber
        // "Modéré" band. A word is a factual claim; it has to track the data.
        const lvl = totemLevel(metrics[a.key])
        const words = a.words ?? TOTEM_WORDS
        return (
          <div key={a.key} className="flex items-center justify-between gap-3.5 border-t py-3" style={{ borderColor: "rgba(255,255,255,.12)" }}>
            <b className="text-[14.5px] text-white">{a.label}</b>
            <span className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "#A9C4B3" }}>
              {words[lvl]}
              <i className="block" style={{ width: 11, height: 11, borderRadius: 4, background: TOTEM_COLORS[lvl] }} />
            </span>
          </div>
        )
      })}
      <div className="mt-4 text-[12px]" style={{ color: "#8FA89A" }}>
        Un repère indicatif, pas une note. Le détail complet est sur chaque fiche.
      </div>
    </div>
  )
}
