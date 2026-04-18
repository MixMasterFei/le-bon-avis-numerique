"use client"

import Link from "next/link"
import { Star } from "lucide-react"
import { SafeImage } from "@/components/ui/SafeImage"
import { FamilyFitProvider } from "@/components/home/FamilyFitProvider"
import { ApercuPreviewBanner } from "./ApercuPreviewBanner"
import { ApercuNav } from "./ApercuNav"
import { ApercuFooter } from "./ApercuFooter"
import { ApercuFinalCTA } from "./ApercuFinalCTA"
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
    rating: number
    comment: string | null
    ageSuggestion: number | null
    createdAt: string
    user: { id: string; name: string | null; image: string | null } | null
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
      <div className="flex flex-col overflow-x-hidden" style={{ background: p.bg, color: p.ink }}>
        <ApercuPreviewBanner />
        <ApercuNav />

        <FilmHero media={media} serifClass={serifClass} />
        <FilmBody media={media} serifClass={serifClass} />

        <ApercuFinalCTA serifClass={serifClass} isLoggedIn />
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
  const year = media.releaseDate ? new Date(media.releaseDate).getFullYear() : null
  const ageLabel = media.expertAgeRec !== null ? `${media.expertAgeRec}+` : null
  const rating = media.tmdbRating ? media.tmdbRating.toFixed(1) : null

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: p.bg2 }}
    >
      <div className="container mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="grid lg:grid-cols-[280px_1fr_300px] gap-8 lg:gap-10">
          {/* Poster */}
          <div className="mx-auto lg:mx-0 w-full max-w-[280px]">
            <div
              className="relative aspect-[2/3] rounded-2xl overflow-hidden"
              style={{
                background: p.placeholder,
                border: `1px solid ${p.line}`,
                boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
              }}
            >
              {media.posterUrl && (
                <SafeImage
                  src={media.posterUrl}
                  alt={media.title}
                  fill
                  className="object-cover"
                  sizes="280px"
                  priority
                />
              )}
              {ageLabel && (
                <div
                  className="absolute top-4 left-4 px-2.5 py-1 rounded text-xs font-semibold"
                  style={{ background: "#B8D89A", color: "#2D3E1E" }}
                >
                  {ageLabel} ans
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0">
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Film · analysé en détail
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

            {/* Meta row */}
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
              {rating && (
                <>
                  <span style={{ color: p.line2 }}>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" style={{ color: p.accent, fill: p.accent }} />
                    <span style={{ color: p.ink }} className="font-semibold">
                      {rating}
                    </span>
                    {media.tmdbVoteCount && (
                      <span>· {formatCount(media.tmdbVoteCount)} votes</span>
                    )}
                  </span>
                </>
              )}
            </div>

            {/* Genres */}
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

            {/* Synopsis */}
            {media.synopsisFr && (
              <p
                className="mt-6 text-base md:text-lg leading-relaxed max-w-2xl"
                style={{ color: p.ink }}
              >
                {media.synopsisFr}
              </p>
            )}

            {/* CTAs */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/media/${media.id}`}
                className="px-6 py-3 rounded-[10px] text-sm font-medium transition-transform hover:scale-[1.02]"
                style={{ background: p.ink, color: p.bg }}
              >
                Voir la fiche complète
              </Link>
              <button
                className="px-5 py-3 rounded-[10px] text-sm font-medium transition-colors"
                style={{
                  background: "transparent",
                  color: p.ink,
                  border: `1px solid ${p.line2}`,
                }}
              >
                Ajouter à ma liste
              </button>
            </div>
          </div>

          {/* Family Fit illustrative column */}
          <div className="lg:w-full">
            <FamilyFitPanel serifClass={serifClass} />
          </div>
        </div>
      </div>
    </section>
  )
}

function FamilyFitPanel({ serifClass }: { serifClass: string }) {
  const p = APERCU_PALETTE
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: p.card,
        border: `1px solid ${p.line}`,
        boxShadow: "0 14px 32px rgba(0,0,0,0.10)",
      }}
    >
      <div
        className={`${serifClass} text-base font-semibold leading-tight`}
        style={{ color: p.ink }}
      >
        Analyse pour votre foyer
      </div>
      <div className="mt-3 space-y-2">
        <FitRow name="Léa" age={8} verdict="Adapté" color="#5C8A5C" reason="Aucun contenu sensible au-dessus du seuil" />
        <FitRow name="Tom" age={11} verdict="Adapté" color="#5C8A5C" reason="Thème apprécié · niveau de violence bas" />
      </div>
      <div
        className="mt-4 pt-4 text-[11px] leading-relaxed"
        style={{ color: p.ink2, borderTop: `1px solid ${p.line}` }}
      >
        Ce badge apparaît sur chaque fiche quand vous êtes connecté. Les
        scores dépendent des sensibilités de chaque membre.
      </div>
    </div>
  )
}

function FitRow({
  name,
  age,
  verdict,
  color,
  reason,
}: {
  name: string
  age: number
  verdict: string
  color: string
  reason: string
}) {
  const p = APERCU_PALETTE
  return (
    <div className="flex items-start gap-2.5 text-[12px]">
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1"
        style={{ background: color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span style={{ color: p.ink, fontWeight: 600 }}>{verdict}</span>
          <span style={{ color: p.ink2 }}>· {name} · {age} ans</span>
        </div>
        <div className="text-[11px] leading-snug mt-0.5" style={{ color: p.ink2 }}>
          {reason}
        </div>
      </div>
    </div>
  )
}

// ─── Body ────────────────────────────────────────────────────────────

function FilmBody({
  media,
  serifClass,
}: {
  media: ApercuFilmMedia
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const cm = media.contentMetrics

  return (
    <>
      {/* 7 criteria */}
      {cm && (
        <section className="py-10 md:py-14" style={{ background: p.bg }}>
          <div className="container mx-auto px-4 md:px-8">
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Analyse en détail
            </div>
            <h2
              className={`${serifClass} text-2xl md:text-4xl font-medium m-0 mb-7 leading-[1.05]`}
              style={{ letterSpacing: "-0.03em" }}
            >
              Les <em className="italic" style={{ color: p.accent }}>7 critères</em>,
              passés au crible.
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MetricBar label="Violence" value={cm.violence} tone="negative" serifClass={serifClass} />
              <MetricBar label="Contenu sexuel" value={cm.sexNudity} tone="negative" serifClass={serifClass} />
              <MetricBar label="Langage cru" value={cm.language} tone="negative" serifClass={serifClass} />
              <MetricBar label="Substances" value={cm.substanceUse} tone="negative" serifClass={serifClass} />
              <MetricBar label="Consumérisme" value={cm.consumerism} tone="negative" serifClass={serifClass} />
              <MetricBar label="Messages positifs" value={cm.positiveMessages} tone="positive" serifClass={serifClass} />
              <MetricBar label="Modèles de comportement" value={cm.roleModels} tone="positive" serifClass={serifClass} />
            </div>
          </div>
        </section>
      )}

      {/* What parents need to know */}
      {cm && cm.whatParentsNeedToKnow.length > 0 && (
        <section className="py-10 md:py-14" style={{ background: p.bg2 }}>
          <div className="container mx-auto px-4 md:px-8">
            <div
              className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
              style={{ color: p.accent }}
            >
              Ce qu’il faut savoir
            </div>
            <h2
              className={`${serifClass} text-2xl md:text-4xl font-medium m-0 mb-7 leading-[1.05]`}
              style={{ letterSpacing: "-0.03em" }}
            >
              Les <em className="italic" style={{ color: p.accent }}>points clés</em> avant de regarder
            </h2>

            <ul className="space-y-2.5 max-w-3xl">
              {cm.whatParentsNeedToKnow.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background: p.card, border: `1px solid ${p.line}` }}
                >
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 text-[11px] font-semibold"
                    style={{ background: p.bg2, color: p.accent }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: p.ink }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="py-10 md:py-14" style={{ background: p.bg }}>
        <div className="container mx-auto px-4 md:px-8">
          <div
            className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
            style={{ color: p.accent }}
          >
            Premiers avis
          </div>
          <h2
            className={`${serifClass} text-2xl md:text-4xl font-medium m-0 mb-7 leading-[1.05]`}
            style={{ letterSpacing: "-0.03em" }}
          >
            Ce que disent <em className="italic" style={{ color: p.accent }}>les foyers</em>
          </h2>

          {media.reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {media.reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl p-5"
                  style={{ background: p.card, border: `1px solid ${p.line}` }}
                >
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5"
                        style={{
                          color: i < r.rating ? p.accent : p.line2,
                          fill: i < r.rating ? p.accent : "transparent",
                        }}
                      />
                    ))}
                  </div>
                  {r.comment ? (
                    <p
                      className={`${serifClass} text-base leading-relaxed line-clamp-5`}
                      style={{ color: p.ink, letterSpacing: "-0.01em" }}
                    >
                      « {r.comment} »
                    </p>
                  ) : (
                    <p className="text-sm italic" style={{ color: p.ink2 }}>
                      Note sans commentaire
                    </p>
                  )}
                  {r.user?.name && (
                    <div
                      className="mt-4 pt-4 text-xs"
                      style={{ color: p.ink2, borderTop: `1px solid ${p.line}` }}
                    >
                      {r.user.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="rounded-2xl p-8 text-center"
              style={{ background: p.card, border: `1px solid ${p.line}`, color: p.ink2 }}
            >
              <p className="text-sm">
                Aucun avis pour le moment. Soyez parmi les premiers à partager
                le vôtre.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

// ─── Metric bar ──────────────────────────────────────────────────────

function MetricBar({
  label,
  value,
  tone,
  serifClass,
}: {
  label: string
  value: number
  tone: "negative" | "positive"
  serifClass: string
}) {
  const p = APERCU_PALETTE
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  // Negative metrics (violence, language, etc): higher = more concerning,
  // so the bar fills in terracotta. Positive metrics: higher = better,
  // fills in sage.
  const fillColor = tone === "negative" ? p.accent : p.accent2

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: p.card, border: `1px solid ${p.line}` }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: p.ink }}>
          {label}
        </span>
        <span
          className={`${serifClass} text-base`}
          style={{
            color: value > 0 ? fillColor : p.ink2,
            letterSpacing: "-0.02em",
          }}
        >
          {value}<span style={{ color: p.ink2 }}>/5</span>
        </span>
      </div>
      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: p.bg2 }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────

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
