// Shared media item type used across the application
export interface MediaItem {
  id: string
  title: string
  originalTitle?: string
  type: "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"
  releaseDate: string | null
  posterUrl: string
  synopsisFr: string | null
  officialRating: string | null
  expertAgeRec: number | null
  communityAgeRec: number | null
  duration?: number
  director?: string
  genres: string[]
  platforms: string[]
  topics: string[]
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    consumerism: number
    substanceUse: number
    positiveMessages: number
    roleModels: number
    whatParentsNeedToKnow: string[]
  }
  reviews: {
    id: string
    role: "PARENT" | "KID" | "EDUCATOR"
    rating: number
    ageSuggestion: number
    comment: string
  }[]
  reviewCount?: number
  reviewAvgRating?: number | null
  tmdbRating?: number | null
  tmdbVoteCount?: number | null
  toneTags?: string[]
  pacing?: string
  enrichmentSource?: string
  // Imported film shown with an estimated age before AI enrichment → "âge provisoire" badge.
  isProvisional?: boolean
  // TMDB release lifecycle ("Released" | "Planned" | …). Used to withhold
  // content evaluation for upcoming titles. See @/lib/release-status.
  releaseStatus?: string | null
  // SEO-only meta <title> override (NOT the display name). See @/lib/seo-autofix.
  seoTitle?: string | null
}

export type MediaType = MediaItem["type"]
