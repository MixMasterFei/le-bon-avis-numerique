// Force dynamic rendering to avoid stale cached data
export const dynamic = 'force-dynamic'

import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import { BackButton } from "@/components/ui/BackButton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OfficialRatingBadge } from "@/components/media/AgeBadge"
import { ContentGrid } from "@/components/media/ContentGrid"
import { DualMetricsDisplay } from "@/components/media/DualMetricsDisplay"
import { WhatParentsNeedToKnow } from "@/components/media/WhatParentsNeedToKnow"
import { ReviewSummary } from "@/components/media/ReviewCard"
import { ReviewsSection } from "@/components/media/ReviewsSection"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { WatchProviders } from "@/components/media/WatchProviders"
import { FamilyReactions } from "@/components/media/FamilyReactions"
import { MediaActions } from "@/components/media/MediaActions"
import { ReportCorrectionButton } from "@/components/media/ReportCorrectionButton"
import { PlatformIcons } from "@/components/media/PlatformIcons"
import { TalkToYourKids } from "@/components/media/TalkToYourKids"
import { GameInfoCard } from "@/components/media/GameInfoCard"
import { AdminScreenshotsWrapper } from "@/components/media/AdminScreenshotsWrapper"
import { MediaHeroEditable } from "@/components/media/MediaHeroEditable"
import { BlurredPoster } from "@/components/media/BlurredPoster"
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
  getMovieWatchProviders,
  getTVWatchProviders,
  getMovieVideos,
  getTVVideos,
  getBestTrailer,
  type TMDBWatchProviderResult,
  type TMDBVideo,
} from "@/lib/tmdb"
import { getGameDetails, transformGame } from "@/lib/igdb"
import { getBookDetails, transformBook } from "@/lib/google-books"
import { prisma } from "@/lib/prisma"
import { isAdmin as checkIsAdmin } from "@/lib/auth"
import type { MockMediaItem } from "@/lib/mock-data"

interface MediaPageProps {
  params: Promise<{ id: string }>
}

// Extended type for database items with screenshots
interface DatabaseMediaItem extends MockMediaItem {
  screenshots?: { id: string; url: string; width: number | null; height: number | null; order: number }[]
}

// Helper to fetch from database directly
async function fetchFromDatabase(id: string): Promise<DatabaseMediaItem | null> {
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
      duration: dbMedia.duration || undefined,
      director: dbMedia.director || undefined,
      genres: dbMedia.genres || [],
      platforms: dbMedia.platforms || [],
      topics: dbMedia.topics || [],
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
      reviews: dbMedia.reviews.map((r) => ({
        id: r.id,
        role: r.role as "PARENT" | "KID" | "EDUCATOR",
        rating: r.rating,
        ageSuggestion: r.ageSuggestion ?? 0,
        comment: r.comment || "",
        createdAt: r.createdAt.toISOString(),
        editedAt: (r as any).editedAt?.toISOString() || null,
        user: r.user ? { id: r.user.id, name: r.user.name, image: r.user.image } : undefined,
        familyMember: (r as any).familyMember ? { id: (r as any).familyMember.id, name: (r as any).familyMember.name, avatarEmoji: (r as any).familyMember.avatarEmoji } : null,
      })),
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
}

