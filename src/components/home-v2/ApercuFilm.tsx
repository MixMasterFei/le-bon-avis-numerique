// Server component. Do NOT add "use client" here: SimilarMedia is a
// server component that imports prisma, and importing it from a
// client module silently breaks the hydration tree — every other
// session-aware widget (Header avatar, FamilyFitCard, FamilyReactions)
// stops activating because React never finishes reconciling the tree.

import Image from "next/image"
import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OfficialRatingBadge } from "@/components/media/AgeBadge"
import { WhatParentsNeedToKnow } from "@/components/media/WhatParentsNeedToKnow"
import { ReviewsSection } from "@/components/media/ReviewsSection"
import { WatchProvidersClient } from "@/components/media/WatchProvidersClient"
import { FamilyReactions } from "@/components/media/FamilyReactions"
import { FamilyFitCard } from "@/components/media/FamilyFitCard"
import { SimilarMedia } from "@/components/media/SimilarMedia"
import { ReportCorrectionButton } from "@/components/media/ReportCorrectionButton"
import { TalkToYourKids } from "@/components/media/TalkToYourKids"
import { DualMetricsDisplay } from "@/components/media/DualMetricsDisplay"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { mediaTypeLabels, formatDateFr } from "@/lib/utils"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuFooter } from "./ApercuFooter"
import { APERCU_PALETTE } from "./apercuTheme"

interface ApercuFilmMedia {
  id: string
  title: string
  originalTitle: string | null
  type: "MOVIE"
  posterUrl: string | null
  backdropUrl: string | null
  synopsisFr: string | null
  releaseDate: string | null
  duration: number | null
  director: string | null
  genres: string[]
  topics: string[]
  platforms: string[]
  expertAgeRec: number | null
  communityAgeRec: number | null
  tmdbRating: number | null
  tmdbVoteCount: number | null
  officialRating: string | null
  contentMetrics: {
    violence: number
    sexNudity: number
    language: number
    substanceUse: number
    consumerism: number
    positiveMessages: number
    roleModels: number
    whatParentsNeedToKnow: string[]
  } | null
  reviews: Array<{
    id: string
    role: "PARENT" | "KID" | "EDUCATOR"
    rating: number
    ageSuggestion: number
    comment: string
    createdAt: string
    editedAt: string | null
    user?: { id: string; name: string | null; image: string | null }
    familyMember: {
      id: string
      name: string
      avatarEmoji: string
    } | null
  }>
}

