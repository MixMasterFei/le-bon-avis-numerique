"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Save, X, Loader2, Calendar, Clock } from "lucide-react"
import { AgeBadge } from "./AgeBadge"

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

  return (
    <>
      {/* Title */}
      {isEditing ? (
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-3xl font-bold mb-2 bg-white/10 border-white/30 text-white placeholder:text-white/50"
          placeholder="Titre"
        />
      ) : (
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">
          {title}
        </h1>
      )}

      {originalTitle && originalTitle !== title && (
        <p className="text-xl text-gray-400 mb-4">{originalTitle}</p>
      )}

      {/* Meta Info */}
      <div className="flex flex-wrap items-center gap-4 text-gray-300 mb-6">
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
              className="w-20 h-7 text-sm bg-white/10 border-white/30 text-white"
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
              className="w-48 h-7 text-sm bg-white/10 border-white/30 text-white"
              placeholder="Réalisateur"
            />
          </span>
        ) : (
          initialDirector && <span>Réalisé par {initialDirector}</span>
        )}
      </div>

      {/* Genres */}
      {isEditing ? (
        <div className="mb-4">
          <Input
            value={genresStr}
            onChange={(e) => setGenresStr(e.target.value)}
            className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
            placeholder="Genres (séparés par des virgules)"
          />
          <p className="text-xs text-gray-400 mt-1">Séparés par des virgules</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {initialGenres.map((genre) => (
            <Badge
              key={genre}
              variant="outline"
              className="border-white/30 text-white"
            >
              {genre}
            </Badge>
          ))}
        </div>
      )}

      {/* Synopsis */}
      {isEditing ? (
        <Textarea
          value={synopsisFr}
          onChange={(e) => setSynopsisFr(e.target.value)}
          className="mb-8 max-w-3xl bg-white/10 border-white/30 text-white placeholder:text-white/50 min-h-[120px]"
          placeholder="Synopsis en français"
        />
      ) : (
        <p className="text-gray-300 leading-relaxed mb-8 max-w-3xl">
          {initialSynopsis}
        </p>
      )}

      {/* Age Recommendations Row - Expert + Community side by side */}
      {isEditing ? (
        <div className="flex items-center gap-2 mb-6">
          <span className="text-sm text-gray-300">Âge expert:</span>
          <Input
            value={expertAgeRec}
            onChange={(e) => setExpertAgeRec(e.target.value)}
            type="number"
            min={0}
            max={21}
            className="w-20 h-9 bg-white/10 border-white/30 text-white"
            placeholder="Âge"
          />
        </div>
      ) : (
        <AgeRecommendationsRow expertAge={initialAge} reviews={reviews} />
      )}

      {/* Floating Admin Bar */}
      {isAdmin && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-white shadow-lg rounded-full px-4 py-2 border border-gray-200">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
            Admin
          </Badge>
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

// Unified expert + community age recommendations row
function AgeRecommendationsRow({ expertAge, reviews }: { expertAge: number | null; reviews: Review[] }) {
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

  const getBgColor = (age: number) => {
    if (age <= 3) return "bg-emerald-500"
    if (age <= 7) return "bg-emerald-600"
    if (age <= 10) return "bg-amber-500"
    if (age <= 13) return "bg-orange-500"
    return "bg-red-500"
  }

  if (!isRated && !parentAvg && !kidAvg) return null

  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-3 mb-6">
      {/* Expert recommendation */}
      {isRated && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white/10 backdrop-blur-sm rounded-xl">
          <div className={`flex items-center justify-center h-12 w-12 rounded-full text-white font-bold text-lg shadow-md ${getBgColor(expertAge!)}`}>
            {expertAge}+
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Nos experts</p>
            <p className="text-xs text-white/60">dès {expertAge} ans</p>
          </div>
        </div>
      )}

      {/* Parent community */}
      {parentAvg !== null && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-violet-500/80 text-white font-bold text-base">
            {parentAvg}+
          </div>
          <div>
            <p className="text-sm font-medium text-white/90">Parents</p>
            <p className="text-xs text-white/50">{totalReviews} avis</p>
          </div>
        </div>
      )}

      {/* Kids community */}
      {kidAvg !== null && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-pink-500/80 text-white font-bold text-base">
            {kidAvg}+
          </div>
          <div>
            <p className="text-sm font-medium text-white/90">Enfants</p>
            <p className="text-xs text-white/50">{kidReviews.length} avis</p>
          </div>
        </div>
      )}
    </div>
  )
}
