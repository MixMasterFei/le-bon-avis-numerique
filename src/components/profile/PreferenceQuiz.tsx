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
  User,
  Users,
  Sofa,
  Trophy,
  X,
} from "lucide-react"
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

// ── Editorial art direction (matches the approved mockup) ────────────
// Structural colour comes from the site tokens (var(--color-*)) so the quiz
// follows Soirée; the pastels below are the catalogue's own badge family, used
// as the selected-state fills so the quiz speaks the same visual language.
const CHIP_INK = "#1E1A15"
const CHIP_PASTELS = ["#F4C7A6", "#B8D89A", "#F8D775", "#8DBDC9", "#C9B7D9", "#D89AB0"]
// Sensitivity severity ramp: green → yellow → peach → terracotta.
const SEVERITY = ["#B8D89A", "#F8D775", "#F4C7A6", "#E9A184"]
const GAMEPLAY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Jeu solo": User,
  "Jeu coop": Users,
  "Jeu en famille": Sofa,
  "Jeu compétitif": Trophy,
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase() || "?"
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
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--color-accent)" }} />
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <span
          className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}
        >
          <Check className="h-8 w-8" strokeWidth={2.4} />
        </span>
        <h2
          className="font-serif text-[26px] font-semibold"
          style={{ color: "var(--color-ink)", letterSpacing: "-0.02em" }}
        >
          {mode === "self" ? "Profil enregistré" : `Profil de ${memberName} enregistré`}
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-ink2)" }}>
          Les repères « Pour {memberName} » et les recommandations vont s&apos;affiner à chaque réaction.
          Pas d&apos;accord avec un âge conseillé sur une fiche&nbsp;? Votez aussi sur la page du titre.
        </p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          {initialPhase !== "deep" && (
            <QuizButton variant="ghost" onClick={startDeep}>Affiner encore (5 min)</QuizButton>
          )}
          <QuizButton variant="outline" onClick={() => router.push("/profil")}>Retour au profil</QuizButton>
          <QuizButton variant="cta" onClick={() => router.push("/films")}>Découvrir le catalogue</QuizButton>
        </div>
      </div>
    )
  }

  const allTakenIds = new Set([...lovedAnchors.map((a) => a.id), ...dislikedAnchors.map((a) => a.id)])

  return (
    <div className="max-w-2xl mx-auto">
      {validationError && (
        <div
          className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm"
          style={{
            background: "color-mix(in srgb, #C2412A 12%, transparent)",
            border: "1px solid color-mix(in srgb, #C2412A 30%, transparent)",
            color: "var(--color-ink)",
          }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" style={{ color: "#C2412A" }} />
          <span>{validationError}</span>
        </div>
      )}

      <div
        className="rounded-[22px] p-6 sm:p-8"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
          boxShadow: "0 10px 30px -24px rgba(40,28,12,.55)",
        }}
      >
        {/* Member context + segmented progress */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3.5 text-[13px] font-bold"
            style={{ background: "var(--color-bg2)", border: "1px solid var(--color-line)", color: "var(--color-ink2)" }}
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold"
              style={{ background: "color-mix(in srgb, var(--color-accent2) 24%, transparent)", color: "var(--color-accent2)" }}
            >
              {monogram(memberName)}
            </span>
            {mode === "self" ? "Vos préférences" : `Pour ${memberName}`}
            {memberAge != null ? ` · ${memberAge} ans` : ""}
          </span>
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className="h-1 w-6 rounded-full transition-colors"
                style={{
                  background: i <= currentStep ? "var(--color-accent)" : "var(--color-line)",
                  opacity: i === currentStep ? 0.5 : 1,
                }}
              />
            ))}
          </div>
        </div>

        {/* Kicker + question + help */}
        <div className="mt-6 text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-accent)" }}>
          Étape {currentStep + 1} sur {steps.length}
          {step ? ` · ${step.section}` : ""}
        </div>
        <h1
          className="mt-1.5 font-serif text-[clamp(21px,3.1vw,28px)] font-semibold leading-[1.12]"
          style={{ color: "var(--color-ink)", letterSpacing: "-0.02em" }}
        >
          {copy.title}
        </h1>
        {copy.subtitle && (
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--color-ink2)" }}>
            {copy.subtitle}
          </p>
        )}

        {/* Step content */}
        <div className="mt-6">
          {step?.id === "genres-like" && (
            <ChoiceChips
              items={QUIZ_FAVORITE_GENRES}
              selected={answers.favoriteGenres}
              onToggle={(g) => toggleGenre(g, "favoriteGenres")}
              variant="pastel"
            />
          )}

          {step?.id === "genres-hard-avoid" && (
            <ChoiceChips
              items={QUIZ_HARD_AVOID_GENRES}
              selected={answers.hardAvoidGenres}
              onToggle={(g) => toggleGenre(g, "hardAvoidGenres")}
              variant="hard"
            />
          )}

          {step?.id === "genres-soft-dislike" && (
            <ChoiceChips
              items={QUIZ_SOFT_DISLIKE_GENRES.filter((g) => !answers.favoriteGenres.includes(g))}
              selected={answers.softDislikeGenres}
              onToggle={(g) => toggleGenre(g, "softDislikeGenres")}
              variant="soft"
            />
          )}

          {step?.id === "sensitivity-violence" && (
            <SensitivityScale value={answers.sensitivityViolence} onChange={(v) => setNumeric("sensitivityViolence", v)} />
          )}
          {step?.id === "sensitivity-scary" && (
            <SensitivityScale value={answers.sensitivityScary} onChange={(v) => setNumeric("sensitivityScary", v)} />
          )}
          {step?.id === "sensitivity-language" && (
            <SensitivityScale value={answers.sensitivityLanguage} onChange={(v) => setNumeric("sensitivityLanguage", v)} />
          )}
          {step?.id === "sensitivity-sexual" && (
            <SensitivityScale value={answers.sensitivitySexual} onChange={(v) => setNumeric("sensitivitySexual", v)} />
          )}
          {step?.id === "sensitivity-substances" && (
            <SensitivityScale value={answers.sensitivitySubstances} onChange={(v) => setNumeric("sensitivitySubstances", v)} />
          )}

          {step?.id === "positive-content" && (
            <div className="space-y-5">
              <PositiveScale
                label="Messages positifs / valeurs"
                value={answers.preferPositiveMessages}
                onChange={(v) => setNumeric("preferPositiveMessages", v)}
              />
              <PositiveScale
                label="Modèles / héros inspirants"
                value={answers.preferRoleModels}
                onChange={(v) => setNumeric("preferRoleModels", v)}
              />
              <PositiveScale
                label="Aspect éducatif"
                value={answers.preferEducational}
                onChange={(v) => setNumeric("preferEducational", v)}
              />
            </div>
          )}

          {step?.id === "avoid-topics" && (
            <ChoiceChips
              items={QUIZ_AVOID_TOPICS}
              selected={answers.avoidTopics}
              onToggle={(t) => toggleChip("avoidTopics", t)}
              variant="avoid"
            />
          )}

          {step?.id === "interests" && (
            <ChoiceChips
              items={QUIZ_INTEREST_CHIPS}
              selected={answers.interests}
              onToggle={(t) => toggleChip("interests", t)}
              variant="pastel"
            />
          )}

          {step?.id === "gameplay-style" && (
            <div className="flex flex-wrap gap-2.5">
              {QUIZ_GAMEPLAY_STYLES.map((style) => {
                const Icon = GAMEPLAY_ICONS[style.value] ?? Gamepad2
                const sel = answers.gameplayStyles.includes(style.value)
                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => toggleChip("gameplayStyles", style.value)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
                    style={
                      sel
                        ? {
                            background: "color-mix(in srgb, var(--color-accent) 16%, transparent)",
                            color: "var(--color-accent)",
                            border: "1.5px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
                          }
                        : { background: "var(--color-card)", color: "var(--color-ink2)", border: "1.5px solid var(--color-line)" }
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {style.label}
                  </button>
                )
              })}
            </div>
          )}

          {step?.id === "anchor-titles" && (
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  <Heart className="h-4 w-4" style={{ color: "var(--color-accent)" }} />
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
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  <Sparkles className="h-4 w-4" style={{ color: "var(--color-ink2)" }} />
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
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          <QuizButton variant="ghost" onClick={goPrev} disabled={currentStep === 0}>
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </QuizButton>
          <QuizButton variant="cta" onClick={goNext} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {isLightLast ? "Enregistrer le profil" : isLastStep && phase === "deep" ? "Terminer" : "Continuer"}
                {isLastStep ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </>
            )}
          </QuizButton>
        </div>
      </div>

      {/* Skip + note */}
      <div className="mt-4 flex justify-center">
        {!isLastStep ? (
          <button
            type="button"
            onClick={goNext}
            className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--color-ink2)" }}
          >
            Passer cette étape
          </button>
        ) : step?.id === "anchor-titles" ? (
          <button
            type="button"
            onClick={goNext}
            disabled={saving}
            className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70 disabled:opacity-50"
            style={{ color: "var(--color-ink2)" }}
          >
            Terminer sans titres repères
          </button>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs" style={{ color: "var(--color-ink2)", opacity: 0.8 }}>
        Pas d&apos;accord avec un repère d&apos;âge sur une fiche ?{" "}
        <Link href="/profil" className="underline hover:opacity-80">
          Ce quiz affine les goûts
        </Link>
        , pas l&apos;âge expert — votez aussi sur la page du titre.
      </p>
    </div>
  )
}

