import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Clock, Calendar, Star, ExternalLink, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgeBadge, OfficialRatingBadge } from "@/components/media/AgeBadge"
import { ContentGrid } from "@/components/media/ContentGrid"
import { WhatParentsNeedToKnow } from "@/components/media/WhatParentsNeedToKnow"
import { ReviewCard, ReviewSummary } from "@/components/media/ReviewCard"
import { mockMediaItems } from "@/lib/mock-data"
import { mediaTypeLabels, formatDateFr } from "@/lib/utils"
import { notFound } from "next/navigation"

interface MediaPageProps {
  params: Promise<{ id: string }>
}

export default async function MediaPage({ params }: MediaPageProps) {
  const { id } = await params
  const media = mockMediaItems.find((m) => m.id === id)

  if (!media) {
    notFound()
  }

  const avgRating =
    media.reviews.length > 0
      ? media.reviews.reduce((acc, r) => acc + r.rating, 0) / media.reviews.length
      : 0

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
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Poster */}
            <div className="lg:w-1/3 xl:w-1/4 shrink-0">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden shadow-2xl">
                <Image
                  src={media.posterUrl}
                  alt={media.title}
                  fill
                  className="object-cover"
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

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">
                {media.title}
              </h1>

              {media.originalTitle && media.originalTitle !== media.title && (
                <p className="text-xl text-gray-400 mb-4">{media.originalTitle}</p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-gray-300 mb-6">
                {media.releaseDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDateFr(media.releaseDate)}
                  </span>
                )}
                {media.duration && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {media.duration} min
                  </span>
                )}
                {media.director && (
                  <span>Réalisé par {media.director}</span>
                )}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2 mb-6">
                {media.genres.map((genre) => (
                  <Badge key={genre} variant="outline" className="border-white/30 text-white">
                    {genre}
                  </Badge>
                ))}
              </div>

              {/* Synopsis */}
              <p className="text-gray-300 leading-relaxed mb-8 max-w-3xl">
                {media.synopsisFr}
              </p>

              {/* Age Ratings */}
              <div className="flex flex-wrap items-center gap-8 mb-8">
                <AgeBadge
                  age={media.expertAgeRec}
                  size="lg"
                  label="Âge expert"
                />
                <ReviewSummary reviews={media.reviews} />
              </div>

              {/* Platforms */}
              {media.platforms.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Disponible sur</h3>
                  <div className="flex flex-wrap gap-2">
                    {media.platforms.map((platform) => (
                      <Badge
                        key={platform}
                        className="bg-white/10 text-white border-0 hover:bg-white/20 cursor-pointer"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating Summary */}
              <div className="flex items-center gap-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                  <span className="text-2xl font-bold">{avgRating.toFixed(1)}</span>
                  <span className="text-gray-400">/ 5</span>
                </div>
                <div className="text-sm text-gray-400">
                  Basé sur {media.reviews.length} avis
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
            {/* What Parents Need to Know */}
            <WhatParentsNeedToKnow items={media.contentMetrics.whatParentsNeedToKnow} />

            {/* Tabs */}
            <Tabs defaultValue="reviews" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="reviews">Avis ({media.reviews.length})</TabsTrigger>
                <TabsTrigger value="details">Détails</TabsTrigger>
              </TabsList>

              <TabsContent value="reviews" className="space-y-4 mt-6">
                {media.reviews.length > 0 ? (
                  media.reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center text-gray-500">
                      Aucun avis pour le moment. Soyez le premier à partager votre expérience !
                    </CardContent>
                  </Card>
                )}

                <div className="pt-4">
                  <Button size="lg" className="w-full sm:w-auto">
                    Donner mon avis
                  </Button>
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
                            {media.type === "BOOK" ? "Auteur" : "Réalisateur"}
                          </h4>
                          <p className="font-medium">{media.director}</p>
                        </div>
                      )}
                    </div>

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
            {/* Content Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Analyse du contenu</CardTitle>
              </CardHeader>
              <CardContent>
                <ContentGrid metrics={media.contentMetrics} />
              </CardContent>
            </Card>

            {/* Related (placeholder) */}
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
                      href={`/media/${related.id}`}
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
                        <p className="text-xs text-gray-500">{related.expertAgeRec}+ ans</p>
                      </div>
                    </Link>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

