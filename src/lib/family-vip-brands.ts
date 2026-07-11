// Studios, brands, and IPs whose content is designed for all ages.
// Appearing anywhere in a MediaItem's `topics` array marks it as a
// "family VIP": the Family Fit age-gap penalty is dropped, AND the
// age-range filter on listing pages is bypassed (a Ghibli film rated
// 3+ will still surface for a 10-year-old).
//
// Stored casings match what the enrichment prompt writes into the DB
// (src/app/api/admin/enrich/route.ts VALID_TOPICS). Keep this list in
// sync with that prompt.

export const FAMILY_VIP_BRAND_TOPICS = [
  // Animation studios
  "Disney",
  "Pixar",
  "DreamWorks",
  "Studio Ghibli",
  "Aardman",
  "Illumination",
  "Laika",
  // Game brands
  "Nintendo",
  "LEGO",
  "Minecraft",
  // French/European IPs
  "Astérix",
  "Tintin",
] as const

/** Lowercased set for case-insensitive JS comparisons in scoring code. */
export const FAMILY_VIP_BRAND_TOPICS_LOWER = new Set(
  FAMILY_VIP_BRAND_TOPICS.map((t) => t.toLowerCase()),
)

// A VIP brand tag means "designed for all ages", so it may lift a title ABOVE
// a stricter age filter — but ONLY up to this ceiling. The bypass must never
// rescue a genuinely mature title: "Nintendo" tags PEGI-18 first-party games
// (Bayonetta), and "Disney" gets applied thematically to adult films (The
// Florida Project, 14+). Above this age the title respects the age filter like
// anything else. 12 covers real family-VIP content (Ghibli up to Mononoke,
// Zelda) without opening a hole for the mature exceptions.
export const FAMILY_VIP_AGE_CEILING = 12
