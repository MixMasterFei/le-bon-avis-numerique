// Revalidate every hour — balances freshness with performance
export const revalidate = 3600

import { cache, Suspense } from "react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import { BackButton } from "@/components/ui/BackButton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MediaDetailTabs } from "@/components/media/MediaDetailTabs"
import { OfficialRatingBadge } from "@/components/media/AgeBadge"
import { ContentGrid } from "@/components/media/ContentGrid"
import { DualMetricsDisplay } from "@/components/media/DualMetricsDisplay"
import { WhatParentsNeedToKnow } from "@/components/media/WhatParentsNeedToKnow"
import { ReviewsSection } from "@/components/media/ReviewsSection"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { WatchProvidersClient } from "@/components/media/WatchProvidersClient"
import { FamilyReactions } from "@/components/media/FamilyReactions"
import { FamilyFitHero } from "@/components/media/FamilyFitHero"
import { ApercuSimilarMedia } from "@/components/home-v2/ApercuSimilarMedia"

import { ReportCorrectionButton } from "@/components/media/ReportCorrectionButton"
import { PlatformIcons } from "@/components/media/PlatformIcons"
import { TalkToYourKids } from "@/components/media/TalkToYourKids"
import { GameInfoCard } from "@/components/media/GameInfoCard"
import { AdminScreenshotsWrapper } from "@/components/media/AdminScreenshotsWrapper"
import { MediaHeroEditable } from "@/components/media/MediaHeroEditable"
import { BlurredPoster } from "@/components/media/BlurredPoster"
import { HeroBackdrop } from "@/components/media/HeroBackdrop"
import { mockMediaItems } from "@/lib/mock-data"
import { mediaTypeLabels, formatDateFr } from "@/lib/utils"
import { notFound } from "next/navigation"
import { parseMediaRouteId, toMediaRouteId } from "@/lib/media-route"
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
import { isAdmin as checkIsAdmin } from "@/lib/auth"
import type { MediaItem as MockMediaItem } from "@/lib/types"

interface MediaPageProps {
  params: Promise<{ id: string }>
}

// Extended type for database items with screenshots
interface DatabaseMediaItem extends MockMediaItem {
  numberOfSeasons?: number | null
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
      posterUrl: dbMedia.posterUrl || "/placeholder-poster.jpg",
      synopsisFr: dbMedia.synopsisFr,
      officialRating: dbMedia.officialRating,
      expertAgeRec: dbMedia.expertAgeRec,
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
}

const typeCategoryPaths: Record<string, { path: string; label: string }> = {
  MOVIE: { path: "/films", label: "Films" },
  TV: { path: "/series", label: "Séries" },
  GAME: { path: "/jeux", label: "Jeux vidéo" },
  BOOK: { path: "/livres", label: "Livres" },
  APP: { path: "/apps", label: "Applications" },
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: MediaPageProps): Promise<Metadata> {
  const { id } = await params
  const { id: rawId } = parseMediaRouteId(id)

  const media = await fetchFromDatabase(rawId)
  if (!media) return {}

  const ageStr = media.expertAgeRec && media.expertAgeRec > 0
    ? ` — Dès ${media.expertAgeRec} ans`
    : ""

  const title = `${media.title}${ageStr}`

  const typeLabel = typeLabels[media.type] || "Média"
  const description = media.synopsisFr
    ? media.synopsisFr.slice(0, 155) + (media.synopsisFr.length > 155 ? "…" : "")
    : `${typeLabel} analysé par Totem Avisé. Découvrez notre avis détaillé et recommandation d'âge pour les familles.`

  const ogType = media.type === "MOVIE" ? "video.movie"
    : media.type === "TV" ? "video.tv_show"
    : "website"

  return {
    title,
    description,
    alternates: {
      canonical: `/media/${id}`,
    },
    keywords: [
      ...media.genres.slice(0, 5),
      typeLabel,
      "avis parents",
      "à partir de quel âge",
      media.title,
    ],
    openGraph: {
      title: `${media.title}${ageStr} | Totem Avisé`,
      description,
      type: ogType as "video.movie" | "video.tv_show" | "website",
      ...(media.posterUrl && media.posterUrl !== "/placeholder-poster.jpg" && {
        images: [{ url: media.posterUrl, width: 500, height: 750, alt: media.title }],
      }),
      locale: "fr_FR",
      siteName: "Totem Avisé",
    },
    twitter: {
      card: "summary_large_image",
      title: `${media.title}${ageStr}`,
      description,
      ...(media.posterUrl && media.posterUrl !== "/placeholder-poster.jpg" && {
        images: [media.posterUrl],
      }),
    },
  }
}

