"use client"

import { useEffect, useState } from "react"
import { CardRailSection, Em } from "./parts"
import type { RedesignCardMedia } from "./RedesignCard"

interface SmartResult {
  mediaId: string
  type?: string
  title?: string
  posterUrl?: string | null
  expertAgeRec?: number | null
  genres?: string[]
  contentMetrics?: RedesignCardMedia["contentMetrics"]
}

function toCard(r: SmartResult): RedesignCardMedia {
  return {
    id: String(r.mediaId),
    type: r.type === "TV" ? "TV" : r.type === "GAME" ? "GAME" : "MOVIE",
    title: String(r.title ?? ""),
    posterUrl: r.posterUrl ?? null,
    expertAgeRec: typeof r.expertAgeRec === "number" ? r.expertAgeRec : null,
    genres: Array.isArray(r.genres) ? r.genres : [],
    contentMetrics: r.contentMetrics ?? null,
  }
}

/**
 * Preference-aware rail shown when one or more family members are selected.
 * Unlike the age-only rails, this calls the smart filter (/api/filter/smart →
 * runSmartFilter), which ranks by each member's profile: favorite/disliked
 * genres, sensitivity tolerances, avoid-topics, interests + affinities. This is
 * what makes the homepage genuinely adapt to who's watching. Self-hides when
 * there aren't enough confident matches.
 */
export function PersonalizedRail({
  memberIds,
  title,
  maxAge,
}: {
  memberIds: string[]
  /** Display name(s) for the heading, e.g. "Eliott" or "votre famille". */
  title: string
  maxAge?: number
}) {
  const [items, setItems] = useState<RedesignCardMedia[]>([])
  const [loading, setLoading] = useState(true)
  const idsKey = memberIds.join(",")

  useEffect(() => {
    if (memberIds.length === 0) return
    let cancelled = false
    setLoading(true)
    fetch("/api/filter/smart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyMemberIds: memberIds,
        mediaType: "MOVIE",
        limit: 12,
        // ALL selected members must fit (family score = lowest member score),
        // so a title that doesn't suit the youngest is excluded — not averaged
        // away. maxAge is the youngest selected child's age (passed in).
        strictMode: true,
        minScore: 50,
        requirePoster: true,
        language: "fr,en",
        ...(typeof maxAge === "number" ? { maxAge } : {}),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data?.results) ? (data.results as SmartResult[]) : []
        setItems(arr.map(toCard))
      })
      .catch(() => { if (!cancelled) setItems([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // idsKey is the stable form of memberIds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, maxAge])

  if (!loading && items.length < 3) return null

  return (
    <CardRailSection
      id="perso"
      eyebrow="Sur-mesure"
      title={<>Spécialement pour <Em tone="terra">{title}</Em></>}
      lead="Classé selon ses goûts et ses sensibilités — pas seulement son âge."
      items={items}
      loading={loading}
      totem="full"
      showType
    />
  )
}