export default async function MediaPage({ params }: MediaPageProps) {
  const { id } = await params
  const { type, id: rawId } = parseMediaRouteId(id)

  let media: DatabaseMediaItem | null = null
  let source: "mock" | "external" | "database" = "mock"
  let watchProviders: TMDBWatchProviderResult | null = null
  let trailer: TMDBVideo | null = null
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

  // Fetch watch providers and trailer for movies/TV from TMDB
  // This works for both database items (with tmdbId) and external API items
  const mediaType = media.type
  if (mediaType === "MOVIE" || mediaType === "TV") {
    // Get the TMDB ID - either from database record or from rawId for external
    let tmdbId: number | null = null

    if (source === "database") {
      // For database items, we need to query for the tmdbId
      const dbItem = await prisma.mediaItem.findUnique({
        where: { id: media.id },
        select: { tmdbId: true }
      })
      tmdbId = dbItem?.tmdbId || null
    } else if (source === "external") {
      tmdbId = parseInt(rawId)
    }

    if (tmdbId && !isNaN(tmdbId)) {
      // Fetch providers and videos in parallel
      const [providersResult, videosResult] = await Promise.all([
        mediaType === "MOVIE"
          ? getMovieWatchProviders(tmdbId)
          : getTVWatchProviders(tmdbId),
        mediaType === "MOVIE"
          ? getMovieVideos(tmdbId)
          : getTVVideos(tmdbId)
      ])

      watchProviders = providersResult
      trailer = getBestTrailer(videosResult)
    }
  }

  const avgRating =
    media.reviews?.length
      ? media.reviews.reduce((acc, r) => acc + r.rating, 0) / media.reviews.length
      : 0

  const adminUser = await checkIsAdmin()

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Backdrop */}
      <div className="relative bg-gradient-to-b from-gray-900 to-gray-800">
        {/* Backdrop Image */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={media.posterUrl}
            alt=""
            fill
            className="object-cover opacity-20 blur-xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent" />
        </div>

        <div className="container mx-auto px-4 py-8 relative">
          {/* Back Button */}
          <BackButton className="mb-8" />

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Poster */}
            <div className="lg:w-1/3 xl:w-1/4 shrink-0">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                <BlurredPoster
                  src={media.posterUrl}
                  alt={media.title}
                  expertAgeRec={media.expertAgeRec}
                  priority
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-white">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {mediaTypeLabels[media.type]}
                </Badge>
                <OfficialRatingBadge
                  rating={media.officialRating}
                  type={media.type}
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
              />

              {/* Platforms for games */}
              {media.type === "GAME" && media.platforms.length > 0 && (
                <div className="mb-6">
                  <PlatformIcons platforms={media.platforms} variant="hero" />
                </div>
              )}

              <ReviewSummary reviews={media.reviews} />

              {/* Watch Providers & Trailer - Compact */}
              <WatchProviders providers={watchProviders} trailer={trailer} className="mb-4" />

              {/* Favorite & Watchlist Actions */}
              {dbId && <MediaActions mediaId={dbId} className="mb-6" />}

              {/* Rating Summary */}
              <div className="flex items-center gap-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                  <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
                  <span className="text-gray-400">/ 5</span>
                </div>
                <div className="text-sm text-gray-400">
                  Basé sur {media.reviews?.length || 0} avis
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
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

            {/* Tabs */}
            <Tabs defaultValue="reviews" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="reviews">Avis ({media.reviews?.length || 0})</TabsTrigger>
                <TabsTrigger value="details">Détails</TabsTrigger>
              </TabsList>

              <TabsContent value="reviews" className="space-y-4 mt-6">
                <ReviewsSection reviews={media.reviews} />

                <div className="pt-4">
                  <MediaPageClient mediaId={media.id} mediaTitle={media.title} />
                </div>
              </TabsContent>

              <TabsContent value="details" className="mt-6">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-1">Type</h4>
                        <p className="font-medium">{mediaTypeLabels[media.type]}</p>
                      </div>
                      {media.releaseDate && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">Date de sortie</h4>
                          <p className="font-medium">{formatDateFr(media.releaseDate)}</p>
                        </div>
                      )}
                      {media.duration && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">Durée</h4>
                          <p className="font-medium">{media.duration} minutes</p>
                        </div>
                      )}
                      {media.director && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-1">
                            {media.type === "BOOK" ? "Auteur" : media.type === "GAME" ? "Développeur" : "Réalisateur"}
                          </h4>
                          <p className="font-medium">{media.director}</p>
                        </div>
                      )}
                    </div>

                    {/* Platforms with nice styling for games */}
                    {media.type === "GAME" && media.platforms.length > 0 && (
                      <PlatformIcons platforms={media.platforms} variant="full" />
                    )}

                    {media.topics.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Thèmes</h4>
                        <div className="flex flex-wrap gap-2">
                          {media.topics.map((topic) => (
                            <Badge key={topic} variant="secondary">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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


