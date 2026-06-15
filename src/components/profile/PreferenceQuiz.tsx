"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
  Gamepad2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { QuizAnchorPicker, type AnchorEntry } from "@/components/profile/QuizAnchorPicker"
import { getMemberAge } from "@/lib/age-utils"
import { mergeDislikedGenres, partitionDislikedGenres } from "@/lib/disliked-genres"
import {
  QUIZ_AVOID_TOPICS,
  QUIZ_FAVORITE_GENRES,
  QUIZ_GAMEPLAY_STYLES,
  QUIZ_HARD_AVOID_GENRES,
  QUIZ_INTEREST_CHIPS,
  QUIZ_POSITIVE_OPTIONS,
  QUIZ_SENSITIVITY_OPTIONS,
  QUIZ_SOFT_DISLIKE_GENRES,
  QUIZ_VERSION,
} from "@/lib/preference-quiz-config"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Quiz v2 — Light (~3 min) + Deep optionnel (~5 min)
//
// Light  : goûts, évitements (hard vs soft), sensibilité essentielle
// Deep   : substances, contenu positif (sliders), thèmes à éviter,
//          centres d'intérêt, jeux, titres repères
// ---------------------------------------------------------------------------

type Mode = "child" | "self"
type Phase = "light" | "deep" | "done"

type StepId =
  | "genres-like"
  | "genres-hard-avoid"
  | "genres-soft-dislike"
  | "sensitivity-violence"
  | "sensitivity-scary"
  | "sensitivity-language"
  | "sensitivity-sexual"
  | "sensitivity-substances"
  | "positive-content"
  | "avoid-topics"
  | "interests"
  | "gameplay-style"
  | "anchor-titles"

interface StepDef {
  id: StepId
  section: string
  sectionIcon: React.ReactNode
  phase: Phase
}

interface QuizAnswers {
  favoriteGenres: string[]
  hardAvoidGenres: string[]
  softDislikeGenres: string[]
  sensitivityViolence: number
  sensitivityScary: number
  sensitivityLanguage: number
  sensitivitySexual: number
  sensitivitySubstances: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  avoidTopics: string[]
  interests: string[]
  gameplayStyles: string[]
}

const DEFAULT_ANSWERS: QuizAnswers = {
  favoriteGenres: [],
  hardAvoidGenres: [],
  softDislikeGenres: [],
  sensitivityViolence: 2,
  sensitivityScary: 2,
  sensitivityLanguage: 2,
  sensitivitySexual: 2,
  sensitivitySubstances: 2,
  preferPositiveMessages: 1,
  preferRoleModels: 1,
  preferEducational: 1,
  avoidTopics: [],
  interests: [],
  gameplayStyles: [],
}

