// Revalidate every hour — balances freshness with performance
export const revalidate = 3600

import { cache, Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { BackButton } from "@/components/ui/BackButton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MethodBadge } from "@/components/ui/MethodBadge"
import { ContentGrid } from "@/components/media/ContentGrid"
import { DualMetricsDisplay } from "@/components/media/DualMetricsDisplay"
import { WhatParentsNeedToKnow } from "@/components/media/WhatParentsNeedToKnow"
import { SensitiveWarnings } from "@/components/media/SensitiveWarnings"
import { ReviewsSection } from "@/components/media/ReviewsSection"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { WatchProvidersClient } from "@/components/media/WatchProvidersClient"
import { FamilyReactions } from "@/components/media/FamilyReactions"
import { FamilyFitHero } from "@/components/media/FamilyFitHero"
import { FicheDataProvider } from "@/components/media/FicheDataContext"
import { MediaDashboardBar } from "@/components/media/MediaDashboardBar"
import { FamilyQuickAnswer } from "@/components/media/FamilyQuickAnswer"
import { AccountChip } from "@/components/media/AccountChip"
import { ApercuSimilarMedia } from "@/components/home-v2/ApercuSimilarMedia"
import { AgeAlternativesGames } from "@/components/media/AgeAlternativesGames"

import { ReportCorrectionButton } from "@/components/media/ReportCorrectionButton"
import { PlatformIcons } from "@/components/media/PlatformIcons"
import { TalkToYourKids } from "@/components/media/TalkToYourKids"
import { GameInfoCard } from "@/components/media/GameInfoCard"
import { GameMetricsDisplay } from "@/components/media/GameMetricsDisplay"
import { AdminScreenshotsWrapper } from "@/components/media/AdminScreenshotsWrapper"
import { MediaHeroEditable } from "@/components/media/MediaHeroEditable"
import { BlurredPoster } from "@/components/media/BlurredPoster"
import { MediaV3Toggle } from "@/components/media-v3/MediaV3Toggle"
import { MediaDashboard } from "@/components/media-v3/MediaDashboard"
import { DashboardBreadcrumb } from "@/components/media-v3/DashboardBreadcrumb"
import { mediaV3Enabled } from "@/lib/media-v3-flag"
import { isAdmin } from "@/lib/auth"
import { getDashboardMedia } from "@/lib/media-dashboard-data"
import { mockMediaItems } from "@/lib/mock-data"
import { mediaTypeLabels, formatDateFr } from "@/lib/utils"
import { notFound } from "next/navigation"
import { parseMediaRouteId, toMediaRouteId } from "@/lib/media-route"
import { buildQuickAnswer } from "@/lib/quick-answer"
import { buildAgeRationale } from "@/lib/age-rationale"
import { shouldHideContentAnalysis, isUnreleased, isUnreleasedStatus } from "@/lib/release-status"
import {
  getMovieDetails,
  getTVDetails,
  getImageUrl,
  ImageSize,
  getFrenchCertification,
  getDirector,
  getTVFrenchRating,
  mapCertificationToInternal,
} from "@/lib/tmdb"
import { getGameDetails, transformGame } from "@/lib/igdb"
import { getBookDetails, transformBook } from "@/lib/google-books"
import { prisma } from "@/lib/prisma"
import type { MediaItem as MockMediaItem } from "@/lib/types"

interface MediaPageProps {
  params: Promise<{ id: string }>
}

// Extended type for database items with screenshots
interface DatabaseMediaItem extends MockMediaItem {
  numberOfSeasons?: number | null
  pegiDescriptors?: string[]
  gameModes?: string[]
  // Manga-specific (only set when type === "MANGA")
  volumeCount?: number | null
  chapterCount?: number | null
  demographic?: string | null
  status?: string | null
  screenshots?: { id: string; url: string; width: number | null; height: number | null; order: number }[]
}

// Helper to fetch from database directly (cached to avoid duplicate queries in generateMetadata + page)
const fetchFromDatabase = cache(async function fetchFromDatabase(id: string): Promise<DatabaseMediaItem | null> {
  try {
    // Common include configuration - simplified to avoid potential schema mismatches
    const includeConfig = {
      contentMetrics: true,
      screenshots: {
        orderBy: { order: "asc" as const },
        take: 12, // Fetch extra to account for dedup (language variants)
      },
      reviews: {
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
    }

    // Try to find by UUID first
    let dbMedia = await prisma.mediaItem.findUnique({
      where: { id },
      include: includeConfig,
    })

    // If not found by UUID, try by tmdbId
    if (!dbMedia) {
      const numericId = parseInt(id)
      if (!isNaN(numericId)) {
        dbMedia = await prisma.mediaItem.findFirst({
          where: { tmdbId: numericId },
          include: includeConfig,
        })
      }
    }

    // If still not found, try by igdbId
    if (!dbMedia) {
      const numericId = parseInt(id)
      if (!isNaN(numericId)) {
        dbMedia = await prisma.mediaItem.findFirst({
          where: { igdbId: numericId },
          include: includeConfig,
        })
      }
    }

    if (!dbMedia) return null

    return {
      id: dbMedia.id,
      title: dbMedia.title,
      originalTitle: dbMedia.originalTitle || undefined,
      type: dbMedia.type as MockMediaItem["type"],
      releaseDate: dbMedia.releaseDate?.toISOString().split("T")[0] || null,
      releaseStatus: dbMedia.releaseStatus,
      seoTitle: dbMedia.seoTitle,
      posterUrl: dbMedia.posterUrl || "/placeholder-poster.jpg",
      synopsisFr: dbMedia.synopsisFr,
      officialRating: dbMedia.officialRating,
      pegiDescriptors: dbMedia.pegiDescriptors ?? [],
      expertAgeRec: dbMedia.expertAgeRec,
      // Imported with an estimated age but not yet AI-enriched → "âge provisoire".
      isProvisional: !dbMedia.isEnriched && dbMedia.expertAgeRec != null,
      communityAgeRec: dbMedia.communityAgeRec,
      tmdbRating: dbMedia.tmdbRating,
      tmdbVoteCount: dbMedia.tmdbVoteCount,
      duration: dbMedia.duration || undefined,
      director: dbMedia.director || undefined,
      genres: dbMedia.genres || [],
      platforms: dbMedia.platforms || [],
      topics: dbMedia.topics || [],
      numberOfSeasons: (dbMedia as unknown as { numberOfSeasons?: number | null }).numberOfSeasons ?? null,
      contentMetrics: dbMedia.contentMetrics
        ? {
            violence: dbMedia.contentMetrics.violence,
            sexNudity: dbMedia.contentMetrics.sexNudity,
            language: dbMedia.contentMetrics.language,
            consumerism: dbMedia.contentMetrics.consumerism,
            substanceUse: dbMedia.contentMetrics.substanceUse,
            positiveMessages: dbMedia.contentMetrics.positiveMessages,
            roleModels: dbMedia.contentMetrics.roleModels,
            whatParentsNeedToKnow: dbMedia.contentMetrics.whatParentsNeedToKnow || [],
            sensitiveWarnings: dbMedia.contentMetrics.sensitiveWarnings || [],
            enrichmentConfidence: dbMedia.contentMetrics.enrichmentConfidence,
          }
        : {
            violence: 0,
            sexNudity: 0,
            language: 0,
            consumerism: 0,
            substanceUse: 0,
            positiveMessages: 0,
            roleModels: 0,
            whatParentsNeedToKnow: [],
            sensitiveWarnings: [],
            enrichmentConfidence: null,
          },
      reviews: dbMedia.reviews.map((r) => {
        const ext = r as unknown as { editedAt?: Date; familyMember?: { id: string; name: string; avatarEmoji?: string } }
        return {
          id: r.id,
          role: r.role as "PARENT" | "KID" | "EDUCATOR",
          rating: r.rating,
          ageSuggestion: r.ageSuggestion ?? 0,
          comment: r.comment || "",
          createdAt: r.createdAt.toISOString(),
          editedAt: ext.editedAt?.toISOString() || null,
          user: r.user ? { id: r.user.id, name: r.user.name, image: r.user.image } : undefined,
          familyMember: ext.familyMember ? { id: ext.familyMember.id, name: ext.familyMember.name, avatarEmoji: ext.familyMember.avatarEmoji } : null,
        }
      }),
      screenshots: dbMedia.screenshots?.map((s) => ({
        id: s.id,
        url: s.url,
        width: s.width,
        height: s.height,
        order: s.order,
      })) || [],
      volumeCount: (dbMedia as unknown as { volumeCount?: number | null }).volumeCount ?? null,
      chapterCount: (dbMedia as unknown as { chapterCount?: number | null }).chapterCount ?? null,
      demographic: (dbMedia as unknown as { demographic?: string | null }).demographic ?? null,
      status: (dbMedia as unknown as { status?: string | null }).status ?? null,
    }
  } catch (error) {
    console.error("Failed to fetch from database:", error)
    // Re-throw in development to see the actual error
    if (process.env.NODE_ENV === "development") {
      throw error
    }
    return null
  }
})

// Type label mapping for SEO
const typeLabels: Record<string, string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu vidéo",
  BOOK: "Livre",
  APP: "Application",
  MANGA: "Manga",
}

const typeCategoryPaths: Record<string, { path: string; label: string }> = {
  MOVIE: { path: "/films", label: "Films" },
  TV: { path: "/series", label: "Séries" },
  GAME: { path: "/jeux", label: "Jeux vidéo" },
  BOOK: { path: "/livres", label: "Livres" },
  APP: { path: "/apps", label: "Applications" },
  MANGA: { path: "/mangas", label: "Mangas" },
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: MediaPageProps): Promise<Metadata> {
  const { id } = await params
  const { id: rawId } = parseMediaRouteId(id)

  const media = await fetchFromDatabase(rawId)
  if (!media) {
    return {
      title: "Média familial — avis par âge",
      description:
        "Découvrez les repères Totem Avisé pour choisir des films, séries, jeux et livres adaptés à votre famille.",
      alternates: { canonical: `/media/${id}` },
    }
  }

  // Canonical route id is always the normalized `<type>:<id>` form, so every
  // URL-encoding variant (movie:603 vs movie%3A603) resolves to ONE canonical
  // and Google stops reporting "duplicate without user-selected canonical".
  const routeId = toMediaRouteId(media.type, media.id)

  // Pre-release/provisional: the age is an estimate, so the SERP wording must
  // not assert a definitive verdict. See @/lib/release-status.
  const hide = shouldHideContentAnalysis({
    releaseDate: media.releaseDate,
    isProvisional: media.isProvisional,
    releaseStatus: media.releaseStatus,
  })

  const hasAge = media.expertAgeRec && media.expertAgeRec > 0
  const ageStr = hasAge
    ? hide
      ? ` — Dès ${media.expertAgeRec} ans (à confirmer)`
      : ` — Dès ${media.expertAgeRec} ans`
    : ""

  // The striking-distance agent can set a `seoTitle` override that puts a
  // ranking keyword in the SERP <title> WITHOUT renaming the work (the H1,
  // cards and structured-data name all stay `media.title`). See seo-autofix.
  const title = media.seoTitle?.trim() || `${media.title}${ageStr}`

  const typeLabel = typeLabels[media.type] || "Média"

  // Lead the meta description with the age verdict + family angle. This both
  // answers the "[titre] à partir de quel âge" query directly in the SERP and
  // differentiates us from generic plot-summary results (AlloCiné, Wikipédia).
  const agePrefix = hasAge
    ? hide
      ? `Âge conseillé dès ${media.expertAgeRec} ans (à confirmer)`
      : `Dès ${media.expertAgeRec} ans · Notre avis famille`
    : null
  const synopsis = media.synopsisFr?.trim() || ""
  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text

  let description: string
  if (agePrefix && synopsis) {
    description = `${agePrefix} — ${truncate(synopsis, 160 - agePrefix.length - 3)}`
  } else if (synopsis) {
    description = truncate(synopsis, 160)
  } else if (agePrefix) {
    description = `${agePrefix}. ${typeLabel} analysé par Totem Avisé pour les familles.`
  } else {
    description = `${typeLabel} analysé par Totem Avisé. Découvrez notre avis détaillé et recommandation d'âge pour les familles.`
  }

  const ogType = media.type === "MOVIE" ? "video.movie"
    : media.type === "TV" ? "video.tv_show"
    : "website"

  return {
    title,
    description,
    alternates: {
      canonical: `/media/${routeId}`,
      types: { "text/markdown": `/md/media/${routeId}` },
    },
    keywords: [
      ...media.genres.slice(0, 5),
      typeLabel,
      "avis parents",
      // Cover the real query variants by rating system: games skew PEGI,
      // films/séries skew CSA + "parents guide".
      "à partir de quel âge",
      ...(media.type === "GAME"
        ? ["pegi", `${media.title} pegi`, "âge pour jouer"]
        : ["age minimum", "age conseillé", "parents guide"]),
      media.title,
    ],
    // OG/Twitter images come from the branded 1200×630 card at
    // ./opengraph-image.tsx (Next injects it automatically) — no explicit
    // `images` here, which would duplicate the tag with the raw portrait poster.
    openGraph: {
      title: `${title} | Totem Avisé`,
      description,
      type: ogType as "video.movie" | "video.tv_show" | "website",
      locale: "fr_FR",
      siteName: "Totem Avisé",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

// Build JSON-LD structured data for a media item.
// `hideContentAnalysis` = pre-release/provisional: we suppress the
// AggregateRating (a TMDB score on an unwatched title reads like a full
// "avis") and keep the FAQ answer an honest estimate.
function buildJsonLd(media: DatabaseMediaItem, routeId: string, hideContentAnalysis: boolean) {
  const baseUrl = "https://totemavise.com"
  const pageUrl = `${baseUrl}/media/${routeId}`
  const category = typeCategoryPaths[media.type]

  // Breadcrumb
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: baseUrl },
      ...(category ? [{ "@type": "ListItem", position: 2, name: category.label, item: `${baseUrl}${category.path}` }] : []),
      { "@type": "ListItem", position: category ? 3 : 2, name: media.title, item: pageUrl },
    ],
  }

  // AggregateRating: prefer internal user reviews when present, fall back to TMDB
  const internalRatings = media.reviews?.map((r) => r.rating).filter((n) => typeof n === "number") || []
  const internalCount = internalRatings.length
  const internalAvg = internalCount > 0
    ? Math.round((internalRatings.reduce((a, b) => a + b, 0) / internalCount) * 10) / 10
    : 0

  const aggregateRating = hideContentAnalysis
    ? undefined
    : internalCount > 0
    ? {
        "@type": "AggregateRating",
        ratingValue: internalAvg,
        bestRating: 5,
        worstRating: 1,
        ratingCount: internalCount,
      }
    : media.tmdbRating && media.tmdbVoteCount && media.tmdbVoteCount > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: media.tmdbRating,
          bestRating: 10,
          worstRating: 0,
          ratingCount: media.tmdbVoteCount,
        }
      : undefined

  // Main entity based on type
  let mainEntity: Record<string, unknown>

  switch (media.type) {
    case "MOVIE":
      mainEntity = {
        "@context": "https://schema.org",
        "@type": "Movie",
        name: media.title,
        ...(media.originalTitle && { alternateName: media.originalTitle }),
        description: media.synopsisFr || undefined,
        ...(media.posterUrl && media.posterUrl !== "/placeholder-poster.jpg" && { image: media.posterUrl }),
        url: pageUrl,
        inLanguage: "fr",
        ...(media.releaseDate && { datePublished: media.releaseDate }),
        ...(media.director && { director: { "@type": "Person", name: media.director } }),
        ...(media.genres.length > 0 && { genre: media.genres }),
        ...(media.officialRating && { contentRating: media.officialRating }),
        ...(media.duration && { duration: `PT${media.duration}M` }),
        ...(aggregateRating && { aggregateRating }),
      }
      break
    case "TV":
      mainEntity = {
        "@context": "https://schema.org",
        "@type": "TVSeries",
        name: media.title,
        ...(media.originalTitle && { alternateName: media.originalTitle }),
        description: media.synopsisFr || undefined,
        ...(media.posterUrl && media.posterUrl !== "/placeholder-poster.jpg" && { image: media.posterUrl }),
        url: pageUrl,
        inLanguage: "fr",
        ...(media.releaseDate && { datePublished: media.releaseDate }),
        ...(media.genres.length > 0 && { genre: media.genres }),
        ...(media.officialRating && { contentRating: media.officialRating }),
        ...(media.numberOfSeasons && { numberOfSeasons: media.numberOfSeasons }),
        ...(aggregateRating && { aggregateRating }),
      }
      break
    case "GAME":
      mainEntity = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: media.title,
        ...(media.originalTitle && { alternateName: media.originalTitle }),
        description: media.synopsisFr || undefined,
        ...(media.posterUrl && media.posterUrl !== "/placeholder-poster.jpg" && { image: media.posterUrl }),
        url: pageUrl,
        inLanguage: "fr",
        ...(media.releaseDate && { datePublished: media.releaseDate }),
        ...(media.genres.length > 0 && { genre: media.genres }),
        ...(media.platforms.length > 0 && { gamePlatform: media.platforms }),
        ...(media.officialRating && { contentRating: media.officialRating }),
        ...(aggregateRating && { aggregateRating }),
      }
      break
    case "BOOK":
      mainEntity = {
        "@context": "https://schema.org",
        "@type": "Book",
        name: media.title,
        ...(media.originalTitle && { alternateName: media.originalTitle }),
        description: media.synopsisFr || undefined,
        ...(media.posterUrl && media.posterUrl !== "/placeholder-poster.jpg" && { image: media.posterUrl }),
        url: pageUrl,
        inLanguage: "fr",
        ...(media.releaseDate && { datePublished: media.releaseDate }),
        ...(media.genres.length > 0 && { genre: media.genres }),
        ...(aggregateRating && { aggregateRating }),
      }
      break
    default:
      mainEntity = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: media.title,
        description: media.synopsisFr || undefined,
        url: pageUrl,
      }
  }

  // FAQPage — answers the dominant "[titre] à partir de quel âge ?" intent
  // with the SAME wording as the on-page "Réponse rapide" (single source via
  // buildQuickAnswer). For pre-release/provisional titles the answer stays an
  // honest age estimate with zero content claims (hideContentAnalysis).
  const qa = buildQuickAnswer({ ...media, hideContentAnalysis })
  // Second Q&A: the age RATIONALE ("pourquoi cet âge ?"). Same wording as the
  // on-page "Pourquoi cet âge ?" panel (single source via buildAgeRationale),
  // so answer engines can cite the reasoning, not just the number.
  const rationale = buildAgeRationale({ ...media, hideContentAnalysis })
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: qa.question,
        acceptedAnswer: { "@type": "Answer", text: qa.answer },
      },
      ...(rationale.show && rationale.faqQuestion
        ? [
            {
              "@type": "Question",
              name: rationale.faqQuestion,
              acceptedAnswer: { "@type": "Answer", text: rationale.plainText },
            },
          ]
        : []),
    ],
  }

  return { breadcrumb, mainEntity, faqPage }
}

