"use client"

import { useEffect, useMemo, useState } from "react"
import { seededShuffle } from "@/lib/seeded-shuffle"
import { CardRailSection, Em } from "./parts"
import type { RedesignCardMedia } from "./RedesignCard"

type CardType = RedesignCardMedia["type"]

interface ApiMedia {
  id: string
  type?: string
  title: string
  posterUrl: string | null
  expertAgeRec?: number | null
  genres?: string[] | null
  contentMetrics?: RedesignCardMedia["contentMetrics"]
  cinemaReleaseBucket?: string
  releaseDate?: string | null
}

function asCardType(t: string | undefined, fallback: CardType): CardType {
  return t === "MOVIE" || t === "TV" || t === "GAME" ? t : fallback
}

function toCard(m: ApiMedia, fallbackType: CardType): RedesignCardMedia {
  return {
    id: m.id,
    type: asCardType(m.type, fallbackType),
    title: m.title,
    posterUrl: m.posterUrl,
    expertAgeRec: m.expertAgeRec ?? null,
    genres: m.genres ?? [],
    contentMetrics: m.contentMetrics ?? null,
    cornerLabel:
      m.cinemaReleaseBucket === "reissue"
        ? "Reprise"
        : m.cinemaReleaseBucket === "upcoming"
          ? "Avant-prem."
          : null,
  }
}

function useRail(url: string, key: string, fallbackType: CardType) {
  const [items, setItems] = useState<RedesignCardMedia[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data?.[key]) ? (data[key] as ApiMedia[]) : []
        setItems(arr.map((m) => toCard(m, fallbackType)))
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url, key, fallbackType])
  return { items, loading }
}

// ── Pour ce week-end — age-chip driven, with a "Recharger" reshuffle ──
export function WeekendRail({ maxAge, caps }: { maxAge: number; caps: Record<string, number> }) {
  const params = new URLSearchParams({
    maxAge: String(maxAge),
    shuffle: "weekly",
    requirePoster: "true",
    language: "fr,en",
    limit: "24",
  })
  for (const [k, v] of Object.entries(caps)) params.set(k, String(v))
  const { items: pool, loading } = useRail(`/api/db/movies?${params}`, "movies", "MOVIE")
  const [nonce, setNonce] = useState(0)
  const shown = useMemo(() => seededShuffle(pool, nonce + 1).slice(0, 10), [pool, nonce])

  return (
    <CardRailSection
      id="weekend"
      eyebrow="Ce week-end"
      title={<>Pour <Em tone="terra">ce week-end</Em> en famille</>}
      lead="Des idées prêtes à lancer. Ajustez les âges plus haut pour personnaliser."
      items={shown}
      loading={loading}
      totem="full"
      showType
      onReload={() => setNonce((n) => n + 1)}
    />
  )
}

// ── Bientôt — prochaines sorties (unreleased media; honest "à confirmer") ──
function useUpcoming() {
  const [items, setItems] = useState<RedesignCardMedia[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    fetch("/api/db/upcoming")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data?.items) ? (data.items as ApiMedia[]) : []
        setItems(
          arr.map((m) => ({
            id: m.id,
            type: asCardType(m.type, "MOVIE"),
            title: m.title,
            posterUrl: m.posterUrl,
            expertAgeRec: m.expertAgeRec ?? null,
            genres: m.genres ?? [],
            contentMetrics: null, // unreleased — no content scores
            cornerLabel: m.releaseDate
              ? new Date(m.releaseDate).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
              : "Bientôt",
          })),
        )
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])
  return { items, loading }
}

export function UpcomingRail() {
  const { items, loading } = useUpcoming()
  if (!loading && items.length === 0) return null
  return (
    <CardRailSection
      alt
      id="bientot"
      eyebrow="Bientôt"
      title={<>Les <Em tone="pine">prochaines sorties</Em> à surveiller</>}
      lead="Anticipez vos prochaines séances. L'âge indiqué est une estimation à confirmer — l'analyse détaillée arrive après la sortie."
      items={items.slice(0, 10)}
      loading={loading}
      totem="compact"
      showType
      upcoming
    />
  )
}

// ── À l'affiche au cinéma ──
export function CinemaRail() {
  const { items, loading } = useRail("/api/cinema", "movies", "MOVIE")
  return (
    <CardRailSection
      id="cinema"
      eyebrow="En ce moment"
      title={<>À l&apos;affiche <Em tone="terra">au cinéma</Em> en France</>}
      action={{ label: "Voir tout", href: "/films?sort=cinema" }}
      items={items.slice(0, 12)}
      loading={loading}
      totem="compact"
    />
  )
}

// ── Nos coups de cœur ──
export function CoupsDeCoeurRail() {
  const { items, loading } = useRail("/api/db/expert-picks?limit=10", "items", "MOVIE")
  return (
    <CardRailSection
      alt
      id="coups-de-coeur"
      eyebrow="Coups de cœur"
      title={<>Nos <Em tone="pine">coups de cœur</Em> du moment</>}
      lead="Sélectionnés à la main par l'équipe. Des valeurs sûres, vues et analysées."
      action={{ label: "Autre sélection", href: "/recherche" }}
      items={items}
      loading={loading}
      totem="full"
      showType
    />
  )
}

// ── Sortis récemment en jeux vidéo (self-hides < 3) ──
export function GamesRail() {
  const { items, loading } = useRail(
    "/api/db/games?sortBy=releaseDate&limit=12&requirePoster=true&minVoteCount=20",
    "games",
    "GAME",
  )
  if (!loading && items.length < 3) return null
  return (
    <CardRailSection
      id="jeux"
      eyebrow="Sur les consoles cette semaine"
      title={<>Sortis récemment en <Em tone="terra">jeux vidéo</Em></>}
      action={{ label: "Voir tout", href: "/jeux?sort=releaseDate" }}
      items={items.slice(0, 12)}
      loading={loading}
      totem="compact"
    />
  )
}
