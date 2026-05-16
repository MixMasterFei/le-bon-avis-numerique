"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Film,
  Shield,
  Heart,
  Sparkles,
  Bookmark,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { QuizAnchorPicker, type AnchorEntry } from "@/components/profile/QuizAnchorPicker"
import { getMemberAge } from "@/lib/age-utils"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Quiz v1 (Phase 1) — 8 adaptive steps
//
// Same questions for children and adults; the copy flips based on memberAge.
// Step 6 (intimate scenes) is skipped for under-10. Step 8 (titres repères)
// is always-skippable and stores LOVED + NOT_FOR_ME reactions with
// source: "quiz_anchor".
// ---------------------------------------------------------------------------

const GENRES = [
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction",
  "Famille", "Action", "Documentaire", "Musical", "Drame",
  "Romance", "Thriller", "Horreur",
]

const POSITIVE_TONES: { value: string; label: string }[] = [
  { value: "Messages positifs", label: "Messages positifs" },
  { value: "Modèles inspirants", label: "Modèles inspirants" },
  { value: "Éducatif", label: "Aspect éducatif" },
  { value: "Humour", label: "Humour" },
  { value: "Émotion", label: "Émotion" },
  { value: "Dépaysement", label: "Dépaysement" },
  { value: "Réflexion", label: "Réflexion" },
]

// Sensitivity scale — 0 = tolerant, 3 = strict. UI options mirror the quiz UI;
// the underlying values feed both the smart filter and computeSensitivityScore.
const SENSITIVITY_OPTIONS = [
  { value: 0, emoji: "😎", label: "Pas du tout", description: "Aucun problème" },
  { value: 1, emoji: "🙂", label: "Un peu", description: "Tolère sans souci" },
  { value: 2, emoji: "😐", label: "Oui", description: "Préfère éviter" },
  { value: 3, emoji: "🚫", label: "Beaucoup", description: "À éviter absolument" },
]

interface QuizAnswers {
  favoriteGenres: string[]
  dislikedGenres: string[]
  sensitivityViolence: number
  sensitivityScary: number
  sensitivityLanguage: number
  sensitivitySexual: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  preferredTones: string[]
}

const DEFAULT_ANSWERS: QuizAnswers = {
  favoriteGenres: [],
  dislikedGenres: [],
  sensitivityViolence: 2,
  sensitivityScary: 2,
  sensitivityLanguage: 2,
  sensitivitySexual: 2,
  preferPositiveMessages: 1,
  preferRoleModels: 1,
  preferEducational: 1,
  preferredTones: [],
}

type StepId =
  | "genres-like"
  | "genres-dislike"
  | "sensitivity-violence"
  | "sensitivity-scary"
  | "sensitivity-language"
  | "sensitivity-sexual"
  | "positive-tones"
  | "anchor-titles"

interface StepDef {
  id: StepId
  section: string
  sectionIcon: React.ReactNode
}