const LIGHT_STEPS: StepDef[] = [
  { id: "genres-like", section: "Ses goûts", sectionIcon: <Film className="h-5 w-5" />, phase: "light" },
  { id: "genres-hard-avoid", section: "À éviter", sectionIcon: <Shield className="h-5 w-5" />, phase: "light" },
  { id: "genres-soft-dislike", section: "Moins fan", sectionIcon: <Film className="h-5 w-5" />, phase: "light" },
  { id: "sensitivity-violence", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" />, phase: "light" },
  { id: "sensitivity-scary", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" />, phase: "light" },
  { id: "sensitivity-language", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" />, phase: "light" },
  { id: "sensitivity-sexual", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" />, phase: "light" },
]

const DEEP_STEPS: StepDef[] = [
  { id: "sensitivity-substances", section: "Tolérance", sectionIcon: <Shield className="h-5 w-5" />, phase: "deep" },
  { id: "positive-content", section: "Ce qui compte", sectionIcon: <Heart className="h-5 w-5" />, phase: "deep" },
  { id: "avoid-topics", section: "Thèmes sensibles", sectionIcon: <AlertCircle className="h-5 w-5" />, phase: "deep" },
  { id: "interests", section: "Centres d'intérêt", sectionIcon: <Sparkles className="h-5 w-5" />, phase: "deep" },
  { id: "gameplay-style", section: "Côté jeux", sectionIcon: <Gamepad2 className="h-5 w-5" />, phase: "deep" },
  { id: "anchor-titles", section: "Titres repères", sectionIcon: <Bookmark className="h-5 w-5" />, phase: "deep" },
]

interface PreferenceQuizProps {
  memberId: string
  memberName: string
  memberEmoji: string
  birthYear?: number | null
  birthMonth?: number | null
  /** Start directly on deep steps (e.g. from profile "Affiner"). */
  initialPhase?: "light" | "deep"
  onComplete?: () => void
}

function copyForStep(step: StepId, mode: Mode, name: string): { title: string; subtitle?: string } {
  const possessive = mode === "self" ? "votre" : `de ${name}`

  const map: Record<StepId, { title: string; subtitle?: string }> = {
    "genres-like": {
      title: mode === "self" ? "Quels genres vous parlent ?" : `Quels genres ${name} adore ?`,
      subtitle: "Choisissez au moins un genre — c'est indispensable pour personnaliser.",
    },
    "genres-hard-avoid": {
      title: mode === "self" ? "Quels genres éviter absolument ?" : `Quels genres éviter pour ${name} ?`,
      subtitle: "Horreur, thriller, polar… — ceux-ci seront vraiment filtrés.",
    },
    "genres-soft-dislike": {
      title: mode === "self" ? "Moins fan de quels genres ?" : `${name} est moins fan de quoi ?`,
      subtitle:
        "Drame, romance, action… — on déclassera ces titres, sans les masquer systématiquement (un tag TMDB « Drame » ne vaut pas toujours un film d'auteur).",
    },
    "sensitivity-violence": {
      title: mode === "self" ? "La violence à l'écran vous dérange ?" : `La violence dérange-t-elle ${name} ?`,
    },
    "sensitivity-scary": {
      title: mode === "self" ? "Les scènes effrayantes vous dérangent ?" : `Les scènes effrayantes dérangent-elles ${name} ?`,
    },
    "sensitivity-language": {
      title: mode === "self" ? "Le langage cru vous dérange ?" : `Le langage cru dérange-t-il ${name} ?`,
    },
    "sensitivity-sexual": {
      title:
        mode === "self"
          ? "Les scènes intimes ou la nudité vous dérangent ?"
          : `Les scènes intimes dérangent-elles ${name} ?`,
    },
    "sensitivity-substances": {
      title: mode === "self" ? "Alcool, drogue ou tabac à l'écran ?" : `Alcool / drogue à l'écran — gênant pour ${name} ?`,
    },
    "positive-content": {
      title: mode === "self" ? "Quel contenu positif recherchez-vous ?" : `Quel contenu positif pour ${name} ?`,
      subtitle: "0 = indifférent · 3 = essentiel",
    },
    "avoid-topics": {
      title: mode === "self" ? "Des thèmes à exclure ?" : `Des thèmes à exclure pour ${name} ?`,
      subtitle: "Guerre, deuil, harcèlement… — optionnel",
    },
    interests: {
      title: mode === "self" ? "Vos centres d'intérêt ?" : `Les passions ${possessive}`,
      subtitle: "Optionnel — améliore les recommandations thématiques",
    },
    "gameplay-style": {
      title: mode === "self" ? "Comment aimez-vous jouer ?" : `Comment ${name} aime jouer ?`,
      subtitle: "Optionnel — laissez vide si pas de jeux vidéo",
    },
    "anchor-titles": {
      title: mode === "self" ? "Quels titres vous définissent ?" : `Quels titres définissent ${name} ?`,
      subtitle: "Films, séries ou jeux adorés / à éviter — optionnel",
    },
  }
  return map[step]
}

function buildStepSequence(memberAge: number | null, run: "light" | "deep"): StepDef[] {
  const skipSexual = memberAge != null && memberAge < 10
  const base = run === "light" ? LIGHT_STEPS : DEEP_STEPS
  return skipSexual ? base.filter((s) => s.id !== "sensitivity-sexual") : base
}

export function PreferenceQuiz({
  memberId,
  memberName,
  memberEmoji,
  birthYear,
  birthMonth,
  initialPhase = "light",
  onComplete,
}: PreferenceQuizProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>(initialPhase === "deep" ? "deep" : "light")
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<QuizAnswers>(DEFAULT_ANSWERS)
  const [lovedAnchors, setLovedAnchors] = useState<AnchorEntry[]>([])
  const [dislikedAnchors, setDislikedAnchors] = useState<AnchorEntry[]>([])

  const memberAge = useMemo(
    () => getMemberAge(birthYear ?? null, birthMonth ?? null),
    [birthYear, birthMonth],
  )
  const mode: Mode = memberAge != null && memberAge >= 16 ? "self" : "child"

  const steps = useMemo(
    () => buildStepSequence(memberAge, phase === "deep" ? "deep" : "light"),
    [memberAge, phase],
  )
  const step = steps[currentStep]
  const copy = step ? copyForStep(step.id, mode, memberName) : { title: "" }
  const progress = ((currentStep + 1) / steps.length) * 100
  const isLastStep = currentStep === steps.length - 1
  const isLightLast = phase === "light" && isLastStep

  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch(`/api/user/family/${memberId}/preferences`)
        if (!res.ok) return
        const data = await res.json()
        const m = data.member
        if (!m) return

        const { hardAvoid, softDislike } = partitionDislikedGenres(m.dislikedGenres || [])
        const gameplayValues = new Set<string>(QUIZ_GAMEPLAY_STYLES.map((g) => g.value))
        const storedTones: string[] = m.preferredTones || []

        setAnswers({
          favoriteGenres: m.favoriteGenres || [],
          hardAvoidGenres: hardAvoid,
          softDislikeGenres: softDislike,
          sensitivityViolence: m.sensitivityViolence ?? 2,
          sensitivityScary: m.sensitivityScary ?? 2,
          sensitivityLanguage: m.sensitivityLanguage ?? 2,
          sensitivitySexual: m.sensitivitySexual ?? 2,
          sensitivitySubstances: m.sensitivitySubstances ?? 2,
          preferPositiveMessages: m.preferPositiveMessages ?? 1,
          preferRoleModels: m.preferRoleModels ?? 1,
          preferEducational: m.preferEducational ?? 1,
          avoidTopics: m.avoidTopics || [],
          interests: m.interests || [],
          gameplayStyles: storedTones.filter((t: string) => gameplayValues.has(t)),
        })
      } catch {
        // defaults
      } finally {
        setLoading(false)
      }
    }
    loadPreferences()
  }, [memberId])

  const toggleGenre = useCallback(
    (genre: string, list: "favoriteGenres" | "hardAvoidGenres" | "softDislikeGenres") => {
      setAnswers((prev) => {
        const inList = prev[list].includes(genre)
        const nextList = inList ? prev[list].filter((g) => g !== genre) : [...prev[list], genre]
        const cleared = {
          favoriteGenres: list === "favoriteGenres" ? nextList : prev.favoriteGenres.filter((g) => g !== genre),
          hardAvoidGenres: list === "hardAvoidGenres" ? nextList : prev.hardAvoidGenres.filter((g) => g !== genre),
          softDislikeGenres: list === "softDislikeGenres" ? nextList : prev.softDislikeGenres.filter((g) => g !== genre),
        }
        return { ...prev, ...cleared, [list]: nextList }
      })
      setValidationError(null)
    },
    [],
  )

  const toggleChip = (field: "avoidTopics" | "interests" | "gameplayStyles", value: string) => {
    setAnswers((prev) => {
      const list = prev[field]
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...prev, [field]: next }
    })
  }

  const setNumeric = (field: keyof QuizAnswers, value: number) => {
    setAnswers((prev) => ({ ...prev, [field]: value }))
  }

  const payloadFromAnswers = useCallback(
    () => ({
      favoriteGenres: answers.favoriteGenres,
      dislikedGenres: mergeDislikedGenres(answers.hardAvoidGenres, answers.softDislikeGenres),
      sensitivityViolence: answers.sensitivityViolence,
      sensitivityScary: answers.sensitivityScary,
      sensitivityLanguage: answers.sensitivityLanguage,
      sensitivitySexual: answers.sensitivitySexual,
      sensitivitySubstances: answers.sensitivitySubstances,
      preferPositiveMessages: answers.preferPositiveMessages,
      preferRoleModels: answers.preferRoleModels,
      preferEducational: answers.preferEducational,
      avoidTopics: answers.avoidTopics,
      interests: answers.interests,
      preferredTones: answers.gameplayStyles,
      quizVersion: QUIZ_VERSION,
      quizCompletedAt: new Date().toISOString(),
      useCustomSettings: true,
    }),
    [answers],
  )

  const saveQuiz = async (finishPhase: "light" | "deep") => {
    setSaving(true)
    setValidationError(null)
    try {
      const res = await fetch(`/api/user/family/${memberId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromAnswers()),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setValidationError(data.error || "Erreur lors de l'enregistrement")
        return false
      }
      if (finishPhase === "light") {
        setPhase("done")
      } else {
        if (onComplete) {
          onComplete()
          return true
        }
        setPhase("done")
      }
      return true
    } catch {
      setValidationError("Erreur lors de l'enregistrement")
      return false
    } finally {
      setSaving(false)
    }
  }

  const goNext = async () => {
    if (step?.id === "genres-like" && answers.favoriteGenres.length === 0) {
      setValidationError("Sélectionnez au moins un genre favori pour continuer.")
      return
    }
    if (isLightLast) {
      await saveQuiz("light")
      return
    }
    if (isLastStep && phase === "deep") {
      await saveQuiz("deep")
      return
    }
    setCurrentStep((i) => Math.min(steps.length - 1, i + 1))
  }

  const goPrev = () => setCurrentStep((i) => Math.max(0, i - 1))

  const startDeep = () => {
    setPhase("deep")
    setCurrentStep(0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <div className="text-6xl">{memberEmoji}</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === "self" ? "Profil enregistré !" : `Profil de ${memberName} enregistré !`}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Les repères « Pour {memberName} » et les recommandations vont s&apos;affiner. Pas d&apos;accord avec
            un âge conseillé sur une fiche ? Complétez ce quiz et votez sur la page du titre.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {initialPhase !== "deep" && (
            <Button onClick={startDeep} variant="outline">
              Affiner encore (5 min)
            </Button>
          )}
          <Button onClick={() => router.push("/profil")} variant="outline">
            Retour au profil
          </Button>
          <Button onClick={() => router.push("/films")}>Découvrir le catalogue</Button>
        </div>
      </div>
    )
  }

  const allTakenIds = new Set([...lovedAnchors.map((a) => a.id), ...dislikedAnchors.map((a) => a.id)])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{memberEmoji}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {mode === "self" ? "Quiz de préférences" : `Quiz pour ${memberName}`}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {phase === "deep" ? "· Affinage" : "· Essentiel"}
              </span>
            </h1>
            <p className="text-sm text-gray-500">
              Étape {currentStep + 1} sur {steps.length}
            </p>
          </div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        {step && (
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            {step.sectionIcon}
            <span>{step.section}</span>
          </div>
        )}
      </div>

      {validationError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{validationError}</p>
      )}

      <Card className="border-2">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
            {copy.subtitle && <p className="text-sm text-gray-500">{copy.subtitle}</p>}
          </div>

          {step?.id === "genres-like" && (
            <GenreGrid
              genres={QUIZ_FAVORITE_GENRES}
              selected={answers.favoriteGenres}
              onToggle={(g) => toggleGenre(g, "favoriteGenres")}
              variant="favorite"
            />
          )}

          {step?.id === "genres-hard-avoid" && (
            <GenreGrid
              genres={QUIZ_HARD_AVOID_GENRES}
              selected={answers.hardAvoidGenres}
              onToggle={(g) => toggleGenre(g, "hardAvoidGenres")}
              variant="hard"
            />
          )}

          {step?.id === "genres-soft-dislike" && (
            <GenreGrid
              genres={QUIZ_SOFT_DISLIKE_GENRES.filter((g) => !answers.favoriteGenres.includes(g))}
              selected={answers.softDislikeGenres}
              onToggle={(g) => toggleGenre(g, "softDislikeGenres")}
              variant="soft"
            />
          )}

          {step?.id === "sensitivity-violence" && (
            <SensitivityQuestion value={answers.sensitivityViolence} onChange={(v) => setNumeric("sensitivityViolence", v)} />
          )}
          {step?.id === "sensitivity-scary" && (
            <SensitivityQuestion value={answers.sensitivityScary} onChange={(v) => setNumeric("sensitivityScary", v)} />
          )}
          {step?.id === "sensitivity-language" && (
            <SensitivityQuestion value={answers.sensitivityLanguage} onChange={(v) => setNumeric("sensitivityLanguage", v)} />
          )}
          {step?.id === "sensitivity-sexual" && (
            <SensitivityQuestion value={answers.sensitivitySexual} onChange={(v) => setNumeric("sensitivitySexual", v)} />
          )}
          {step?.id === "sensitivity-substances" && (
            <SensitivityQuestion value={answers.sensitivitySubstances} onChange={(v) => setNumeric("sensitivitySubstances", v)} />
          )}

          {step?.id === "positive-content" && (
            <div className="space-y-5">
              <PositiveSlider
                label="Messages positifs / valeurs"
                value={answers.preferPositiveMessages}
                onChange={(v) => setNumeric("preferPositiveMessages", v)}
              />
              <PositiveSlider
                label="Modèles / héros inspirants"
                value={answers.preferRoleModels}
                onChange={(v) => setNumeric("preferRoleModels", v)}
              />
              <PositiveSlider
                label="Aspect éducatif"
                value={answers.preferEducational}
                onChange={(v) => setNumeric("preferEducational", v)}
              />
            </div>
          )}

          {step?.id === "avoid-topics" && (
            <ChipGrid
              items={QUIZ_AVOID_TOPICS}
              selected={answers.avoidTopics}
              onToggle={(t) => toggleChip("avoidTopics", t)}
              variant="avoid"
            />
          )}

          {step?.id === "interests" && (
            <ChipGrid
              items={QUIZ_INTEREST_CHIPS}
              selected={answers.interests}
              onToggle={(t) => toggleChip("interests", t)}
              variant="interest"
            />
          )}

          {step?.id === "gameplay-style" && (
            <div className="flex flex-wrap gap-2">
              {QUIZ_GAMEPLAY_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => toggleChip("gameplayStyles", style.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium border-2 flex items-center gap-1.5",
                    answers.gameplayStyles.includes(style.value)
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50",
                  )}
                >
                  <span aria-hidden>{style.emoji}</span>
                  {style.label}
                </button>
              ))}
            </div>
          )}

          {step?.id === "anchor-titles" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-rose-500" />
                  {mode === "self" ? "Adorés" : `Adorés par ${memberName}`}
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
                  À ne pas recommander
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

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goPrev} disabled={currentStep === 0} className="gap-1">
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>
        <Button onClick={goNext} disabled={saving} className="gap-1">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLastStep ? (
            <Check className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {isLightLast ? "Enregistrer le profil" : isLastStep && phase === "deep" ? "Terminer" : "Suivant"}
        </Button>
      </div>

      <div className="flex justify-center">
        {!isLastStep ? (
          <button type="button" onClick={goNext} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">
            Passer cette étape
          </button>
        ) : step?.id === "anchor-titles" ? (
          <button
            type="button"
            onClick={goNext}
            disabled={saving}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 disabled:opacity-50"
          >
            Terminer sans titres repères
          </button>
        ) : null}
      </div>

      <p className="text-center text-xs text-gray-400">
        Pas d&apos;accord avec un repère d&apos;âge sur une fiche ?{" "}
        <Link href="/profil" className="underline hover:text-gray-600">
          Ce quiz affine les goûts
        </Link>
        , pas l&apos;âge expert — votez aussi sur la page du titre.
      </p>
    </div>
  )
}

function GenreGrid({
  genres,
  selected,
  onToggle,
  variant,
}: {
  genres: readonly string[]
  selected: string[]
  onToggle: (g: string) => void
  variant: "favorite" | "hard" | "soft"
}) {
  const active =
    variant === "hard"
      ? "bg-red-100 text-red-800 border-red-300"
      : variant === "soft"
        ? "bg-amber-50 text-amber-900 border-amber-200"
        : "bg-primary text-white border-primary"
  const idle =
    variant === "hard"
      ? "hover:border-red-200"
      : variant === "soft"
        ? "hover:border-amber-200"
        : "hover:border-primary/50"

  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((genre) => (
        <button
          key={genre}
          type="button"
          onClick={() => onToggle(genre)}
          className={cn(
            "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 bg-white text-gray-700",
            selected.includes(genre) ? active : cn("border-gray-200", idle),
          )}
        >
          {selected.includes(genre) && (variant === "hard" ? "✗ " : "✓ ")}
          {genre}
        </button>
      ))}
    </div>
  )
}

function ChipGrid({
  items,
  selected,
  onToggle,
  variant,
}: {
  items: readonly string[]
  selected: string[]
  onToggle: (v: string) => void
  variant: "avoid" | "interest"
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onToggle(item)}
          className={cn(
            "px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all",
            selected.includes(item)
              ? variant === "avoid"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-primary text-white border-primary"
              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300",
          )}
        >
          {selected.includes(item) ? "✓ " : ""}
          {item}
        </button>
      ))}
    </div>
  )
}

function PositiveSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-gray-800">{label}</span>
        <span className="text-gray-500">{QUIZ_POSITIVE_OPTIONS[value]?.label ?? value}</span>
      </div>
      <div className="flex gap-2">
        {QUIZ_POSITIVE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-all",
              value === opt.value ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-300",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SensitivityQuestion({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-3">
      {QUIZ_SENSITIVITY_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
            value === option.value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300",
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
