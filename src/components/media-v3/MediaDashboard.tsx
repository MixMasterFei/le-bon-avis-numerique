import { Suspense } from "react"
import Link from "next/link"
import { BackButton } from "@/components/ui/BackButton"
import { DashboardScreenshots } from "./DashboardScreenshots"
import { DashboardSensitiveWarnings } from "./DashboardSensitiveWarnings"
import { BlurredPoster } from "@/components/media/BlurredPoster"
import { PlatformIcons } from "@/components/media/PlatformIcons"
import { GameInfoCard } from "@/components/media/GameInfoCard"
import { ReportCorrectionButton } from "@/components/media/ReportCorrectionButton"
import { MediaPageClient } from "@/components/media/MediaPageClient"
import { DashboardScoreboard } from "./DashboardScoreboard"
import { DashboardTrailerButton } from "./DashboardTrailerButton"
import { DashboardFamilyPanel } from "./DashboardFamilyPanel"
import { DashboardWhereToWatch } from "./DashboardWhereToWatch"
import { DashboardFamilyFeedback } from "./DashboardFamilyFeedback"
import { DashboardSimilar } from "./DashboardSimilar"
import type { DashboardMedia } from "@/lib/media-dashboard-data"

// Handoff palette (already matches the site's warm art direction).
const C = {
  page: "#EDE4D5",
  card: "#FFFFFF",
  border: "#E4DAC8",
  divider: "#EFE6D6",
  ink: "#2A251F",
  body: "#4A433A",
  muted: "#8A8072",
  faint: "#A89A82",
  accent: "#C0512E",
  numberSoft: "#DCC9A6",
} as const

const TYPE_LABEL: Record<string, string> = {
  MOVIE: "Film",
  TV: "Série",
  GAME: "Jeu vidéo",
  BOOK: "Livre",
  APP: "Application",
  MANGA: "Manga",
}

const TYPE_LISTING: Record<string, string> = {
  MOVIE: "/films",
  TV: "/series",
  GAME: "/jeux",
  BOOK: "/livres",
  MANGA: "/mangas",
}

const SECTION_LABEL =
  "text-[10px] font-bold uppercase tracking-[.13em]"

function metaLine(media: DashboardMedia): string {
  const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : null
  const parts: string[] = []
  if (year) parts.push(String(year))
  if (media.duration) parts.push(`${media.duration} min`)
  if (media.director) parts.push(`Réalisé par ${media.director}`)
  return parts.join(" · ")
}

