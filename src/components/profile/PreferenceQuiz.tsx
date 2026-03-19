"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Film,
  Shield,
  Heart,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TopicAvoider } from "@/components/ui/TopicAvoider"
import { cn } from "@/lib/utils"

// Genre list matching existing MemberPreferencesModal
const GENRES = [
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction",
  "Famille", "Action", "Documentaire", "Musical", "Drame",
  "Romance", "Thriller", "Horreur",
]

interface QuizStep {
  id: string
  section: string
  sectionIcon: React.ReactNode
  title: string
  subtitle?: string
}

const QUIZ_STEPS: QuizStep[] = [
  {
    id: "genres-like",
    section: "Ses goûts",
    sectionIcon: <Film className="h-5 w-5" />,
    title: "Quels genres {name} préfère ?",
    subtitle: "Sélectionnez les genres qu'il/elle aime regarder",
  },
  {
    id: "genres-dislike",
    section: "Ses goûts",
    sectionIcon: <Film className="h-5 w-5" />,
    title: "Y a-t-il des genres que {name} n'aime pas ?",
    subtitle: "Sélectionnez les genres à éviter (optionnel)",
  },
  {
    id: "sensitivity-scary",
    section: "Sa sensibilité",
    sectionIcon: <Shield className="h-5 w-5" />,
    title: "Quand il y a une scène effrayante dans un film, {name}...",
  },
  {
    id: "sensitivity-violence",
    section: "Sa sensibilité",
    sectionIcon: <Shield className="h-5 w-5" />,
    title: "Quand il y a des scènes de bagarres ou de violence, {name}...",
  },
  {
    id: "sensitivity-language",
    section: "Sa sensibilité",
    sectionIcon: <Shield className="h-5 w-5" />,
    title: "Quand il y a des gros mots ou du langage cru, {name}...",
  },
  {
    id: "positive-content",
    section: "Ce qui compte",
    sectionIcon: <Heart className="h-5 w-5" />,
    title: "Qu'est-ce qui est important dans les films de {name} ?",
    subtitle: "Indiquez vos préférences pour le contenu positif",
  },
  {
    id: "avoid-topics",
    section: "Sujets à éviter",
    sectionIcon: <AlertTriangle className="h-5 w-5" />,
    title: "Y a-t-il des sujets que {name} devrait éviter ?",
    subtitle: "Sélectionnez les thèmes sensibles à exclure (optionnel)",
  },
]

const SENSITIVITY_OPTIONS = [
  { value: 0, emoji: "😊", label: "Pas du tout gêné(e)", description: "Ça ne le/la dérange pas" },
  { value: 1, emoji: "😐", label: "Un peu mal à l'aise", description: "Tolère mais n'apprécie pas" },
  { value: 2, emoji: "😰", label: "Assez sensible", description: "Préfère éviter" },
  { value: 3, emoji: "😱", label: "Très sensible", description: "À éviter absolument" },
]

const PREFERENCE_OPTIONS = [
  { value: 0, label: "Indifférent", description: "Pas d'importance" },
  { value: 1, label: "Apprécié", description: "C'est un plus" },
  { value: 2, label: "Important", description: "On préfère" },
  { value: 3, label: "Essentiel", description: "Indispensable" },
]

interface QuizAnswers {
  favoriteGenres: string[]
  dislikedGenres: string[]
  sensitivityScary: number
  sensitivityViolence: number
  sensitivityLanguage: number
  preferPositiveMessages: number
  preferRoleModels: number
  preferEducational: number
  avoidTopics: string[]
}

interface PreferenceQuizProps {
  memberId: string
  memberName: string
  memberEmoji: string
  onComplete?: () => void
}