function QuizButton({
  variant = "cta",
  onClick,
  disabled,
  children,
}: {
  variant?: "cta" | "outline" | "ghost"
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const style: React.CSSProperties =
    variant === "cta"
      ? { background: "var(--color-accent)", color: "#FFF8F0", padding: "11px 24px" }
      : variant === "outline"
        ? { background: "transparent", color: "var(--color-ink)", border: "1px solid var(--color-line2)", padding: "10px 20px" }
        : { background: "transparent", color: "var(--color-ink2)", padding: "10px 12px" }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-full text-[14px] font-bold transition-transform",
        "hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]",
        "disabled:pointer-events-none disabled:opacity-45",
        variant === "cta" && "hover:brightness-[0.96]",
      )}
      style={style}
    >
      {children}
    </button>
  )
}

// Unified pill chips — pastel (favourites/interests, catalogue colours),
// hard/avoid (soft terracotta-red + ✗), soft (muted gold). Zero emoji.
function ChoiceChips({
  items,
  selected,
  onToggle,
  variant,
}: {
  items: readonly string[]
  selected: string[]
  onToggle: (v: string) => void
  variant: "pastel" | "hard" | "soft" | "avoid"
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((item, i) => {
        const on = selected.includes(item)
        const isNegative = variant === "hard" || variant === "avoid"
        let style: React.CSSProperties
        if (!on) {
          style = { background: "var(--color-card)", color: "var(--color-ink2)", border: "1.5px solid var(--color-line)" }
        } else if (isNegative) {
          style = { background: "#E7A79A", color: CHIP_INK, border: "1.5px solid #E7A79A" }
        } else if (variant === "soft") {
          style = { background: "#EBD9A6", color: CHIP_INK, border: "1.5px solid #EBD9A6" }
        } else {
          const c = CHIP_PASTELS[i % CHIP_PASTELS.length]
          style = { background: c, color: CHIP_INK, border: `1.5px solid ${c}` }
        }
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
            style={style}
          >
            <span
              className="grid h-[15px] w-[15px] flex-none place-items-center rounded-full"
              style={{ border: on ? "1.5px solid rgba(0,0,0,.38)" : "1.5px solid var(--color-line2)" }}
            >
              {on &&
                (isNegative ? (
                  <X className="h-2.5 w-2.5" strokeWidth={3.5} style={{ color: "rgba(0,0,0,.72)" }} />
                ) : (
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} style={{ color: "rgba(0,0,0,.72)" }} />
                ))}
            </span>
            {item}
          </button>
        )
      })}
    </div>
  )
}

