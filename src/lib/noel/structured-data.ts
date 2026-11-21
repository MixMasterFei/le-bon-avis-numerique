import { toMediaRouteId } from "@/lib/media-route"
import type { BandGroup } from "./selection"

// JSON-LD for the /noel pages. ItemList + BreadcrumbList only: the age
// questions belong to each fiche's own FAQ, and repeating them here would
// put the same FAQPage answer on two URLs.

export const NOEL_BASE_URL = "https://totemavise.com"

interface ListedCard {
  id: string
  type: "MOVIE" | "GAME"
  title: string
  disambiguationYear: number | null
}

/** One ItemList in on-page order (bands first to last), positions 1..n. */
export function noelItemListJsonLd(
  name: string,
  description: string,
  path: string,
  groups: readonly BandGroup<ListedCard>[],
) {
  const items = groups.flatMap((g) => g.items)
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    url: `${NOEL_BASE_URL}${path}`,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.disambiguationYear ? `${item.title} (${item.disambiguationYear})` : item.title,
      url: `${NOEL_BASE_URL}/media/${toMediaRouteId(item.type, item.id)}`,
    })),
  }
}

export function noelBreadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Accueil", path: "" }, ...trail].map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: `${NOEL_BASE_URL}${step.path}`,
    })),
  }
}