// Build JSON-LD structured data for a media item
function buildJsonLd(media: DatabaseMediaItem, routeId: string) {
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

  const aggregateRating = internalCount > 0
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

  return { breadcrumb, mainEntity }
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
          expertAgeRec: g.expertAgeRec,
          communityAgeRec: null,
          director: g.developer || undefined,
          genres: g.genres,
          platforms: g.platforms,
          topics: g.themes,
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

  const avgRating =
    media.reviews?.length
      ? media.reviews.reduce((acc, r) => acc + r.rating, 0) / media.reviews.length
      : 0

  const adminUser = await checkIsAdmin()

  // JSON-LD structured data
  const jsonLd = buildJsonLd(media, id)

  return (
    <div className="min-h-screen bg-background">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.mainEntity) }}
      />

      {/* Hero Section — warm cream with blurred backdrop overlay */}
      <section
        className="relative"
        style={{ background: "var(--color-warm-bg)" }}
      >
        {/* Blurred backdrop + warm cream overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <HeroBackdrop
            src={media.posterUrl}
            expertAgeRec={media.expertAgeRec}
            violenceScore={media.contentMetrics?.violence}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(209, 106, 74, 0.10) 0%, rgba(245, 241, 233, 0.82) 45%, var(--color-warm-bg) 100%)",
            }}
          />
        </div>

        <div className="container mx-auto px-4 py-8 relative">
          <BackButton className="mb-8" />

          <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
            {/* Poster */}
            <div className="lg:w-1/4 shrink-0">
              <div
                className="relative aspect-[2/3] rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.18)" }}
              >
                <BlurredPoster
                  src={media.posterUrl}
                  alt={media.title}
                  expertAgeRec={media.expertAgeRec}
                  violenceScore={media.contentMetrics?.violence}
                  mediaType={media.type}
                  priority
                />
              </div>
            </div>

            {/* Info */}
            <div
              className="flex-1 min-w-0"
              style={{ color: "var(--color-warm-ink)" }}
            >
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: "var(--color-warm-bg2)",
                    color: "var(--color-warm-ink)",
                  }}
                >
                  {mediaTypeLabels[media.type]}
                </span>
                <OfficialRatingBadge
                  rating={media.officialRating}
                  type={media.type}
                  showLabel
                />
              </div>

              <MediaHeroEditable
                isAdmin={adminUser}
                mediaId={media.id}
                title={media.title}
                synopsisFr={media.synopsisFr}
                expertAgeRec={media.expertAgeRec}
                genres={media.genres}
                director={media.director || null}
                duration={media.duration || null}
                releaseDate={media.releaseDate}
                originalTitle={media.originalTitle || null}
                reviews={media.reviews}
              />

              {/* Platforms for games */}
              {media.type === "GAME" && media.platforms.length > 0 && (
                <div className="mb-6">
                  <PlatformIcons platforms={media.platforms} variant="hero" />
                </div>
              )}

              {/* Watch Providers & Trailer - loaded client-side */}
              <WatchProvidersClient mediaId={dbId} mediaType={media.type} className="mb-4" />

              {/* Favorite, Watchlist & Review Actions */}
              <MediaPageClient mediaId={media.id} mediaTitle={media.title} showActions={!!dbId} />

              {/* Rating Summary */}
              {(media.reviews?.length || 0) > 0 ? (
                <div
                  className="flex items-center gap-6 p-4 rounded-xl"
                  style={{
                    background: "var(--color-warm-card)",
                    border: "1px solid var(--color-warm-line)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Star className="h-6 w-6 fill-amber-500 text-amber-500" />
                    <span
                      className="font-serif text-2xl font-medium"
                      style={{
                        color: "var(--color-warm-ink)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {avgRating.toFixed(1)}
                    </span>
                    <span style={{ color: "var(--color-warm-ink2)" }}>/ 5</span>
                  </div>
                  <div
                    className="text-sm"
                    style={{ color: "var(--color-warm-ink2)" }}
                  >
                    Basé sur {media.reviews.length} avis
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl"
                  style={{
                    background: "var(--color-warm-card)",
                    border: "1px solid var(--color-warm-line)",
                  }}
                >
                  <Star
                    className="h-5 w-5"
                    style={{ color: "var(--color-warm-ink2)" }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: "var(--color-warm-ink2)" }}
                  >
                    Aucun avis pour le moment — soyez le premier à donner votre avis !
                  </span>
                </div>
              )}
            </div>

            {/* Family Fit — hero column */}
            {dbId && (
              <div className="lg:w-72 xl:w-80 shrink-0">
                <FamilyFitHero mediaId={dbId} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* What Parents Need to Know - NOT for games (they have GameInfoCard) */}
            {media.type !== "GAME" && (
              <WhatParentsNeedToKnow items={media.contentMetrics.whatParentsNeedToKnow} />
            )}

            {/* Talk to Your Kids - for movies/TV/books only (not games) */}
            <TalkToYourKids
              title={media.title}
              type={media.type}
              metrics={media.contentMetrics}
              genres={media.genres}
              topics={media.topics}
            />

            {/* Screenshots - from local database */}
            {media.screenshots && media.screenshots.length > 0 && (
              <AdminScreenshotsWrapper
                screenshots={media.screenshots}
                title={media.title}
                isAdmin={adminUser}
              />
            )}

            <MediaDetailTabs
              reviewsCount={media.reviews?.length || 0}
              reviewsContent={<ReviewsSection reviews={media.reviews} />}
              detailsContent={
                <div
                  className="rounded-2xl p-6 space-y-4"
                  style={{
                    background: "var(--color-warm-card)",
                    border: "1px solid var(--color-warm-line)",
                  }}
                >
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <h4
                        className="text-xs font-semibold mb-1 uppercase tracking-wide"
                        style={{ color: "var(--color-warm-ink2)" }}
                      >
                        Type
                      </h4>
                      <p className="font-medium" style={{ color: "var(--color-warm-ink)" }}>
                        {mediaTypeLabels[media.type]}
                      </p>
                    </div>
                    {media.releaseDate && (
                      <div>
                        <h4
                          className="text-xs font-semibold mb-1 uppercase tracking-wide"
                          style={{ color: "var(--color-warm-ink2)" }}
                        >
                          Date de sortie
                        </h4>
                        <p className="font-medium" style={{ color: "var(--color-warm-ink)" }}>
                          {formatDateFr(media.releaseDate)}
                        </p>
                      </div>
                    )}
                    {media.duration && (
                      <div>
                        <h4
                          className="text-xs font-semibold mb-1 uppercase tracking-wide"
                          style={{ color: "var(--color-warm-ink2)" }}
                        >
                          Durée
                        </h4>
                        <p className="font-medium" style={{ color: "var(--color-warm-ink)" }}>
                          {media.duration} minutes
                        </p>
                      </div>
                    )}
                    {media.director && (
                      <div>
                        <h4
                          className="text-xs font-semibold mb-1 uppercase tracking-wide"
                          style={{ color: "var(--color-warm-ink2)" }}
                        >
                          {media.type === "BOOK"
                            ? "Auteur"
                            : media.type === "GAME"
                              ? "Développeur"
                              : "Réalisateur"}
                        </h4>
                        <p className="font-medium" style={{ color: "var(--color-warm-ink)" }}>
                          {media.director}
                        </p>
                      </div>
                    )}
                  </div>

                  {media.type === "GAME" && media.platforms.length > 0 && (
                    <PlatformIcons platforms={media.platforms} variant="full" />
                  )}

                  {media.topics.length > 0 && (
                    <div>
                      <h4
                        className="text-xs font-semibold mb-2 uppercase tracking-wide"
                        style={{ color: "var(--color-warm-ink2)" }}
                      >
                        Thèmes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {media.topics.map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: "var(--color-warm-bg2)",
                              color: "var(--color-warm-ink)",
                            }}
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              }
            />

            {/* Similar Media — streamed via Suspense to avoid blocking page render */}
            {dbId && (
              <Suspense fallback={
                <div className="animate-pulse">
                  <div
                    className="h-6 w-48 rounded mb-4"
                    style={{ background: "var(--color-warm-bg2)" }}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-[2/3] rounded-lg"
                        style={{ background: "var(--color-warm-placeholder)" }}
                      />
                    ))}
                  </div>
                </div>
              }>
                <div>
                  <div
                    className="mb-6"
                    style={{ borderTop: "1px solid var(--color-warm-line)" }}
                  />
                  <h2
                    className="font-serif text-xl md:text-2xl font-medium mb-4"
                    style={{
                      color: "var(--color-warm-ink)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Dans le même{" "}
                    <em
                      className="italic"
                      style={{ color: "var(--color-warm-accent)" }}
                    >
                      genre
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Game Info Card - for games only */}
            {media.type === "GAME" && (
              <GameInfoCard
                platforms={media.platforms}
                genres={media.genres}
                consumerism={media.contentMetrics.consumerism}
                violence={media.contentMetrics.violence}
              />
            )}

            {/* Family Reactions */}
            {dbId && <FamilyReactions mediaId={dbId} mediaTitle={media.title} />}

            {/* Dual Content Metrics (Expert vs Community) - NOT for games */}
            {dbId && media.type !== "GAME" && (
              <DualMetricsDisplay
                mediaId={dbId}
                mediaTitle={media.title}
                expertMetrics={media.contentMetrics}
              />
            )}

            {/* Fallback to single ContentGrid if no dbId - NOT for games */}
            {!dbId && media.type !== "GAME" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Analyse du contenu</CardTitle>
                </CardHeader>
                <CardContent>
                  <ContentGrid metrics={media.contentMetrics} />
                </CardContent>
              </Card>
            )}

            {/* Report Correction Button */}
            {dbId && (
              <ReportCorrectionButton mediaId={dbId} mediaTitle={media.title} />
            )}

            {/* Related (only for demo/mock items for now) */}
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
      </div>
    </div>
  )
}


