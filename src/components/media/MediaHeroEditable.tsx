"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Save, X, Loader2, Calendar, Clock } from "lucide-react"
import Link from "next/link"
import { AgeVoteButton } from "./AgeVoteButton"
import { MethodBadge } from "@/components/ui/MethodBadge"
import { ProvisionalBadge } from "@/components/media/ProvisionalBadge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { mediaTypeLabels } from "@/lib/utils"
import type { AgeRationale } from "@/lib/age-rationale"

interface Review {
  role: string
  ageSuggestion: number
}

type MediaType = "MOVIE" | "TV" | "GAME" | "BOOK" | "APP" | "MANGA"

interface MediaHeroEditableProps {
  isAdmin: boolean
  mediaId: string
  type: MediaType
  officialRating: string | null
  title: string
  synopsisFr: string | null
  expertAgeRec: number | null
  genres: string[]
  director: string | null | undefined
  duration: number | null | undefined
  releaseDate: string | null
  originalTitle: string | null | undefined
  reviews?: Review[]
  isProvisional?: boolean
  /** Server-computed "Pourquoi cet âge ?" rationale, shown on hover of the badge. */
  ageRationale?: AgeRationale
}

// Human label for an official CSA / PEGI rating (mirrors OfficialRatingBadge).
function officialRatingLabel(rating: string | null, type: MediaType): string {
  if (!rating) return "Non classé"
  if (type === "MOVIE" || type === "TV") {
    switch (rating) {
      case "TOUS_PUBLICS": return "Tous publics"
      case "CSA_10": return "-10"
      case "CSA_12": return "-12"
      case "CSA_16": return "-16"
      case "CSA_18": return "-18"
      default: return rating
    }
  }
  if (type === "GAME" || type === "APP") {
    switch (rating) {
      case "PEGI_3": return "PEGI 3"
      case "PEGI_7": return "PEGI 7"
      case "PEGI_12": return "PEGI 12"
      case "PEGI_16": return "PEGI 16"
      case "PEGI_18": return "PEGI 18"
      default: return rating
    }
  }
  return rating
}