export function PreferenceQuiz({ memberId, memberName, memberEmoji, onComplete }: PreferenceQuizProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [answers, setAnswers] = useState<QuizAnswers>({
    favoriteGenres: [],
    dislikedGenres: [],
    sensitivityScary: 2,
    sensitivityViolence: 2,
    sensitivityLanguage: 2,
    preferPositiveMessages: 1,
    preferRoleModels: 1,
    preferEducational: 1,
    avoidTopics: [],
  })

  // Load existing preferences to pre-fill quiz
  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch(`/api/user/family/${memberId}/preferences`)
        if (res.ok) {
          const data = await res.json()
          const member = data.member
          if (member) {
            setAnswers({
              favoriteGenres: member.favoriteGenres || [],
              dislikedGenres: member.dislikedGenres || [],
              sensitivityScary: member.sensitivityScary ?? 2,
              sensitivityViolence: member.sensitivityViolence ?? 2,
              sensitivityLanguage: member.sensitivityLanguage ?? 2,
              preferPositiveMessages: member.preferPositiveMessages ?? 1,
              preferRoleModels: member.preferRoleModels ?? 1,
              preferEducational: member.preferEducational ?? 1,
              avoidTopics: member.avoidTopics || [],
            })
          }
        }
      } catch {
        // Use defaults if fetch fails
      } finally {
        setLoading(false)
      }
    }
    loadPreferences()
  }, [memberId])

  const totalSteps = QUIZ_STEPS.length
  const step = QUIZ_STEPS[currentStep]
  const progress = ((currentStep + 1) / totalSteps) * 100

  // Replace {name} in step titles
  const formatText = (text: string) => text.replace(/\{name\}/g, memberName)

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const toggleGenre = (genre: string, list: "favoriteGenres" | "dislikedGenres") => {
    const otherList = list === "favoriteGenres" ? "dislikedGenres" : "favoriteGenres"
    setAnswers(prev => ({
      ...prev,
      [list]: prev[list].includes(genre)
        ? prev[list].filter(g => g !== genre)
        : [...prev[list], genre],
      // Remove from opposite list if selected
      [otherList]: prev[otherList].filter(g => g !== genre),
    }))
  }

  const setSensitivity = (field: keyof QuizAnswers, value: number) => {
    setAnswers(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/user/family/${memberId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...answers,
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
        const data = await res.json()
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

  // Completion screen
  if (completed) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <div className="text-6xl">{memberEmoji}</div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            Profil de {memberName} complété !
          </h2>
          <p className="text-gray-600">
            Les recommandations seront désormais plus adaptées à ses goûts et sa sensibilité.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button onClick={() => router.push("/profil")} variant="outline">
            Retour au profil
          </Button>
          <Button onClick={() => router.push("/films")}>
            Découvrir des films
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header with progress */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{memberEmoji}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Quiz de préférences pour {memberName}
            </h1>
            <p className="text-sm text-gray-500">
              Étape {currentStep + 1} sur {totalSteps}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Section indicator */}
        <div className="flex items-center gap-2 text-sm text-primary font-medium">
          {step.sectionIcon}
          <span>{step.section}</span>
        </div>
      </div>

      {/* Question card */}
      <Card className="border-2">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {formatText(step.title)}
            </h2>
            {step.subtitle && (
              <p className="text-sm text-gray-500">{formatText(step.subtitle)}</p>
            )}
          </div>

          {/* Step content */}
          {step.id === "genres-like" && (
            <div className="flex flex-wrap gap-2">
              {GENRES.map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre, "favoriteGenres")}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                    answers.favoriteGenres.includes(genre)
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
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
              {GENRES.filter(g => !answers.favoriteGenres.includes(g)).map(genre => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre, "dislikedGenres")}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all border-2",
                    answers.dislikedGenres.includes(genre)
                      ? "bg-red-100 text-red-700 border-red-300"
                      : "bg-white text-gray-700 border-gray-200 hover:border-red-200"
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

          {step.id === "sensitivity-scary" && (
            <SensitivityQuestion
              value={answers.sensitivityScary}
              onChange={(v) => setSensitivity("sensitivityScary", v)}
            />
          )}

          {step.id === "sensitivity-violence" && (
            <SensitivityQuestion
              value={answers.sensitivityViolence}
              onChange={(v) => setSensitivity("sensitivityViolence", v)}
            />
          )}

          {step.id === "sensitivity-language" && (
            <SensitivityQuestion
              value={answers.sensitivityLanguage}
              onChange={(v) => setSensitivity("sensitivityLanguage", v)}
            />
          )}

          {step.id === "positive-content" && (
            <div className="space-y-5">
              <PreferenceQuestion
                label="Messages positifs et bons enseignements"
                value={answers.preferPositiveMessages}
                onChange={(v) => setSensitivity("preferPositiveMessages", v)}
              />
              <PreferenceQuestion
                label="Personnages qui sont de bons modèles"
                value={answers.preferRoleModels}
                onChange={(v) => setSensitivity("preferRoleModels", v)}
              />
              <PreferenceQuestion
                label="Contenu éducatif"
                value={answers.preferEducational}
                onChange={(v) => setSensitivity("preferEducational", v)}
              />
            </div>
          )}

          {step.id === "avoid-topics" && (
            <TopicAvoider
              label=""
              topics={answers.avoidTopics}
              onChange={(topics) => setAnswers(prev => ({ ...prev, avoidTopics: topics }))}
            />
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
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving} className="gap-1">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Terminer
          </Button>
        )}
      </div>
    </div>
  )
}

// Sensitivity question with emoji options
function SensitivityQuestion({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-3">
      {SENSITIVITY_OPTIONS.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
            value === option.value
              ? "border-primary bg-primary/5"
              : "border-gray-200 hover:border-gray-300"
          )}
        >
          <span className="text-2xl">{option.emoji}</span>
          <div>
            <p className="font-medium text-gray-900">{option.label}</p>
            <p className="text-sm text-gray-500">{option.description}</p>
          </div>
          {value === option.value && (
            <Check className="h-5 w-5 text-primary ml-auto" />
          )}
        </button>
      ))}
    </div>
  )
}

// Preference question with scale
function PreferenceQuestion({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="flex gap-2">
        {PREFERENCE_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all border-2 text-center",
              value === option.value
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-600 border-gray-200 hover:border-primary/50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
