"use client"

import { CardRailSection, Em } from "./parts"
import type { RedesignCardMedia } from "./RedesignCard"
import { SPOTLIGHT_MIN_TO_SHOW, type SpotlightItem } from "@/lib/homepage-spotlight"

/** Server item → V2 card. The age is the catalogue's; provisional ages say so. */
export function toSpotlightCard(item: SpotlightItem): RedesignCardMedia {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    posterUrl: item.posterUrl,
    expertAgeRec: item.expertAgeRec,
    genres: item.genres,
    contentMetrics: item.contentMetrics,
    provisional: item.isProvisional,
    cornerLabel: null,
  }
}

/**
 * « À ne pas manquer cette semaine » — what everyone is talking about this
 * week (cinema, series, games). INFORMATIONAL: unlike every browse rail it
 * takes NO maxAge and no member ranking, on purpose — the point is that a
 * parent sees GTA VI with its « 18 » badge instead of not seeing it at all.
 * RedesignCard still applies the poster blur rules and the « à confirmer »
 * badge. Items are server-rendered (props from page.tsx): no client fetch.
 */
export function SpotlightBand({ items }: { items: SpotlightItem[] }) {
  if (items.length < SPOTLIGHT_MIN_TO_SHOW) return null
  return (
    <CardRailSection
      alt
      id="a-ne-pas-manquer"
      eyebrow="Cette semaine"
      title={<>À ne pas manquer <Em tone="terra">cette semaine</Em></>}
      lead="Ce dont tout le monde parle en ce moment, au cinéma, en séries et en jeux vidéo. Ce n'est pas une sélection pour l'âge choisi : chaque titre affiche son âge conseillé."
      items={items.map(toSpotlightCard)}
      loading={false}
      totem="compact"
      showType
    />
  )
}
