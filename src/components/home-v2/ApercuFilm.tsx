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
import { AgeVoteButton } from "@/components/media/AgeVoteButton"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { AdminScreenshotsWrapper } from "@/components/media/AdminScreenshotsWrapper"
import { WhatParentsNeedToKnow } from "@/components/media/WhatParentsNeedToKnow"
import { ReviewsSection } from "@/components/media/ReviewsSection"
import { WatchProvidersClient } from "@/components/media/WatchProvidersClient"
import { FamilyReactions } from "@/components/media/FamilyReactions"
import { SimilarMedia } from "@/components/media/SimilarMedia"
import { ReportCorrectionButton } from "@/components/media/ReportCorrectionButton"
import { DualMetricsDisplay } from "@/components/media/DualMetricsDisplay"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { mediaTypeLabels, formatDateFr } from "@/lib/utils"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuFooter } from "./ApercuFooter"
import { ApercuSection } from "./ApercuSection"
import { ApercuFamilyFit } from "./ApercuFamilyFit"
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
  screenshots: Array<{
    id: string
    url: string
    width: number | null
    height: number | null
    order: number
  }>
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
  isAdmin,
}: {
  media: ApercuFilmMedia
  serifClass: string
  isAdmin: boolean
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

        <FilmHero media={media} serifClass={serifClass} />

        {/* Main body: 2/3 + 1/3 grid on the deeper cream (bg2) so the
           lighter hero reads as a distinct opening band.
           Follows the Art Direction doc's bg → bg2 → bg rhythm. */}
        <section className="py-8 md:py-12" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-10">
                {media.contentMetrics &&
                  media.contentMetrics.whatParentsNeedToKnow.length > 0 && (
                    <ApercuSection
                      eyebrow="Ce qu’il faut savoir"
                      title="Les"
                      titleAccent="points clés"
                      serifClass={serifClass}
                    >
                      <WarmCard>
                        <WhatParentsNeedToKnow
                          items={media.contentMetrics.whatParentsNeedToKnow}
                        />
                      </WarmCard>
                    </ApercuSection>
                  )}

                {media.screenshots.length > 0 && (
                  <ApercuSection
                    eyebrow="Extraits"
                    title="Captures"
                    titleAccent="d’écran"
                    titleAccentColor="accent2"
                    serifClass={serifClass}
                  >
                    <WarmCard padded={false}>
                      <div className="p-3 md:p-4">
                        <AdminScreenshotsWrapper
                          screenshots={media.screenshots}
                          title={media.title}
                          isAdmin={isAdmin}
                        />
                      </div>
                    </WarmCard>
                  </ApercuSection>
                )}

                <ApercuSection
                  eyebrow="Avis & détails"
                  title="Ce que disent"
                  titleAccent="les parents"
                  serifClass={serifClass}
                >
                  <Tabs defaultValue="reviews" className="w-full">
                    <TabsList
                      className="w-full justify-start"
                      style={{ background: p.bg2 }}
                    >
                      <TabsTrigger value="reviews">
                        Avis ({media.reviews.length})
                      </TabsTrigger>
                      <TabsTrigger value="details">Détails</TabsTrigger>
                    </TabsList>

                    <TabsContent value="reviews" className="space-y-4 mt-6">
                      <WarmCard>
                        <ReviewsSection reviews={media.reviews} />
                      </WarmCard>
                    </TabsContent>

                    <TabsContent value="details" className="mt-6">
                      <WarmCard>
                        <Card
                          style={{
                            background: "transparent",
                            border: 0,
                            boxShadow: "none",
                          }}
                        >
                          <CardContent className="p-0 space-y-5">
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
                                  className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
                                  style={{ color: p.ink2 }}
                                >
                                  Thèmes
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {media.topics.map((t) => (
                                    <Badge
                                      key={t}
                                      variant="secondary"
                                      style={{
                                        background: p.bg2,
                                        color: p.ink2,
                                        border: `1px solid ${p.line}`,
                                      }}
                                    >
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </WarmCard>
                    </TabsContent>
                  </Tabs>
                </ApercuSection>
              </div>

              {/* Sidebar — each widget in its own warm art-directed frame */}
              <aside className="space-y-8">
                <ApercuSection
                  eyebrow="Réactions"
                  title="Pour"
                  titleAccent="votre foyer"
                  tight
                  serifClass={serifClass}
                >
                  <WarmCard padded={false}>
                    <div className="p-5">
                      <FamilyReactions
                        mediaId={media.id}
                        mediaTitle={media.title}
                      />
                    </div>
                  </WarmCard>
                </ApercuSection>

                {media.contentMetrics && (
                  <ApercuSection
                    eyebrow="Les 7 critères"
                    title="Analyse"
                    titleAccent="en détail"
                    tight
                    serifClass={serifClass}
                  >
                    <WarmCard padded={false}>
                      <div className="p-5">
                        <DualMetricsDisplay
                          mediaId={media.id}
                          mediaTitle={media.title}
                          expertMetrics={media.contentMetrics}
                        />
                      </div>
                    </WarmCard>
                  </ApercuSection>
                )}

                <ApercuSection
                  eyebrow="Vous repérez une erreur ?"
                  title="Aidez-nous"
                  titleAccent="à corriger"
                  tight
                  serifClass={serifClass}
                >
                  <WarmCard padded={false}>
                    <div className="p-5">
                      <ReportCorrectionButton
                        mediaId={media.id}
                        mediaTitle={media.title}
                      />
                    </div>
                  </WarmCard>
                </ApercuSection>
              </aside>
            </div>
          </div>
        </section>

        {/* Similar media: full-width band on the lighter bg so the
           poster grid breathes across the whole container instead
           of being cropped inside the 2/3 main column. */}
        <section className="py-10 md:py-14" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <ApercuSection
              eyebrow="À découvrir ensuite"
              title="Contenus"
              titleAccent="similaires"
              titleAccentColor="accent2"
              serifClass={serifClass}
            >
              <SimilarMedia
                mediaId={media.id}
                mediaType={media.type}
                genres={media.genres}
                topics={media.topics}
              />
            </ApercuSection>
          </div>
        </section>

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
            </div>

            {/* Age recommendation card with thumbs-up/down vote — same
               AgeVoteButton as the live page, sitting in a warm panel. */}
            {media.expertAgeRec !== null && (
              <div
                className="mt-5 inline-flex items-center gap-4 p-3 pr-4 rounded-xl"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line}`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "#5C8A5C", color: "#fff" }}
                >
                  {media.expertAgeRec}+
                </div>
                <div>
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: p.ink2 }}
                  >
                    Recommandation
                  </div>
                  <div
                    className={`${serifClass} text-base font-medium`}
                    style={{ color: p.ink, letterSpacing: "-0.01em" }}
                  >
                    dès {media.expertAgeRec} ans
                  </div>
                </div>
                <div className="ml-2">
                  <AgeVoteButton mediaId={media.id} />
                </div>
              </div>
            )}

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

            {/* Watch providers (trailer + streaming services) */}
            <WatchProvidersClient
              mediaId={media.id}
              mediaType={media.type}
              className="mt-6"
            />

            {/* Action bar — favorite, watchlist, review, share. Same
               component as the live page so the user has parity. */}
            <div className="mt-4">
              <MediaPageClient
                mediaId={media.id}
                mediaTitle={media.title}
                showActions
              />
            </div>

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

          {/* Warm-palette family fit widget — replaces the indigo/purple
             FamilyFitCard so the sidebar panel belongs to the cream canvas. */}
          <div className="lg:w-72 xl:w-80 shrink-0">
            <ApercuFamilyFit mediaId={media.id} serifClass={serifClass} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

function WarmCard({
  children,
  padded = true,
}: {
  children: React.ReactNode
  padded?: boolean
}) {
  const p = APERCU_PALETTE
  return (
    <div
      className={`rounded-2xl overflow-hidden ${padded ? "p-5 md:p-6" : ""}`}
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
      }}
    >
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const p = APERCU_PALETTE
  return (
    <div>
      <h4
        className="text-[11px] font-semibold mb-1 uppercase tracking-wide"
        style={{ color: p.ink2 }}
      >
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
