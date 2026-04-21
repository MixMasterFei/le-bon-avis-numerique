"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Save, X, Loader2, Calendar, Clock } from "lucide-react"
import { AgeVoteButton } from "./AgeVoteButton"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface Review {
  role: string
  ageSuggestion: number
}

interface MediaHeroEditableProps {
  isAdmin: boolean
  mediaId: string
  title: string
  synopsisFr: string | null
  expertAgeRec: number | null
  genres: string[]
  director: string | null | undefined
  duration: number | null | undefined
  releaseDate: string | null
  originalTitle: string | null | undefined
  reviews?: Review[]
}

export function MediaHeroEditable({
  isAdmin,
  mediaId,
  title: initialTitle,
  synopsisFr: initialSynopsis,
  expertAgeRec: initialAge,
  genres: initialGenres,
  director: initialDirector,
  duration: initialDuration,
  releaseDate,
  originalTitle,
  reviews = [],
}: MediaHeroEditableProps) {
  const p = APERCU_PALETTE
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

  const warmInputClass =
    "bg-white/70 border"

  return (
    <>
      {/* Eyebrow */}
      <div
        className="text-[11px] font-semibold mb-2 uppercase tracking-wide"
        style={{ color: p.accent }}
      >
        Analysé en détail
      </div>

      {/* Title */}
      {isEditing ? (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`font-serif text-3xl font-medium mb-2 ${warmInputClass}`}
          style={{ color: p.ink, borderColor: p.line2 }}
          placeholder="Titre"
        />
      ) : (
        <h1
          className="font-serif text-[28px] md:text-4xl lg:text-5xl font-medium leading-[1.05] m-0"
          style={{ letterSpacing: "-0.02em", color: p.ink }}
        >
          {title}
        </h1>
      )}

      {originalTitle && originalTitle !== title && (
        <p
          className="font-serif italic text-lg md:text-xl mt-2"
          style={{ color: p.ink2 }}
        >
          {originalTitle}
        </p>
      )}

      {/* Meta Info */}
      <div
        className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
        style={{ color: p.ink2 }}
      >
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
              className={`w-20 h-7 text-sm ${warmInputClass}`}
              style={{ color: p.ink, borderColor: p.line2 }}
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
              className={`w-48 h-7 text-sm ${warmInputClass}`}
              style={{ color: p.ink, borderColor: p.line2 }}
              placeholder="Réalisateur"
            />
          </span>
        ) : (
          initialDirector && <span>Réalisé par {initialDirector}</span>
        )}
      </div>

      {/* Genres */}
      {isEditing ? (
        <div className="mt-4">
          <Input
            value={genresStr}
            onChange={(e) => setGenresStr(e.target.value)}
            className={warmInputClass}
            style={{ color: p.ink, borderColor: p.line2 }}
            placeholder="Genres (séparés par des virgules)"
          />
          <p className="text-xs mt-1" style={{ color: p.ink2 }}>
            Séparés par des virgules
          </p>
        </div>
      ) : (
        initialGenres.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {initialGenres.map((genre) => (
              <span
                key={genre}
                className="px-3 py-1 rounded-full text-xs"
                style={{
                  background: p.card,
                  border: `1px solid ${p.line}`,
                  color: p.ink2,
                }}
              >
                {genre}
              </span>
            ))}
          </div>
        )
      )}

      {/* Synopsis */}
      {isEditing ? (
        <Textarea
          value={synopsisFr}
          onChange={(e) => setSynopsisFr(e.target.value)}
          className={`mt-6 max-w-3xl min-h-[120px] ${warmInputClass}`}
          style={{ color: p.ink, borderColor: p.line2 }}
          placeholder="Synopsis en français"
        />
      ) : (
        initialSynopsis && (
          <p
            className="mt-6 text-[15px] md:text-base leading-relaxed max-w-2xl"
            style={{ color: p.ink }}
          >
            {initialSynopsis}
          </p>
        )
      )}

      {/* Age Recommendations Row */}
      {isEditing ? (
        <div className="mt-6 flex items-center gap-2">
          <span className="text-sm" style={{ color: p.ink2 }}>Âge expert:</span>
          <Input
            value={expertAgeRec}
            onChange={(e) => setExpertAgeRec(e.target.value)}
            type="number"
            min={0}
            max={21}
            className={`w-20 h-9 ${warmInputClass}`}
            style={{ color: p.ink, borderColor: p.line2 }}
            placeholder="Âge"
          />
        </div>
      ) : (
        <AgeRecommendationsRow expertAge={initialAge} reviews={reviews} mediaId={mediaId} />
      )}

      {/* Floating Admin Bar */}
      {isAdmin && (
        <div
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-2"
          style={{
            background: p.card,
            border: `1px solid ${p.line2}`,
            boxShadow: "0 10px 28px rgba(30,26,21,0.14)",
          }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(216,154,74,0.14)",
              color: "#8A5A1E",
            }}
          >
            Admin
          </span>
          {isEditing ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" /> Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Enregistrer
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 mr-1" /> Modifier
            </Button>
          )}
        </div>
      )}
    </>
  )
}

function AgeRecommendationsRow({ expertAge, reviews, mediaId }: { expertAge: number | null; reviews: Review[]; mediaId: string }) {
  const p = APERCU_PALETTE
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

  if (!isRated && !parentAvg && !kidAvg) return null

  const panelStyle = {
    background: p.card,
    border: `1px solid ${p.line}`,
  } as const

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
      {/* Expert recommendation */}
      {isRated && (
        <div
          className="inline-flex items-center gap-4 p-3 pr-4 rounded-xl"
          style={panelStyle}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: p.accent2, color: "#fff" }}
          >
            {expertAge}+
          </div>
          <div>
            <div
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: p.ink2 }}
            >
              Recommandation
            </div>
            <div
              className="font-serif text-base font-medium"
              style={{ color: p.ink, letterSpacing: "-0.01em" }}
            >
              dès {expertAge} ans
            </div>
          </div>
          <div className="ml-2">
            <AgeVoteButton mediaId={mediaId} />
          </div>
        </div>
      )}

      {/* Parent community */}
      {parentAvg !== null && (
        <div
          className="inline-flex items-center gap-3 px-4 py-3 rounded-xl"
          style={panelStyle}
        >
          <div
            className="flex items-center justify-center h-10 w-10 rounded-full text-white font-bold text-base"
            style={{ background: "#7C6BA8" }}
          >
            {parentAvg}+
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: p.ink }}>
              Parents
            </p>
            <p className="text-xs" style={{ color: p.ink2 }}>
              {totalReviews} avis
            </p>
          </div>
        </div>
      )}

      {/* Kids community */}
      {kidAvg !== null && (
        <div
          className="inline-flex items-center gap-3 px-4 py-3 rounded-xl"
          style={panelStyle}
        >
          <div
            className="flex items-center justify-center h-10 w-10 rounded-full text-white font-bold text-base"
            style={{ background: "#D89AB0" }}
          >
            {kidAvg}+
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: p.ink }}>
              Enfants
            </p>
            <p className="text-xs" style={{ color: p.ink2 }}>
              {kidReviews.length} avis
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