// Segmented positive-content scale (0 = indifférent … 3 = essentiel).
function PositiveScale({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
          {label}
        </span>
        <span style={{ color: "var(--color-ink2)" }}>{QUIZ_POSITIVE_OPTIONS[value]?.label ?? value}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {QUIZ_POSITIVE_OPTIONS.map((opt) => {
          const on = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="rounded-xl py-2.5 text-[12.5px] font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
              style={
                on
                  ? {
                      background: "color-mix(in srgb, var(--color-accent) 16%, transparent)",
                      color: "var(--color-accent)",
                      border: "1.5px solid color-mix(in srgb, var(--color-accent) 45%, transparent)",
                    }
                  : { background: "var(--color-bg2)", color: "var(--color-ink2)", border: "1.5px solid var(--color-line)" }
              }
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Sensitivity as a 4-bar intensity gauge on the age-grid severity ramp
// (green → yellow → peach → terracotta). Replaces the 😎🙂😐🚫 radios.
function SensitivityScale({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {QUIZ_SENSITIVITY_OPTIONS.map((option) => {
        const on = value === option.value
        const fill = SEVERITY[option.value] ?? SEVERITY[SEVERITY.length - 1]
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            title={option.description}
            className="flex flex-col items-center gap-2 rounded-2xl px-3 py-3 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
            style={
              on
                ? { background: fill, color: CHIP_INK, border: `1.5px solid ${fill}` }
                : { background: "var(--color-bg2)", color: "var(--color-ink2)", border: "1.5px solid var(--color-line)" }
            }
          >
            <span className="flex h-4 items-end gap-[3px]" aria-hidden>
              {[0, 1, 2, 3].map((i) => {
                const activeBar = i <= option.value
                return (
                  <span
                    key={i}
                    className="w-[5px] rounded-[2px]"
                    style={{
                      height: `${5 + i * 3.6}px`,
                      background: activeBar
                        ? on
                          ? "rgba(0,0,0,.72)"
                          : "var(--color-ink2)"
                        : on
                          ? "rgba(0,0,0,.22)"
                          : "var(--color-line)",
                    }}
                  />
                )
              })}
            </span>
            <span className="text-center text-[12.5px] font-bold leading-tight">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