export function MediaDashboard({
  media,
  dbId,
  hideAnalysis,
  quickAnswer,
  breadcrumb,
}: {
  media: DashboardMedia
  dbId: string
  hideAnalysis: boolean
  /** Visible FAQ-backing block ("à partir de quel âge ?") — same wording as the FAQPage JSON-LD. */
  quickAnswer?: { question: string; answer: string }
  /** Visible breadcrumb matching the BreadcrumbList JSON-LD; falls back to the BackButton (admin preview). */
  breadcrumb?: React.ReactNode
}) {
  const hasAge = media.expertAgeRec != null && media.expertAgeRec > 0
  const verdict = hasAge ? `Dès ${media.expertAgeRec} ans` : "Non évalué"
  const verdictNote = hideAnalysis
    ? "Estimation · à confirmer après la sortie"
    : media.isProvisional
      ? "Âge provisoire · à confirmer"
      : "Analyse automatisée · en calibrage"

  const isFilmOrTv = media.type === "MOVIE" || media.type === "TV"
  const listing = TYPE_LISTING[media.type] ?? "/recherche"
  // Public, indexable catalog filter — `topics` matches both genres[] and
  // topics[] server-side (media-queries.ts), unlike the admin-only
  // /films/recherche route this used to point at.
  const genreHref = (g: string) => `${listing}?topics=${encodeURIComponent(g)}`
  const seeAllHref = media.genres[0] ? genreHref(media.genres[0]) : listing

  const cardStyle = { background: C.card, border: `1px solid ${C.border}` } as const

  return (
    <div className="min-h-screen" style={{ background: C.page }}>
      <div className="mx-auto max-w-[1280px] px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        {breadcrumb ?? <BackButton className="mb-4 text-[#8A8072] hover:text-[#2A251F]" />}

        {/* ===== Scoreboard hero ===== */}
        <div className="mb-[13px] overflow-hidden rounded-2xl" style={cardStyle}>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:gap-5 sm:px-6">
            {/* poster */}
            <div
              className="relative h-[160px] w-[106px] flex-none overflow-hidden rounded-[12px] sm:h-[188px] sm:w-[126px]"
              style={{ boxShadow: "0 6px 20px rgba(42,37,31,.28)" }}
            >
              <BlurredPoster
                src={media.posterUrl ?? "/placeholder-poster.jpg"}
                alt={media.title}
                expertAgeRec={media.expertAgeRec}
                violenceScore={media.metrics?.violence}
                mediaType={media.type}
                sizes="(max-width: 640px) 106px, 126px"
                priority
              />
            </div>

            {/* middle */}
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                <span
                  className="rounded-full px-2 py-[3px] text-[10.5px] font-semibold"
                  style={{ color: "#A8431F", background: "#F3DECE" }}
                >
                  {TYPE_LABEL[media.type] ?? media.type}
                </span>
                {media.genres.slice(0, 3).map((g) => (
                  <Link
                    key={g}
                    href={genreHref(g)}
                    className="rounded-full px-2 py-[3px] text-[10.5px] font-medium transition-colors hover:text-[#2A251F]"
                    style={{ color: "#6B6154", background: C.page }}
                  >
                    {g}
                  </Link>
                ))}
                {media.officialRating && (
                  <span
                    className="rounded-full px-2 py-[3px] text-[10.5px] font-medium"
                    style={{ color: C.muted, background: C.page }}
                  >
                    {media.officialRating} · classif. officielle
                  </span>
                )}
              </div>
              <h1
                className="font-serif text-[22px] font-semibold leading-tight sm:text-[27px]"
                style={{ color: C.ink, letterSpacing: "-.01em" }}
              >
                {media.title}
              </h1>
              {metaLine(media) && (
                <div className="mt-1.5 text-[12px]" style={{ color: C.muted }}>
                  {metaLine(media)}
                </div>
              )}
              {media.synopsisFr && (
                <p
                  className="mt-2 max-w-2xl text-[12.5px] leading-[1.5] line-clamp-3"
                  style={{ color: C.body }}
                >
                  {media.synopsisFr}
                </p>
              )}
            </div>

            {/* verdict + trailer */}
            <div className="flex flex-none flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
              <div className="sm:text-right">
                <div className={SECTION_LABEL} style={{ color: C.faint }}>
                  Notre recommandation
                </div>
                <div className="font-serif text-[34px] font-semibold leading-tight sm:text-[40px]" style={{ color: C.accent }}>
                  {verdict}
                </div>
                <div className="text-[10.5px]" style={{ color: C.faint }}>
                  {verdictNote}
                </div>
              </div>
              {isFilmOrTv && <DashboardTrailerButton mediaId={dbId} mediaType={media.type} />}
            </div>
          </div>

          {/* Actions + Totem/Communauté toggle + KPI strip. Hidden metrics
              (pre-release) fall back to just the actions row. */}
          {!hideAnalysis && media.metrics ? (
            <DashboardScoreboard
              mediaId={media.id}
              mediaTitle={media.title}
              expertMetrics={media.metrics}
              topics={media.topics}
              reviewCount={media.reviews.length}
            />
          ) : (
            <div className="px-5 py-3 sm:px-6" style={{ borderTop: "1px solid #EFE6D6" }}>
              <MediaPageClient mediaId={media.id} mediaTitle={media.title} showActions reviewCount={media.reviews.length} />
            </div>
          )}
        </div>

        {/* ===== Réponse rapide — visible source of the FAQPage JSON-LD ===== */}
        {quickAnswer && (
          <div className="mb-[13px] rounded-2xl p-4 sm:p-[18px]" style={cardStyle}>
            <div className={`${SECTION_LABEL} mb-2`} style={{ color: C.faint }}>
              Réponse rapide
            </div>
            <h2
              className="font-serif text-[15px] font-semibold leading-snug sm:text-[16px]"
              style={{ color: C.ink, letterSpacing: "-.01em" }}
            >
              {quickAnswer.question}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-[1.55]" style={{ color: C.body }}>
              {quickAnswer.answer}
            </p>
            {media.topics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3" style={{ borderColor: C.divider }}>
                {media.topics.slice(0, 8).map((t) => (
                  <Link
                    key={t}
                    href={`${listing}?topics=${encodeURIComponent(t)}`}
                    className="rounded-full px-2 py-[3px] text-[10.5px] font-medium transition-colors hover:text-[#2A251F]"
                    style={{ color: "#6B6154", background: C.page }}
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== three-column row ===== */}
        <div className="mb-[13px] grid gap-[13px] lg:grid-cols-[1fr_1.25fr_1fr]">
          {/* Pour ma famille */}
          {!hideAnalysis ? (
            <DashboardFamilyPanel mediaId={dbId} recommendedAge={media.expertAgeRec} />
          ) : (
            <div className="rounded-2xl p-4 sm:p-[18px]" style={cardStyle}>
              <div className={`${SECTION_LABEL} mb-3`} style={{ color: C.faint }}>
                Pour ma famille
              </div>
              <p className="text-[12.5px] leading-relaxed" style={{ color: C.body }}>
                L&apos;adéquation par membre sera disponible une fois le titre sorti et analysé.
              </p>
            </div>
          )}

          {/* Ce que les parents doivent savoir */}
          <div className="rounded-2xl p-4 sm:p-[18px]" style={cardStyle}>
            <div className={`${SECTION_LABEL} mb-3`} style={{ color: C.faint }}>
              Ce que les parents doivent savoir
            </div>
            {!hideAnalysis && media.metrics && media.metrics.whatParentsNeedToKnow.length > 0 ? (
              <>
                <div className="flex flex-col gap-2.5">
                  {media.metrics.whatParentsNeedToKnow.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-baseline gap-2.5">
                      <span
                        className="flex-none w-4 font-serif text-[15px] font-bold tabular-nums"
                        style={{ color: C.numberSoft }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[12.5px] leading-[1.5]" style={{ color: C.body }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Sensitive warnings moved to the dedicated collapsible
                    "Ce qui peut marquer" card below (opt-in reveal — the
                    labels are mild spoilers). */}
              </>
            ) : (
              <p className="text-[12.5px] leading-relaxed" style={{ color: C.body }}>
                {hideAnalysis
                  ? "L'analyse détaillée du contenu sera publiée après la sortie."
                  : "Analyse de contenu à venir pour ce titre."}
              </p>
            )}
          </div>

          {/* Où regarder (film/TV, segmented) / plateformes (jeux) */}
          <div className="rounded-2xl p-4 sm:p-[18px]" style={cardStyle}>
            {isFilmOrTv ? (
              <DashboardWhereToWatch mediaId={dbId} mediaType={media.type} />
            ) : (
              <>
                <div className={`${SECTION_LABEL} mb-2.5`} style={{ color: C.faint }}>
                  Plateformes
                </div>
                {media.platforms.length > 0 ? (
                  <PlatformIcons platforms={media.platforms} variant="hero" />
                ) : (
                  <p className="text-[12.5px]" style={{ color: C.muted }}>
                    Disponibilités bientôt.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ===== Ce qui peut marquer — community trigger warnings (film/TV;
            trigger votes are gated off for games in FicheDataContext) ===== */}
        {!hideAnalysis && isFilmOrTv && (
          <DashboardSensitiveWarnings
            mediaId={dbId}
            aiItems={
              (media.metrics?.enrichmentConfidence ?? 0) >= 0.6
                ? (media.metrics?.sensitiveWarnings ?? [])
                : []
            }
          />
        )}

        {/* ===== screenshots (dedup by URL + admin delete) ===== */}
        {media.screenshots.length > 0 && (
          <div className="mb-[13px] rounded-2xl p-4 sm:p-5" style={cardStyle}>
            <div className={`${SECTION_LABEL} mb-3`} style={{ color: C.faint }}>
              Captures d&apos;écran
            </div>
            <DashboardScreenshots screenshots={media.screenshots} title={media.title} />
          </div>
        )}

        {/* ===== game specifics (PEGI descriptors, modes, online/purchases) ===== */}
        {media.type === "GAME" && (
          <div className="mb-[13px]">
            <GameInfoCard
              platforms={media.platforms}
              genres={media.genres}
              consumerism={media.metrics?.consumerism}
              officialRating={media.officialRating}
              pegiDescriptors={media.pegiDescriptors}
              expertAgeRec={media.expertAgeRec}
            />
          </div>
        )}

        {/* ===== Vous l'avez vu ? — reactions + written avis (collapsible) ===== */}
        <DashboardFamilyFeedback mediaId={dbId} mediaTitle={media.title} mediaType={media.type} reviews={media.reviews} />

        {/* ===== similar titles — compact single row ===== */}
        <div className="rounded-2xl p-4 sm:p-5" style={cardStyle}>
          <div className="mb-3 flex items-baseline justify-between">
            <div className={SECTION_LABEL} style={{ color: C.faint }}>
              Dans le même genre
            </div>
            <Link href={seeAllHref} className="text-[11px] font-semibold" style={{ color: C.accent }}>
              Tout voir →
            </Link>
          </div>
          <Suspense
            fallback={
              <div className="flex gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 flex-1 animate-pulse rounded-md" style={{ background: C.page }} />
                ))}
              </div>
            }
          >
            <DashboardSimilar
              mediaId={dbId}
              mediaType={media.type}
              genres={media.genres}
              topics={media.topics}
            />
          </Suspense>
        </div>

        {/* ===== Signaler une correction ===== */}
        <div className="flex justify-center pt-4">
          <ReportCorrectionButton mediaId={dbId} mediaTitle={media.title} />
        </div>
      </div>
    </div>
  )
}