export function MediaHeroEditable({
  isAdmin,
  mediaId,
  type,
  officialRating,
  title: initialTitle,
  synopsisFr: initialSynopsis,
  expertAgeRec: initialAge,
  genres: initialGenres,
  director: initialDirector,
  duration: initialDuration,
  releaseDate,
  originalTitle,
  reviews = [],
  isProvisional = false,
  ageRationale,
}: MediaHeroEditableProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Edit state
  const [title, setTitle] = useState(initialTitle)
  const [synopsisFr, setSynopsisFr] = useState(initialSynopsis || "")
  const [expertAgeRec, setExpertAgeRec] = useState<string>(
    initialAge !== null && initialAge !== undefined ? String(initialAge) : ""
  )
  const [genresStr, setGenresStr] = useState(initialGenres.join(", "))
  const [director, setDirector] = useState(initialDirector || "")
  const [duration, setDuration] = useState<string>(
    initialDuration ? String(initialDuration) : ""
  )

  const hasChanges =
    title !== initialTitle ||
    synopsisFr !== (initialSynopsis || "") ||
    expertAgeRec !== (initialAge !== null && initialAge !== undefined ? String(initialAge) : "") ||
    genresStr !== initialGenres.join(", ") ||
    director !== (initialDirector || "") ||
    duration !== (initialDuration ? String(initialDuration) : "")

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {}
      if (title !== initialTitle) body.title = title
      if (synopsisFr !== (initialSynopsis || "")) body.synopsisFr = synopsisFr
      if (expertAgeRec !== (initialAge !== null && initialAge !== undefined ? String(initialAge) : "")) {
        body.expertAgeRec = expertAgeRec ? parseInt(expertAgeRec) : null
      }
      if (genresStr !== initialGenres.join(", ")) {
        body.genres = genresStr
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      }
      if (director !== (initialDirector || "")) body.director = director || null
      if (duration !== (initialDuration ? String(initialDuration) : "")) {
        body.duration = duration ? parseInt(duration) : null
      }

      const res = await fetch(`/api/admin/media/${mediaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur lors de la sauvegarde")
      }

      setIsEditing(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setTitle(initialTitle)
    setSynopsisFr(initialSynopsis || "")
    setExpertAgeRec(initialAge !== null && initialAge !== undefined ? String(initialAge) : "")
    setGenresStr(initialGenres.join(", "))
    setDirector(initialDirector || "")
    setDuration(initialDuration ? String(initialDuration) : "")
    setIsEditing(false)
  }

  const formatDate = (date: string | null) => {
    if (!date) return null
    try {
      return new Date(date).toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      return date
    }
  }

  const WARM_INK = "var(--color-warm-ink)"
  const WARM_INK2 = "var(--color-warm-ink2)"

  // Tag pill shared style (genres + official rating)
  const tagPill =
    "inline-flex items-center rounded-full text-[13px] font-semibold px-2.5 py-1"
  const tagStyle = {
    background: "var(--color-warm-card)",
    border: "1px solid var(--color-warm-line)",
    color: WARM_INK2,
  }

  return (
    <>
      {/* TAGS — type · genres · official rating (display only) */}
      {!isEditing && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className="inline-flex items-center rounded-full text-[13px] font-semibold px-2.5 py-1"
            style={{ background: "#42413c", color: "#F3E7D4" }}
          >
            {mediaTypeLabels[type]}
          </span>
          {initialGenres.map((genre) => (
            <span key={genre} className={tagPill} style={tagStyle}>
              {genre}
            </span>
          ))}
          <span className={tagPill} style={tagStyle}>
            {officialRatingLabel(officialRating, type)} · classif. officielle
          </span>
        </div>
      )}

      {/* Title */}
      {isEditing ? (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-3xl font-bold mb-2"
          placeholder="Titre"
        />
      ) : (
        <h1
          className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-medium mb-2 leading-[1.04]"
          style={{ color: WARM_INK, letterSpacing: "-0.01em" }}
        >
          {title}
        </h1>
      )}

      {originalTitle && originalTitle !== title && (
        <p className="font-serif italic text-lg md:text-xl mb-3" style={{ color: WARM_INK2 }}>
          {originalTitle}
        </p>
      )}

      {/* Meta Info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-sm" style={{ color: WARM_INK2 }}>
        {releaseDate && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(releaseDate)}
          </span>
        )}
        {isEditing ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              type="number"
              className="w-20 h-7 text-sm"
              placeholder="min"
            />
            <span className="text-sm">min</span>
          </span>
        ) : (
          initialDuration && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {initialDuration} min
            </span>
          )
        )}
        {isEditing ? (
          <span className="flex items-center gap-1.5">
            <span className="text-sm">Réalisé par</span>
            <Input
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              className="w-48 h-7 text-sm"
              placeholder="Réalisateur"
            />
          </span>
        ) : (
          initialDirector && <span>Réalisé par {initialDirector}</span>
        )}
      </div>

      {/* Genres editor (edit mode only — display lives in the tags row above) */}
      {isEditing && (
        <div className="mb-4">
          <Input
            value={genresStr}
            onChange={(e) => setGenresStr(e.target.value)}
            placeholder="Genres (séparés par des virgules)"
          />
          <p className="text-xs mt-1" style={{ color: WARM_INK2 }}>
            Séparés par des virgules
          </p>
        </div>
      )}

      {/* VERDICT — placed before the synopsis (verdict-first hierarchy) */}
      {isEditing ? (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm" style={{ color: WARM_INK2 }}>
            Âge expert:
          </span>
          <Input
            value={expertAgeRec}
            onChange={(e) => setExpertAgeRec(e.target.value)}
            type="number"
            min={0}
            max={21}
            className="w-20 h-9"
            placeholder="Âge"
          />
        </div>
      ) : (
        <AgeRecommendationsRow
          expertAge={initialAge}
          reviews={reviews}
          mediaId={mediaId}
          isProvisional={isProvisional}
          ageRationale={ageRationale}
        />
      )}

      {/* Synopsis */}
      {isEditing ? (
        <Textarea
          value={synopsisFr}
          onChange={(e) => setSynopsisFr(e.target.value)}
          className="mb-2 max-w-3xl min-h-[120px]"
          placeholder="Synopsis en français"
        />
      ) : (
        <p className="leading-relaxed max-w-3xl text-[16px] md:text-[16.5px]" style={{ color: WARM_INK2 }}>
          {initialSynopsis}
        </p>
      )}

      {/* Floating Admin Bar */}
      {isAdmin && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-white shadow-lg rounded-full px-4 py-2 border border-gray-200">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
            Admin
          </Badge>
          {isEditing ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" /> Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Enregistrer
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Modifier
            </Button>
          )}
        </div>
      )}
    </>
  )
}

// Verdict-first age block: a prominent "Notre recommandation" strip with a
// big amber badge, plus the community parent/kid averages when they exist.
// Compact rationale shown on hover/focus of the age bubble. Mirrors the
// structured-data FAQ wording (single source: buildAgeRationale). Crawlable
// reasoning lives in the JSON-LD; this is the on-screen, on-demand companion.
function AgeRationaleTooltip({ rationale }: { rationale: AgeRationale }) {
  return (
    <div className="max-w-[20rem] text-left">
      <p className="font-semibold text-sm mb-1">{rationale.heading}</p>
      <p className="text-xs leading-relaxed opacity-90">{rationale.lead}</p>

      {rationale.drivers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rationale.drivers.map((d) => (
            <span
              key={d.key}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-black/5 dark:bg-white/10"
            >
              {d.label}
              <span className="opacity-70">· {d.level}</span>
            </span>
          ))}
        </div>
      )}

      {rationale.positives.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed opacity-90">
          <span className="font-medium">Points d&apos;appui :</span>{" "}
          {rationale.positives.join(", ")}.
        </p>
      )}

      {rationale.contextNotes.map((note) => (
        <p key={note} className="mt-2 text-xs leading-relaxed opacity-90">
          {note}
        </p>
      ))}

      <p className="mt-2 pt-2 border-t border-black/10 dark:border-white/15 text-[11px] leading-relaxed opacity-80">
        {rationale.trustLine}{" "}
        <Link href="/notre-methode#recommandations-age" className="font-medium underline">
          Notre méthode
        </Link>
      </p>
    </div>
  )
}

function AgeRecommendationsRow({
  expertAge,
  reviews,
  mediaId,
  isProvisional = false,
  ageRationale,
}: {
  expertAge: number | null
  reviews: Review[]
  mediaId: string
  isProvisional?: boolean
  ageRationale?: AgeRationale
}) {
  const isRated = expertAge !== null && expertAge !== undefined && expertAge > 0

  const parentReviews = reviews.filter((r) => r.role === "PARENT")
  const kidReviews = reviews.filter((r) => r.role === "KID")
  const parentAvg = parentReviews.length > 0
    ? Math.round(parentReviews.reduce((acc, r) => acc + r.ageSuggestion, 0) / parentReviews.length)
    : null
  const kidAvg = kidReviews.length > 0
    ? Math.round(kidReviews.reduce((acc, r) => acc + r.ageSuggestion, 0) / kidReviews.length)
    : null
  const totalReviews = reviews.length

  if (!isRated && parentAvg === null && kidAvg === null) return null

  const WARM_INK = "var(--color-warm-ink)"
  const WARM_INK2 = "var(--color-warm-ink2)"
  const WARM_CARD = "var(--color-warm-card)"
  const WARM_LINE = "var(--color-warm-line)"

  return (
    <div className="flex flex-col gap-3 mb-5">
      {/* Expert recommendation — the verdict strip */}
      {isRated && (
        <div
          className="flex items-center gap-4 rounded-xl px-4 py-3"
          style={{
            // Dark-aware warm tokens (flip via [data-theme="dark"]) — the old
            // hardcoded cream hex stayed light in Soirée mode.
            background: "linear-gradient(135deg, var(--color-warm-bg2), var(--color-warm-card))",
            border: `1px solid ${WARM_LINE}`,
          }}
        >
          {ageRationale?.show ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${ageRationale.heading} — voir le détail`}
                    className="flex items-center justify-center rounded-full font-bold text-white shrink-0 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    style={{
                      width: 62,
                      height: 62,
                      fontSize: 23,
                      background: "radial-gradient(circle at 32% 28%,#F9A23E,#EF8C2A)",
                      boxShadow: "0 6px 14px -4px rgba(239,140,42,.6)",
                    }}
                  >
                    {expertAge}+
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" className="p-3">
                  <AgeRationaleTooltip rationale={ageRationale} />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div
              className="flex items-center justify-center rounded-full font-bold text-white shrink-0"
              style={{
                width: 62,
                height: 62,
                fontSize: 23,
                background: "radial-gradient(circle at 32% 28%,#F9A23E,#EF8C2A)",
                boxShadow: "0 6px 14px -4px rgba(239,140,42,.6)",
              }}
            >
              {expertAge}+
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "#EF8C2A" }}>
              Notre recommandation
            </div>
            <div
              className="font-serif font-bold leading-none my-0.5"
              style={{ fontSize: 22, color: WARM_INK }}
            >
              Dès {expertAge} ans
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <MethodBadge size="xs" />
              {isProvisional && <ProvisionalBadge size="sm" withTooltip />}
            </div>
          </div>
          <div className="ml-auto self-start">
            <AgeVoteButton mediaId={mediaId} />
          </div>
        </div>
      )}

      {/* Community averages — only when families have voted */}
      {(parentAvg !== null || kidAvg !== null) && (
        <div className="flex flex-wrap gap-3">
          {parentAvg !== null && (
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: WARM_CARD, border: `1px solid ${WARM_LINE}` }}
            >
              <div
                className="flex items-center justify-center h-10 w-10 rounded-full text-white font-bold text-base"
                style={{ background: "#A79BC7" }}
              >
                {parentAvg}+
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: WARM_INK }}>Parents</p>
                <p className="text-xs" style={{ color: WARM_INK2 }}>{totalReviews} avis</p>
              </div>
            </div>
          )}
          {kidAvg !== null && (
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
              style={{ background: WARM_CARD, border: `1px solid ${WARM_LINE}` }}
            >
              <div
                className="flex items-center justify-center h-10 w-10 rounded-full text-white font-bold text-base"
                style={{ background: "#D89AB0" }}
              >
                {kidAvg}+
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: WARM_INK }}>Enfants</p>
                <p className="text-xs" style={{ color: WARM_INK2 }}>{kidReviews.length} avis</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