// Single source for the three JSON-LD scripts — both the dashboard and the
// classic body must emit identical structured data.
function MediaJsonLd({ data }: { data: ReturnType<typeof buildJsonLd> }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data.breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data.mainEntity) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data.faqPage) }}
      />
    </>
  )
}

export default async function MediaPage({ params }: MediaPageProps) {
  const { id } = await params
  const { type, id: rawId } = parseMediaRouteId(id)

  let media: DatabaseMediaItem | null = null
  let source: "mock" | "external" | "database" = "mock"
  let dbId: string | null = null // Track actual database UUID for reactions

  // First, try to fetch from database (works with UUID or external IDs)
  media = await fetchFromDatabase(rawId)
  if (media) {
    source = "database"
    dbId = media.id // This is the actual database UUID
  }

  // If not in database and no type prefix, check mock data
  if (!media && !type) {
    media = mockMediaItems.find((m) => m.id === rawId) || null
  }

  // If still not found and has type prefix, try external APIs
  if (!media && type) {
    source = "external"
    try {
      if (type === "MOVIE") {
        const movieId = parseInt(rawId)
        if (Number.isNaN(movieId)) throw new Error("Invalid movie id")
        const movie = await getMovieDetails(movieId)
        const certification = getFrenchCertification(movie.release_dates)
        const director = getDirector(movie.credits)
        media = {
          id: movie.id.toString(),
          title: movie.title,
          originalTitle: movie.original_title,
          type: "MOVIE",
          releaseDate: movie.release_date || null,
          posterUrl: getImageUrl(movie.poster_path, ImageSize.poster.large),
          synopsisFr: movie.overview || null,
          officialRating: mapCertificationToInternal(certification),
          expertAgeRec: null,
          communityAgeRec: null,
          duration: movie.runtime || undefined,
          director: director || undefined,
          genres: movie.genres.map((g) => g.name),
          platforms: [],
          topics: [],
          contentMetrics: {
            violence: 0,
            sexNudity: 0,
            language: 0,
            consumerism: 0,
            substanceUse: 0,
            positiveMessages: 0,
            roleModels: 0,
            whatParentsNeedToKnow: [],
          },
          reviews: [],
        }
      } else if (type === "TV") {
        const tvId = parseInt(rawId)
        if (Number.isNaN(tvId)) throw new Error("Invalid tv id")
        const show = await getTVDetails(tvId)
        const rating = getTVFrenchRating(show.content_ratings)
        media = {
          id: show.id.toString(),
          title: show.name,
          originalTitle: show.original_name,
          type: "TV",
          releaseDate: show.first_air_date || null,
          posterUrl: getImageUrl(show.poster_path, ImageSize.poster.large),
          synopsisFr: show.overview || null,
          officialRating: mapCertificationToInternal(rating),
          expertAgeRec: null,
          communityAgeRec: null,
          duration: show.episode_run_time?.[0] || undefined,
          genres: show.genres.map((g) => g.name),
          platforms: show.networks?.map((n) => n.name) || [],
          topics: [],
          contentMetrics: {
            violence: 0,
            sexNudity: 0,
            language: 0,
            consumerism: 0,
            substanceUse: 0,
            positiveMessages: 0,
            roleModels: 0,
            whatParentsNeedToKnow: [],
          },
          reviews: [],
        }
      } else if (type === "GAME") {
        const gameId = parseInt(rawId)
        if (Number.isNaN(gameId)) throw new Error("Invalid game id")
        const game = await getGameDetails(gameId)
        if (!game) throw new Error("Game not found")
        const g = transformGame(game)
        media = {
          id: g.id,
          title: g.title,
          type: "GAME",
          releaseDate: g.releaseDate,
          posterUrl: g.posterUrl,
          synopsisFr: g.synopsisFr,
          officialRating: g.officialRating,
          pegiDescriptors: g.pegiDescriptors ?? [],
          expertAgeRec: g.expertAgeRec,
          communityAgeRec: null,
          director: g.developer || undefined,
          genres: g.genres,
          platforms: g.platforms,
          topics: g.themes,
          gameModes: g.gameModes,
          contentMetrics: {
            violence: 0,
            sexNudity: 0,
            language: 0,
            consumerism: 0,
            substanceUse: 0,
            positiveMessages: 0,
            roleModels: 0,
            whatParentsNeedToKnow: [],
          },
          reviews: [],
        }
      } else if (type === "BOOK") {
        const volume = await getBookDetails(rawId)
        const b = transformBook(volume)
        media = {
          id: b.id,
          title: b.title,
          originalTitle: b.originalTitle,
          type: "BOOK",
          releaseDate: b.releaseDate,
          posterUrl: b.posterUrl,
          synopsisFr: b.synopsisFr,
          officialRating: b.officialRating,
          expertAgeRec: b.expertAgeRec,
          communityAgeRec: null,
          director: b.author || undefined,
          genres: b.genres,
          platforms: [],
          topics: [],
          contentMetrics: {
            violence: 0,
            sexNudity: 0,
            language: 0,
            consumerism: 0,
            substanceUse: 0,
            positiveMessages: 0,
            roleModels: 0,
            whatParentsNeedToKnow: [],
          },
          reviews: [],
        }
      } else {
        // APP not supported yet
        media = null
      }
    } catch {
      media = null
    }

    // If external fetch fails (e.g., missing API keys), fall back to mock item if present
    if (!media) {
      media = mockMediaItems.find((m) => m.id === rawId && m.type === type) || null
      if (media) source = "mock"
    }
  }

  if (!media) {
    notFound()
  }

  // Watch providers and trailer are now fetched client-side via /api/media/[id]/extras
  // This eliminates the 1-5s TMDB blocking from server render

  // Most admin state is resolved client-side (useSession) inside the widgets.
  // This route is dynamic anyway (dynamic [id] segment + the root layout's
  // auth()), so the one server-side isAdmin() read below — gating the V3
  // dashboard body — is free; `revalidate` here was already inert.

  // Pre-release / provisional fiches: we have NOT evaluated the title, so
  // every content-analysis surface (réponse rapide, metric bars, parent
  // prompts, AggregateRating, content JSON-LD) must stay silent — only the
  // age estimate (badged "à confirmer") shows. See @/lib/release-status.
  const hideContentAnalysis = shouldHideContentAnalysis({
    releaseDate: media.releaseDate,
    isProvisional: media.isProvisional,
    releaseStatus: media.releaseStatus,
  })

  // JSON-LD structured data
  const jsonLd = buildJsonLd(media, toMediaRouteId(media.type, media.id), hideContentAnalysis)
  const quickAnswer = buildQuickAnswer({ ...media, hideContentAnalysis })
  // "Pourquoi cet âge ?" rationale — shown on hover/focus of the age badge in
  // the hero (MediaHeroEditable) and mirrored into the FAQ JSON-LD so answer
  // engines can cite the reasoning. Single source: buildAgeRationale.
  const ageRationale = buildAgeRationale({ ...media, hideContentAnalysis })

  // ===== V3 dashboard as the public fiche — same URL, same metadata/JSON-LD,
  // new body. Admins get it now (real-URL preview); everyone once
  // MEDIA_V3_PUBLIC flips on (mediaV3Enabled = flag || isAdmin). Reading auth
  // here is free: this route is already dynamic (dynamic [id] segment + the
  // root layout's auth()), so there is no ISR to lose. Movies, TV and games
  // only — books/manga and off-catalog titles keep the classic body below.
  const wantsDashboard =
    source === "database" &&
    dbId !== null &&
    (media.type === "MOVIE" || media.type === "TV" || media.type === "GAME") &&
    mediaV3Enabled(await isAdmin())

  if (wantsDashboard) {
    const dash = await getDashboardMedia(rawId)
    if (dash) {
      return (
        <>
          <MediaJsonLd data={jsonLd} />
          <FicheDataProvider mediaId={dash.id} mediaType={dash.type}>
            <MediaDashboard
              media={dash}
              dbId={dash.id}
              hideAnalysis={hideContentAnalysis}
              quickAnswer={{ question: quickAnswer.question, answer: quickAnswer.answer }}
              breadcrumb={<DashboardBreadcrumb type={dash.type} title={dash.title} />}
            />
          </FicheDataProvider>
        </>
      )
    }
  }

  // Shared white-card styling for the warm page (cards float on the cream bg).
  const warmCard = {
    background: "var(--color-warm-card)",
    border: "1px solid var(--color-warm-line)",
    boxShadow: "0 1px 2px rgba(58,46,34,.05), 0 14px 34px -18px rgba(58,46,34,.18)",
  } as const

  // Not-yet-released: surface "Au cinéma / Sortie le {date}" in the bar.
  const isUpcoming = isUnreleased(media.releaseDate) || isUnreleasedStatus(media.releaseStatus)
  const releaseDateLabel = media.releaseDate ? formatDateFr(media.releaseDate) : null

  // "Vous l'avez vu ?" — phrased per media type so it reads naturally.
  const seenQuestion =
    media.type === "GAME"
      ? "Vous y avez joué ?"
      : media.type === "BOOK" || media.type === "MANGA"
        ? "Vous l'avez lu ?"
        : "Vous l'avez vu ?"

  return (
    <div className="min-h-screen" style={{ background: "var(--color-warm-bg)" }}>
      {/* JSON-LD Structured Data */}
      <MediaJsonLd data={jsonLd} />

      <FicheDataProvider mediaId={dbId} mediaType={media.type}>
        {/* Collapsing summary bar — slides in once the hero scrolls behind
            the header (fixed overlay, no layout shift). */}
        <MediaDashboardBar
          mediaId={dbId}
          mediaType={media.type}
          title={media.title}
          posterUrl={media.posterUrl}
          expertAgeRec={media.expertAgeRec}
          isProvisional={media.isProvisional}
          hideContentAnalysis={hideContentAnalysis}
          releaseDateLabel={releaseDateLabel}
          director={media.director || null}
          isUpcoming={isUpcoming}
        />

      {/* ===== HERO — verdict-first horizontal card on a warm wash ===== */}
      <section id="fiche-hero" className="relative" style={{ background: "var(--color-warm-bg)" }}>
        {/* Decorative warm wash at the top. Replaces the old per-hero blurred
            backdrop: the redesign favours a clean, contained hero card. The
            poster's own sensitivity blur (BlurredPoster) is unchanged. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72"
          style={{
            background:
              "linear-gradient(180deg, rgba(209, 106, 74, 0.08) 0%, transparent 70%)",
          }}
        />

        <div className="container mx-auto px-4 pt-6 pb-10 relative">
          <BackButton className="mb-5" />

          <div
            className="rounded-2xl p-5 sm:p-6 lg:p-7"
            style={{
              ...warmCard,
              boxShadow:
                "0 1px 2px rgba(58,46,34,.05), 0 18px 40px -22px rgba(58,46,34,.28)",
            }}
          >
            {/* poster · main · family panel — collapses to 2-col then stacked */}
            <div className="grid gap-6 lg:gap-7 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_320px] lg:items-start">
              {/* Poster */}
              <div className="mx-auto w-40 sm:w-48 lg:mx-0 lg:w-full">
                <div
                  className="relative aspect-[2/3] rounded-xl overflow-hidden"
                  style={{ boxShadow: "0 18px 36px rgba(0,0,0,0.16)" }}
                >
                  <BlurredPoster
                    src={media.posterUrl}
                    alt={media.title}
                    expertAgeRec={media.expertAgeRec}
                    violenceScore={media.contentMetrics?.violence}
                    mediaType={media.type}
                    sizes="(max-width: 640px) 160px, (max-width: 1024px) 192px, 210px"
                    priority
                  />
                </div>
              </div>

              {/* Main column */}
              <div className="min-w-0" style={{ color: "var(--color-warm-ink)" }}>
                <MediaHeroEditable
                  mediaId={media.id}
                  type={media.type}
                  officialRating={media.officialRating}
                  title={media.title}
                  synopsisFr={media.synopsisFr}
                  expertAgeRec={media.expertAgeRec}
                  genres={media.genres}
                  director={media.director || null}
                  duration={media.duration || null}
                  releaseDate={media.releaseDate}
                  originalTitle={media.originalTitle || null}
                  reviews={media.reviews}
                  isProvisional={media.isProvisional}
                  ageRationale={ageRationale}
                />

                {/* Platforms for games */}
                {media.type === "GAME" && media.platforms.length > 0 && (
                  <div className="mt-1 mb-2">
                    <PlatformIcons platforms={media.platforms} variant="hero" />
                  </div>
                )}

                {/* Où le regarder + bande-annonce — loaded client-side */}
                <WatchProvidersClient mediaId={dbId} mediaType={media.type} className="mt-4" />

                {/* Favori · à voir · avis */}
                <div className="mt-4">
                  <MediaPageClient mediaId={media.id} mediaTitle={media.title} showActions={!!dbId} />
                </div>
              </div>

              {/* Family panel — "Repères pour ma famille". Hidden pre-release:
                  the fit verdict leans on content we haven't evaluated yet.
                  Spans full width on lg (2-col), own column on xl (3-col). */}
              {dbId && !hideContentAnalysis && (
                <div className="lg:col-span-2 xl:col-span-1">
                  <FamilyFitHero mediaId={dbId} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONTENT — single full-width column of cards ===== */}
      <div className="container mx-auto px-4 pb-16">
        <div className="flex flex-col gap-5 lg:gap-6">
          {/* Réponse rapide — generic answer (kept in the DOM as the FAQ
              rich-result source) + the personalized "Adapté à ma famille ?"
              companion when logged in (collapses to full width otherwise). */}
          <div className="rounded-2xl p-5 sm:p-6" style={warmCard}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <p
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-warm-accent)" }}
              >
                Réponse rapide
              </p>
              <AccountChip />
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div
                className="flex-1 rounded-xl p-4"
                style={{ background: "var(--color-warm-card)", border: "1px solid var(--color-warm-line)" }}
              >
                <h2
                  className="font-serif text-lg sm:text-xl font-medium mb-1"
                  style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.02em" }}
                >
                  {quickAnswer.question}
                </h2>
                <p className="text-xs mb-2" style={{ color: "var(--color-warm-ink2)" }}>
                  Réponse générale
                </p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
                  {quickAnswer.answer}
                </p>
              </div>
              {dbId && !hideContentAnalysis && <FamilyQuickAnswer mediaId={dbId} />}
            </div>
          </div>

          {hideContentAnalysis ? (
            /* Pas encore sorti / fiche provisoire : aucune évaluation de
               contenu inventée. On reste factuel et honnête, l'âge affiché
               est une estimation à confirmer. */
            <div className="rounded-2xl p-5 sm:p-6" style={warmCard}>
              <p
                className="text-[11px] font-semibold uppercase tracking-wide mb-1"
                style={{ color: "var(--color-warm-accent)" }}
              >
                À venir
              </p>
              <h2
                className="font-serif text-lg font-medium mb-2"
                style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.02em" }}
              >
                {media.releaseDate
                  ? `Sortie prévue le ${formatDateFr(media.releaseDate)}`
                  : "Pas encore sorti"}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-warm-ink2)" }}>
                {`Ce ${mediaTypeLabels[media.type]?.toLowerCase() || "contenu"} n'est pas encore sorti. `}
                {media.expertAgeRec
                  ? `L'âge indiqué (dès ${media.expertAgeRec} ans) est une estimation à confirmer. `
                  : ""}
                {"L'évaluation détaillée du contenu (violence, langage, messages…) sera publiée après sa sortie, une fois le titre visionné."}
              </p>
            </div>
          ) : (
            <>
              {/* Ce que les parents doivent savoir */}
              <WhatParentsNeedToKnow items={media.contentMetrics.whatParentsNeedToKnow} />

              {/* Ce qui peut marquer — jeux inclus quand l'enrichissement est fiable */}
              {(media.contentMetrics.enrichmentConfidence ?? 0) >= 0.6 && (
                <SensitiveWarnings items={media.contentMetrics.sensitiveWarnings ?? []} mediaId={dbId} />
              )}

              {/* Talk to Your Kids — actuellement désactivé (rend null). */}
              <TalkToYourKids
                title={media.title}
                type={media.type}
                metrics={media.contentMetrics}
                genres={media.genres}
                topics={media.topics}
              />

              {/* Évaluation du contenu :
                  - jeux        → GameInfoCard
                  - en base     → DualMetricsDisplay (Totem vs Communauté)
                  - hors base   → ContentGrid (analyse seule, pas de communauté) */}
              {media.type === "GAME" ? (
                <>
                  <GameInfoCard
                    platforms={media.platforms}
                    genres={media.genres}
                    gameModes={"gameModes" in media ? (media as DatabaseMediaItem).gameModes : undefined}
                    consumerism={media.contentMetrics.consumerism}
                    officialRating={media.officialRating}
                    pegiDescriptors={"pegiDescriptors" in media ? (media as DatabaseMediaItem).pegiDescriptors : []}
                    expertAgeRec={media.expertAgeRec}
                  />
                  <GameMetricsDisplay
                    expertMetrics={media.contentMetrics}
                    topics={media.topics}
                  />
                </>
              ) : dbId ? (
                <DualMetricsDisplay
                  mediaId={dbId}
                  mediaTitle={media.title}
                  expertMetrics={media.contentMetrics}
                  topics={media.topics}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analyse du contenu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ContentGrid metrics={media.contentMetrics} topics={media.topics} />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ===== Contribution zone — réactions famille + avis ===== */}
          {dbId && (
            <>
              <div className="pt-3">
                <h2
                  className="font-serif text-xl sm:text-2xl font-medium"
                  style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.02em" }}
                >
                  {seenQuestion}
                </h2>
                <p className="text-sm mt-1 max-w-xl" style={{ color: "var(--color-warm-ink2)" }}>
                  Partagez les réactions de votre famille et votre avis — vous aiderez les autres parents à décider.
                </p>
              </div>
              <FamilyReactions mediaId={dbId} mediaTitle={media.title} mediaType={media.type} />
            </>
          )}

          {/* Avis des familles — standalone (Détails tab removed: type/date/
              durée/réalisateur already live in the hero). */}
          <div>
            <h2
              className="font-serif text-xl sm:text-2xl font-medium mb-4"
              style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.01em" }}
            >
              Avis des familles{media.reviews.length > 0 ? ` (${media.reviews.length})` : ""}
            </h2>
            <ReviewsSection
              reviews={media.reviews}
              mediaId={dbId ?? undefined}
              mediaTitle={media.title}
            />
          </div>

          {/* Fiche technique — only facts not already shown in the hero:
              auto-detected themes + manga format. */}
          {(media.topics.length > 0 ||
            (media.type === "MANGA" &&
              (media.volumeCount || media.chapterCount || media.demographic || media.status))) && (
            <div className="rounded-2xl p-5 sm:p-6" style={warmCard}>
              <h2
                className="font-serif text-xl sm:text-2xl font-medium mb-4"
                style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.01em" }}
              >
                {media.type === "MANGA" &&
                (media.volumeCount || media.chapterCount || media.demographic || media.status)
                  ? "Fiche technique"
                  : "Thèmes"}
              </h2>

              {media.type === "MANGA" &&
                (media.volumeCount || media.chapterCount || media.demographic || media.status) && (
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    {(media.volumeCount || media.chapterCount) && (
                      <div>
                        <h4 className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--color-warm-ink2)" }}>
                          Volumes
                        </h4>
                        <p className="font-medium" style={{ color: "var(--color-warm-ink)" }}>
                          {media.volumeCount
                            ? `${media.volumeCount} tome${media.volumeCount > 1 ? "s" : ""}`
                            : `${media.chapterCount} chapitres`}
                        </p>
                      </div>
                    )}
                    {media.demographic && (
                      <div>
                        <h4 className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--color-warm-ink2)" }}>
                          Public cible
                        </h4>
                        <p className="font-medium capitalize" style={{ color: "var(--color-warm-ink)" }}>
                          {media.demographic}
                        </p>
                      </div>
                    )}
                    {media.status && (
                      <div>
                        <h4 className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--color-warm-ink2)" }}>
                          Statut
                        </h4>
                        <p className="font-medium" style={{ color: "var(--color-warm-ink)" }}>
                          {media.status === "ongoing"
                            ? "En cours"
                            : media.status === "completed"
                              ? "Terminé"
                              : media.status === "hiatus"
                                ? "Pause"
                                : media.status}
                        </p>
                      </div>
                    )}
                  </div>
                )}

              {media.topics.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-warm-ink2)" }}>
                      Thèmes
                    </h4>
                    <MethodBadge
                      iconOnly
                      size="xs"
                      anchor="themes-detectes"
                      label="Détectés automatiquement"
                      description="Les thèmes sont détectés automatiquement à partir du contenu (synopsis, classifications, genres). Ils sont indicatifs et peuvent être affinés par les signalements de la communauté."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {media.topics.map((topic) => (
                      <span
                        key={topic}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: "var(--color-warm-bg2)", color: "var(--color-warm-ink)" }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Captures d'écran — renders its own section heading */}
          {media.screenshots && media.screenshots.length > 0 && (
            <AdminScreenshotsWrapper
              screenshots={media.screenshots}
              title={media.title}
            />
          )}

          {/* Dans le même genre — streamed via Suspense to avoid blocking render */}
          {dbId && (
            <Suspense fallback={
              <div className="rounded-2xl p-5 sm:p-6 animate-pulse" style={warmCard}>
                <div className="h-6 w-48 rounded mb-4" style={{ background: "var(--color-warm-bg2)" }} />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[2/3] rounded-lg"
                      style={{ background: "var(--color-warm-placeholder)" }}
                    />
                  ))}
                </div>
              </div>
            }>
              <div className="rounded-2xl p-5 sm:p-6" style={warmCard}>
                <h2
                  className="font-serif text-xl md:text-2xl font-medium mb-4"
                  style={{ color: "var(--color-warm-ink)", letterSpacing: "-0.02em" }}
                >
                  Titres{" "}
                  <em className="italic" style={{ color: "var(--color-warm-accent)" }}>
                    similaires
                  </em>
                </h2>
                <ApercuSimilarMedia
                  mediaId={dbId}
                  mediaType={media.type}
                  genres={media.genres}
                  topics={media.topics}
                  serifClass="font-serif"
                />
              </div>
            </Suspense>
          )}

          {/* Alternatives plus jeunes — mature game fiches only, streamed */}
          {dbId && media.type === "GAME" && media.expertAgeRec != null && media.expertAgeRec >= 14 && (
            <Suspense fallback={null}>
              <AgeAlternativesGames
                mediaId={dbId}
                title={media.title}
                genres={media.genres}
                topics={media.topics}
                currentAge={media.expertAgeRec}
              />
            </Suspense>
          )}

          {/* Signaler une correction */}
          {dbId && (
            <div className="flex justify-center pt-2">
              <ReportCorrectionButton mediaId={dbId} mediaTitle={media.title} />
            </div>
          )}

          {/* Suggestions (éléments de démonstration uniquement) */}
          {source === "mock" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vous pourriez aussi aimer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mockMediaItems
                  .filter((m) => m.id !== media.id && m.type === media.type)
                  .slice(0, 3)
                  .map((related) => (
                    <Link
                      key={related.id}
                      href={`/media/${toMediaRouteId(related.type, related.id)}`}
                      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="relative w-12 h-16 rounded overflow-hidden shrink-0">
                        <Image
                          src={related.posterUrl}
                          alt={related.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm line-clamp-1">{related.title}</p>
                        <p className="text-xs text-gray-500">
                          {related.expertAgeRec === null || related.expertAgeRec === undefined
                            ? "Âge non renseigné"
                            : `${related.expertAgeRec}+ ans`}
                        </p>
                      </div>
                    </Link>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Admin-only: jump to the V3 scoreboard dashboard preview. Self-hides
          for non-admins, so it's safe on this public/ISR page. */}
      <MediaV3Toggle variant="classic" routeId={toMediaRouteId(media.type, media.id)} />
      </FicheDataProvider>
    </div>
  )
}


