/**
 * PEGI content-descriptor labels (French UI).
 * Maps IGDB Age Rating Content Description category enums for PEGI.
 * @see https://api-docs.igdb.com/#age-rating-content-description-enums
 */

/** IGDB enum → label FR (PEGI pictogram categories). */
export const IGDB_PEGI_DESCRIPTOR_CATEGORY_FR: Record<number, string> = {
  50: "Violence",
  51: "Sexualité",
  52: "Drogues",
  53: "Peur",
  54: "Discrimination",
  55: "Langage grossier",
  56: "Jeu d'argent",
  57: "Jeu en ligne",
  58: "Achats intégrés",
}

/** English IGDB description snippets → FR (fallback when category is missing). */
const DESCRIPTION_FR: Record<string, string> = {
  violence: "Violence",
  sex: "Sexualité",
  nudity: "Sexualité",
  drugs: "Drogues",
  fear: "Peur",
  horror: "Peur",
  discrimination: "Discrimination",
  "bad language": "Langage grossier",
  profanity: "Langage grossier",
  gambling: "Jeu d'argent",
  "online gameplay": "Jeu en ligne",
  "in-game purchases": "Achats intégrés",
  "in game purchases": "Achats intégrés",
}

export interface IGDBAgeRatingEntry {
  category?: number
  rating?: number
  rating_category?: number
  organization?: number
  rating_content_descriptions?: Array<{
    category?: number
    description?: string
  }>
}

/** PEGI organization id in IGDB (Age Rating Organization). */
export const IGDB_ORG_PEGI = 2

/**
 * Extract unique French PEGI descriptor labels from IGDB age_ratings on a game.
 */
export function extractPegiDescriptors(
  ageRatings?: IGDBAgeRatingEntry[] | null,
): string[] {
  if (!ageRatings?.length) return []

  const pegiEntries = ageRatings.filter(
    (r) => r.category === 2 || r.organization === IGDB_ORG_PEGI,
  )
  if (pegiEntries.length === 0) return []

  const labels = new Set<string>()
  for (const entry of pegiEntries) {
    for (const desc of entry.rating_content_descriptions ?? []) {
      if (typeof desc.category === "number") {
        const fr = IGDB_PEGI_DESCRIPTOR_CATEGORY_FR[desc.category]
        if (fr) labels.add(fr)
        continue
      }
      if (desc.description) {
        const lower = desc.description.toLowerCase()
        for (const [key, fr] of Object.entries(DESCRIPTION_FR)) {
          if (lower.includes(key)) {
            labels.add(fr)
            break
          }
        }
      }
    }
  }

  return Array.from(labels)
}

/** Stable display order for PEGI descriptor pills. */
export const PEGI_DESCRIPTOR_ORDER = [
  "Violence",
  "Peur",
  "Langage grossier",
  "Sexualité",
  "Drogues",
  "Discrimination",
  "Jeu d'argent",
  "Jeu en ligne",
  "Achats intégrés",
] as const

export function sortPegiDescriptors(descriptors: string[]): string[] {
  const order = new Map<string, number>(PEGI_DESCRIPTOR_ORDER.map((d, i) => [d, i]))
  return [...descriptors].sort(
    (a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99) || a.localeCompare(b, "fr"),
  )
}

/** Numeric age from internal PEGI_* code (e.g. PEGI_12 → 12). */
export function pegiAgeFromOfficialRating(rating: string | null | undefined): number | null {
  if (!rating?.startsWith("PEGI_")) return null
  const n = parseInt(rating.replace("PEGI_", ""), 10)
  return Number.isFinite(n) ? n : null
}