export function ApercuFilm({
  media,
  serifClass,
}: {
  media: ApercuFilmMedia
  serifClass: string
}) {
  const p = APERCU_PALETTE

  return (
    <FamilyFitProvider>
      <div
        className="flex flex-col overflow-x-hidden min-h-screen"
        style={{ background: p.bg, color: p.ink }}
      >
        <ApercuPreviewBanner />
        <ApercuNav />

        {/* Hero with warm-tinted blurred backdrop */}
        <FilmHero media={media} serifClass={serifClass} />

        {/* Main content: 2/3 + 1/3 sidebar, mirrors the live /media/[id] layout */}
        <div className="container mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2 space-y-7">
              {media.contentMetrics && (
                <WhatParentsNeedToKnow
                  items={media.contentMetrics.whatParentsNeedToKnow}
                />
              )}

              <TalkToYourKids
                title={media.title}
                type={media.type}
                metrics={media.contentMetrics ?? {
                  violence: 0,
                  sexNudity: 0,
                  language: 0,
                  consumerism: 0,
                  substanceUse: 0,
                  positiveMessages: 0,
                  roleModels: 0,
                  whatParentsNeedToKnow: [],
                }}
                genres={media.genres}
                topics={media.topics}
              />

              <Tabs defaultValue="reviews" className="w-full">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="reviews">
                    Avis ({media.reviews.length})
                  </TabsTrigger>
                  <TabsTrigger value="details">Détails</TabsTrigger>
                </TabsList>

                <TabsContent value="reviews" className="space-y-4 mt-6">
                  <ReviewsSection reviews={media.reviews} />
                </TabsContent>

                <TabsContent value="details" className="mt-6">
                  <Card
                    className="border"
                    style={{
                      background: p.card,
                      borderColor: p.line,
                    }}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <DetailRow
                          label="Type"
                          value={mediaTypeLabels[media.type]}
                        />
                        {media.releaseDate && (
                          <DetailRow
                            label="Date de sortie"
                            value={formatDateFr(media.releaseDate)}
                          />
                        )}
                        {media.duration && (
                          <DetailRow
                            label="Durée"
                            value={formatDuration(media.duration)}
                          />
                        )}
                        {media.director && (
                          <DetailRow
                            label="Réalisateur"
                            value={media.director}
                          />
                        )}
                      </div>
                      {media.topics.length > 0 && (
                        <div>
                          <h4
                            className="text-sm font-medium mb-2"
                            style={{ color: p.ink2 }}
                          >
                            Thèmes
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {media.topics.map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                style={{ background: p.bg2, color: p.ink2 }}
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <SimilarMedia
                mediaId={media.id}
                mediaType={media.type}
                genres={media.genres}
                topics={media.topics}
              />
            </div>

            {/* Sidebar — exact same components as live page, 1/3 width */}
            <div className="space-y-6">
              <FamilyReactions mediaId={media.id} mediaTitle={media.title} />
              {media.contentMetrics && (
                <DualMetricsDisplay
                  mediaId={media.id}
                  mediaTitle={media.title}
                  expertMetrics={media.contentMetrics}
                />
              )}
              <ReportCorrectionButton
                mediaId={media.id}
                mediaTitle={media.title}
              />
            </div>
          </div>
        </div>

        <ApercuFooter serifClass={serifClass} />
      </div>
    </FamilyFitProvider>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────

function FilmHero({
  media,
  serifClass,
}: {
  media: ApercuFilmMedia
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const year = media.releaseDate
    ? new Date(media.releaseDate).getFullYear()
    : null
  const rating = media.tmdbRating ? media.tmdbRating.toFixed(1) : null

  return (
    <section className="relative" style={{ background: p.bg }}>
      {/* Blurred backdrop + warm cream-terracotta overlay */}
      <div className="absolute inset-0 overflow-hidden">
        {media.backdropUrl && (
          <Image
            src={media.backdropUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{
              filter: "blur(40px) saturate(1.1)",
              transform: "scale(1.1)",
              opacity: 0.55,
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              rgba(209, 106, 74, 0.12) 0%,
              rgba(245, 241, 233, 0.80) 45%,
              ${p.bg} 100%)`,
          }}
        />
      </div>

      <div className="container mx-auto px-4 md:px-8 py-10 md:py-16 relative">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Poster */}
          <div className="lg:w-1/4 shrink-0">
            <div
              className="relative aspect-[2/3] rounded-2xl overflow-hidden mx-auto lg:mx-0 max-w-[280px] lg:max-w-none"
              style={{
                background: p.placeholder,
                boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
              }}
            >
              {media.posterUrl && (
                <Image
                  src={media.posterUrl}
                  alt={media.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 280px, 320px"
                  className="object-cover"
                />
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0" style={{ color: p.ink }}>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge
                variant="secondary"
                style={{ background: p.bg2, color: p.ink }}
                className="border-0"
              >
                {mediaTypeLabels[media.type]}
              </Badge>
              <OfficialRatingBadge
                rating={media.officialRating}
                type={media.type}
                showLabel
              />
            </div>

            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Analysé en détail
            </div>

            <h1
              className={`${serifClass} text-3xl md:text-5xl lg:text-6xl font-medium leading-[1.05] m-0`}
              style={{ letterSpacing: "-0.02em", color: p.ink }}
            >
              {media.title}
            </h1>
            {media.originalTitle && media.originalTitle !== media.title && (
              <div
                className={`${serifClass} italic text-lg md:text-xl mt-2`}
                style={{ color: p.ink2 }}
              >
                {media.originalTitle}
              </div>
            )}

            <div
              className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
              style={{ color: p.ink2 }}
            >
              {year && <span>{year}</span>}
              {media.director && (
                <>
                  <span style={{ color: p.line2 }}>·</span>
                  <span>{media.director}</span>
                </>
              )}
              {media.duration && (
                <>
                  <span style={{ color: p.line2 }}>·</span>
                  <span>{formatDuration(media.duration)}</span>
                </>
              )}
              {media.expertAgeRec !== null && (
                <>
                  <span style={{ color: p.line2 }}>·</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ background: "#B8D89A", color: "#2D3E1E" }}
                  >
                    Dès {media.expertAgeRec} ans
                  </span>
                </>
              )}
            </div>

            {media.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {media.genres.map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: p.card,
                      border: `1px solid ${p.line}`,
                      color: p.ink2,
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {media.synopsisFr && (
              <p
                className="mt-6 text-base md:text-lg leading-relaxed max-w-2xl"
                style={{ color: p.ink }}
              >
                {media.synopsisFr}
              </p>
            )}

            {/* Watch providers */}
            <WatchProvidersClient
              mediaId={media.id}
              mediaType={media.type}
              className="mt-6"
            />

            {/* Rating summary */}
            {rating && (
              <div
                className="mt-6 inline-flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line}`,
                }}
              >
                <Star
                  className="h-5 w-5"
                  style={{ color: p.accent, fill: p.accent }}
                />
                <span
                  className={`${serifClass} text-xl font-medium`}
                  style={{ color: p.ink, letterSpacing: "-0.02em" }}
                >
                  {rating}
                </span>
                <span className="text-sm" style={{ color: p.ink2 }}>
                  / 10
                </span>
                {media.tmdbVoteCount && (
                  <span
                    className="text-xs pl-3 ml-1"
                    style={{
                      color: p.ink2,
                      borderLeft: `1px solid ${p.line}`,
                    }}
                  >
                    {formatCount(media.tmdbVoteCount)} votes
                  </span>
                )}
              </div>
            )}
          </div>

          {/* FamilyFitCard — same API as FamilyFitHero but with the
             light-theme palette that reads correctly on the warm cream
             hero (the Hero variant assumes a dark backdrop). */}
          <div className="lg:w-72 xl:w-80 shrink-0">
            <FamilyFitCard mediaId={media.id} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  const p = APERCU_PALETTE
  return (
    <div>
      <h4 className="text-sm font-medium mb-1" style={{ color: p.ink2 }}>
        {label}
      </h4>
      <p className="font-medium" style={{ color: p.ink }}>
        {value}
      </p>
    </div>
  )
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h${m.toString().padStart(2, "0")}`
  if (h > 0) return `${h}h`
  return `${m} min`
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`
  return String(n)
}