const ALL_STEPS: StepDef[] = [
  { id: "genres-like", section: "Ses goûts", sectionIcon: <Film className="h-5 w-5" /> },
  { id: "genres-dislike", section: "Ses goûts", sectionIcon: <Film className="h-5 w-5" /> },
  { id: "sensitivity-violence", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" /> },
  { id: "sensitivity-scary", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" /> },
  { id: "sensitivity-language", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" /> },
  { id: "sensitivity-sexual", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" /> },
  { id: "positive-tones", section: "Ce qui compte", sectionIcon: <Heart className="h-5 w-5" /> },
  { id: "anchor-titles", section: "Titres repères", sectionIcon: <Bookmark className="h-5 w-5" /> },
]

interface PreferenceQuizProps {
  memberId: string
  memberName: string
  memberEmoji: string
  birthYear?: number | null
  birthMonth?: number | null
  onComplete?: () => void
}

// Copy varies depending on whether we're profiling a child (parent perspective)
// or a teen/adult (first-person). Mode flips at memberAge >= 16 — old enough
// to answer for themselves in front of the parent.
type Mode = "child" | "self"

function copyForStep(step: StepId, mode: Mode, name: string): { title: string; subtitle?: string } {
  if (mode === "child") {
    switch (step) {
      case "genres-like":
        return {
          title: `Quels genres ${name} adore ?`,
          subtitle: "Sélectionnez les genres qu'il/elle préfère",
        }
      case "genres-dislike":
        return {
          title: `Y a-t-il des genres que ${name} n'aime pas ?`,
          subtitle: "Optionnel — sélectionnez ceux à éviter",
        }
      case "sensitivity-violence":
        return { title: `La violence à l'écran dérange-t-elle ${name} ?` }
      case "sensitivity-scary":
        return { title: `Les scènes effrayantes dérangent-elles ${name} ?` }
      case "sensitivity-language":
        return { title: `Le langage cru dérange-t-il ${name} ?` }
      case "sensitivity-sexual":
        return { title: `Les scènes intimes ou la nudité dérangent-elles ${name} ?` }
      case "positive-tones":
        return {
          title: `Qu'attend ${name} le plus souvent d'un film ou d'une série ?`,
          subtitle: "Plusieurs réponses possibles",
        }
      case "anchor-titles":
        return {
          title: `Quels titres définissent ${name} ?`,
          subtitle:
            "Ajoutez quelques films, séries ou jeux qu'il/elle adore — et ceux qu'on évite. Vous pouvez passer cette étape.",
        }
    }
  }
  // Self / adult / teen mode
  switch (step) {
    case "genres-like":
      return { title: "Quels genres vous parlent ?", subtitle: "Sélectionnez vos préférés" }
    case "genres-dislike":
      return { title: "Quels genres préférez-vous éviter ?", subtitle: "Optionnel" }
    case "sensitivity-violence":
      return { title: "La violence à l'écran vous dérange ?" }
    case "sensitivity-scary":
      return { title: "Les scènes effrayantes vous dérangent ?" }
    case "sensitivity-language":
      return { title: "Le langage cru vous dérange ?" }
    case "sensitivity-sexual":
      return { title: "Les scènes intimes ou la nudité vous dérangent ?" }
    case "positive-tones":
      return {
        title: "Qu'attendez-vous le plus souvent d'un film ou d'une série ?",
        subtitle: "Plusieurs réponses possibles",
      }
    case "anchor-titles":
      return {
        title: "Quels titres vous définissent ?",
        subtitle:
          "Ajoutez quelques films, séries ou jeux que vous adorez — et ceux à éviter. Vous pouvez passer cette étape.",
      }
  }
}

export function PreferenceQuiz({
  memberId,
  memberName,
  memberEmoji,
  birthYear,
  birthMonth,
  onComplete,
}: PreferenceQuizProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [answers, setAnswers] = useState<QuizAnswers>(DEFAULT_ANSWERS)
  const [lovedAnchors, setLovedAnchors] = useState<AnchorEntry[]>([])
  const [dislikedAnchors, setDislikedAnchors] = useState<AnchorEntry[]>([])

  const memberAge = useMemo(
    () => getMemberAge(birthYear ?? null, birthMonth ?? null),
    [birthYear, birthMonth],
  )
  const mode: Mode = memberAge != null && memberAge >= 16 ? "self" : "child"
  const skipSexualStep = memberAge != null && memberAge < 10

  // Build the step sequence — skip the sexual-content step for under-10s
  const steps = useMemo(
    () => ALL_STEPS.filter((s) => !(skipSexualStep && s.id === "sensitivity-sexual")),
    [skipSexualStep],
  )

  // Load existing preferences to pre-fill the quiz
  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch(`/api/user/family/${memberId}/preferences`)
        if (res.ok) {
          const data = await res.json()
          const m = data.member
          if (m) {
            setAnswers({
              favoriteGenres: m.favoriteGenres || [],
              dislikedGenres: m.dislikedGenres || [],
              sensitivityViolence: m.sensitivityViolence ?? 2,
              sensitivityScary: m.sensitivityScary ?? 2,
              sensitivityLanguage: m.sensitivityLanguage ?? 2,
              sensitivitySexual: m.sensitivitySexual ?? 2,
              preferPositiveMessages: m.preferPositiveMessages ?? 1,
              preferRoleModels: m.preferRoleModels ?? 1,
              preferEducational: m.preferEducational ?? 1,
              preferredTones: m.preferredTones || [],
            })
          }
        }
      } catch {
        // defaults
      } finally {
        setLoading(false)
      }
    }
    loadPreferences()
  }, [memberId])

  const totalSteps = steps.length
  const step = steps[currentStep]
  const progress = ((currentStep + 1) / totalSteps) * 100
  const copy = step ? copyForStep(step.id, mode, memberName) : { title: "" }

  const goNext = () => {
    if (currentStep < totalSteps - 1) setCurrentStep(currentStep + 1)
  }
  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const toggleGenre = (genre: string, list: "favoriteGenres" | "dislikedGenres") => {
    const otherList = list === "favoriteGenres" ? "dislikedGenres" : "favoriteGenres"
    setAnswers((prev) => ({
      ...prev,
      [list]: prev[list].includes(genre) ? prev[list].filter((g) => g !== genre) : [...prev[list], genre],
      [otherList]: prev[otherList].filter((g) => g !== genre),
    }))
  }

  const setNumeric = (field: keyof QuizAnswers, value: number) => {
    setAnswers((prev) => ({ ...prev, [field]: value }))
  }

  const toggleTone = (tone: string) => {
    setAnswers((prev) => ({
      ...prev,
      preferredTones: prev.preferredTones.includes(tone)
        ? prev.preferredTones.filter((t) => t !== tone)
        : [...prev.preferredTones, tone],
    }))
  }

  // Translate the multi-select "preferredTones" answer back into the existing
  // 0..3 preference scales so the legacy scoring layer keeps working unchanged.
  const buildPositivePrefs = (preferredTones: string[]) => {
    return {
      preferPositiveMessages: preferredTones.includes("Messages positifs") ? 3 : 1,
      preferRoleModels: preferredTones.includes("Modèles inspirants") ? 3 : 1,
      preferEducational: preferredTones.includes("Éducatif") ? 3 : 1,
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const positivePrefs = buildPositivePrefs(answers.preferredTones)
      const res = await fetch(`/api/user/family/${memberId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          favoriteGenres: answers.favoriteGenres,
          dislikedGenres: answers.dislikedGenres,
          sensitivityViolence: answers.sensitivityViolence,
          sensitivityScary: answers.sensitivityScary,
          sensitivityLanguage: answers.sensitivityLanguage,
          sensitivitySexual: answers.sensitivitySexual,
          ...positivePrefs,
          preferredTones: answers.preferredTones,
          quizVersion: 1,
          quizCompletedAt: new Date().toISOString(),
          useCustomSettings: true,
        }),
      })
      if (res.ok) {
        if (onComplete) {
          onComplete()
          return
        }
        setCompleted(true)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Erreur lors de l'enregistrement")
      }
    } catch {
      alert("Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (completed) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <div className="text-6xl">{memberEmoji}</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === "self"
              ? "Votre profil est complété !"
              : `Profil de ${memberName} complété !`}
          </h2>
          <p className="text-gray-600">
            Les recommandations vont devenir plus précises au fil des choix.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button onClick={() => router.push("/profil")} variant="outline">
            Retour au profil
          </Button>
          <Button onClick={() => router.push("/films")}>Découvrir des films</Button>
        </div>
      </div>
    )
  }

  // Combined exclusion set for anchor pickers: a title can't be both loved + disliked
  const allTakenIds = new Set([
    ...lovedAnchors.map((a) => a.id),
    ...dislikedAnchors.map((a) => a.id),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{memberEmoji}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {mode === "self" ? "Votre quiz de préférences" : `Quiz de préférences pour ${memberName}`}
            </h1>
            <p className="text-sm text-gray-500">
              Étape {currentStep + 1} sur {totalSteps}
            </p>
          </div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-primary font-medium">
          {step.sectionIcon}
          <span>{step.section}</span>
        </div>
      </div>

      {/* Question card */}
      <Card className="border-2">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
            {copy.subtitle && <p className="text-sm text-gray-500">{copy.subtitle}</p>}
          </div>

          {step.id === "genres-like" && (
            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre, "favoriteGenres")}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                    answers.favoriteGenres.includes(genre)
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50",
                  )}
                >
                  {answers.favoriteGenres.includes(genre) && "✓ "}
                  {genre}
                </button>
              ))}
            </div>
          )}

          {step.id === "genres-dislike" && (
            <div className="flex flex-wrap gap-2">
              {GENRES.filter((g) => !answers.favoriteGenres.includes(g)).map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre, "dislikedGenres")}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                    answers.dislikedGenres.includes(genre)
                      ? "bg-red-100 text-red-700 border-red-300"
                      : "bg-white text-gray-700 border-gray-200 hover:border-red-200",
                  )}
                >
                  {answers.dislikedGenres.includes(genre) && "✗ "}
                  {genre}
                </button>
              ))}
              {answers.favoriteGenres.length > 0 && (
                <p className="w-full text-xs text-gray-400 mt-2">
                  Les genres favoris ne sont pas affichés ici.
                </p>
              )}
            </div>
          )}

          {step.id === "sensitivity-violence" && (
            <SensitivityQuestion
              value={answers.sensitivityViolence}
              onChange={(v) => setNumeric("sensitivityViolence", v)}
            />
          )}
          {step.id === "sensitivity-scary" && (
            <SensitivityQuestion
              value={answers.sensitivityScary}
              onChange={(v) => setNumeric("sensitivityScary", v)}
            />
          )}
          {step.id === "sensitivity-language" && (
            <SensitivityQuestion
              value={answers.sensitivityLanguage}
              onChange={(v) => setNumeric("sensitivityLanguage", v)}
            />
          )}
          {step.id === "sensitivity-sexual" && (
            <SensitivityQuestion
              value={answers.sensitivitySexual}
              onChange={(v) => setNumeric("sensitivitySexual", v)}
            />
          )}

          {step.id === "positive-tones" && (
            <div className="flex flex-wrap gap-2">
              {POSITIVE_TONES.map((tone) => (
                <button
                  key={tone.value}
                  onClick={() => toggleTone(tone.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                    answers.preferredTones.includes(tone.value)
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50",
                  )}
                >
                  {answers.preferredTones.includes(tone.value) && "✓ "}
                  {tone.label}
                </button>
              ))}
            </div>
          )}

          {step.id === "anchor-titles" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-rose-500" />
                  {mode === "self" ? "Ce que vous adorez" : `Ce que ${memberName} adore`}
                </h3>
                <QuizAnchorPicker
                  memberId={memberId}
                  memberName={memberName}
                  sentiment="love"
                  picks={lovedAnchors}
                  alreadyTaken={allTakenIds}
                  onChange={setLovedAnchors}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-slate-500" />
                  {mode === "self" ? "À ne pas me recommander" : `À ne pas recommander à ${memberName}`}
                </h3>
                <QuizAnchorPicker
                  memberId={memberId}
                  memberName={memberName}
                  sentiment="dislike"
                  picks={dislikedAnchors}
                  alreadyTaken={allTakenIds}
                  onChange={setDislikedAnchors}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={goPrev}
          disabled={currentStep === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>

        {currentStep < totalSteps - 1 ? (
          <Button onClick={goNext} className="gap-1">
            {step.id === "anchor-titles" ? "Passer" : "Suivant"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Terminer
          </Button>
        )}
      </div>
    </div>
  )
}

function SensitivityQuestion({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-3">
      {SENSITIVITY_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
            value === option.value
              ? "border-primary bg-primary/5"
              : "border-gray-200 hover:border-gray-300",
          )}
        >
          <span className="text-2xl">{option.emoji}</span>
          <div>
            <p className="font-medium text-gray-900">{option.label}</p>
            <p className="text-sm text-gray-500">{option.description}</p>
          </div>
          {value === option.value && <Check className="h-5 w-5 text-primary ml-auto" />}
        </button>
      ))}
    </div>
  )
}
