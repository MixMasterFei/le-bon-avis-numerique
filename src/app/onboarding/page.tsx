"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowRight, ArrowLeft, Check, Plus, Sparkles, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AvatarPicker, defaultAvatarValue, type AvatarValue } from "@/components/ui/AvatarPicker"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { PreferenceQuiz } from "@/components/profile/PreferenceQuiz"

interface CreatedMember {
  id: string
  name: string
  emoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  birthYear: number | null
  quizCompleted: boolean
}

// ---------------------------------------------------------------------------
// Step 0: Welcome
// ---------------------------------------------------------------------------
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="inline-flex p-4 bg-gradient-to-br from-violet-100 to-pink-100 rounded-3xl">
        <Users className="h-12 w-12 text-violet-600" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900">
        Bienvenue sur Totem Avisé !
      </h1>
      <p className="text-gray-600 text-lg max-w-md mx-auto leading-relaxed">
        Dites-nous qui fait partie de votre foyer pour recevoir des
        recommandations personnalisées.
      </p>
      <p className="text-gray-500 text-sm max-w-md mx-auto">
        Que vous ayez des enfants, des ados ou que vous soyez simplement
        cinéphile, on s&apos;adapte.
      </p>
      <Button size="lg" onClick={onNext} className="mt-4">
        Commencer <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
      <p className="text-xs text-gray-400">
        Vous pourrez modifier tout cela à tout moment depuis votre profil.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Create First Member
// ---------------------------------------------------------------------------
function CreateMemberStep({
  onMemberCreated,
  onBack,
  existingMembers,
}: {
  onMemberCreated: (member: CreatedMember) => void
  onBack: () => void
  existingMembers: CreatedMember[]
}) {
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("👧")
  const [avatarValue, setAvatarValue] = useState<AvatarValue>(defaultAvatarValue())
  const [birthYear, setBirthYear] = useState("")
  const [birthMonth, setBirthMonth] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const currentYear = new Date().getFullYear()

  // Auto-detect role from birth year (with month precision if available)
  const parsedMonth = birthMonth ? parseInt(birthMonth) : null
  const yearDiff = birthYear ? currentYear - parseInt(birthYear) : null
  const age = yearDiff !== null
    ? (parsedMonth && parsedMonth >= 1 && parsedMonth <= 12 && (new Date().getMonth() + 1) < parsedMonth ? yearDiff - 1 : yearDiff)
    : null
  const roleHint = age === null ? null : age < 13 ? "Enfant" : age < 18 ? "Ado" : "Adulte"

  async function handleCreate() {
    if (!name.trim()) {
      setError("Le prénom est requis")
      return
    }
    setError("")
    setSaving(true)

    try {
      const res = await fetch("/api/user/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          avatarEmoji: emoji,
          avatarStyle: avatarValue.style,
          avatarSeed: avatarValue.seed,
          avatarOptions: avatarValue.options ?? null,
          birthYear: birthYear ? parseInt(birthYear) : null,
          birthMonth: birthMonth ? parseInt(birthMonth) : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erreur lors de la création")
        return
      }

      const data = await res.json()
      onMemberCreated({
        id: data.member?.id || data.id || data.familyMember?.id,
        name: name.trim(),
        emoji,
        avatarStyle: avatarValue.style,
        avatarSeed: avatarValue.seed,
        avatarOptions: avatarValue.options,
        birthYear: birthYear ? parseInt(birthYear) : null,
        quizCompleted: false,
      })
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          {existingMembers.length === 0
            ? "Qui regardera avec vous ?"
            : "Ajouter un autre membre"}
        </h2>
        <p className="text-gray-500 text-sm">
          Vous pourrez ajouter d&apos;autres membres plus tard.
        </p>
      </div>

      {/* Existing members display */}
      {existingMembers.length > 0 && (
        <div className="flex justify-center gap-3 py-2">
          {existingMembers.map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1">
              <MemberAvatar
                avatarStyle={m.avatarStyle}
                avatarSeed={m.avatarSeed}
                avatarOptions={m.avatarOptions}
                avatarEmoji={m.emoji}
                name={m.name}
                size={32}
              />
              <span className="text-xs text-gray-500">{m.name}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1 opacity-50">
            <Plus className="h-6 w-6 text-gray-400" />
            <span className="text-xs text-gray-400">Nouveau</span>
          </div>
        </div>
      )}

      {/* Avatar picker */}
      <AvatarPicker value={avatarValue} onChange={setAvatarValue} />

      {/* Name */}
      <div>
        <label htmlFor="member-name" className="block text-sm font-medium text-gray-700 mb-1">
          Prénom
        </label>
        <Input
          id="member-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Emma, Léo, Papa..."
          maxLength={30}
        />
      </div>

      {/* Birth date */}
      <div>
        <label htmlFor="birth-month" className="block text-sm font-medium text-gray-700 mb-1">
          Date de naissance <span className="text-gray-400">(optionnel)</span>
        </label>
        <div className="flex items-center gap-3">
          <select
            id="birth-month"
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Mois</option>
            {["Janv.","Fév.","Mars","Avr.","Mai","Juin","Juil.","Août","Sept.","Oct.","Nov.","Déc."].map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <Input
            id="birth-year"
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder={String(currentYear - 8)}
            min={1940}
            max={currentYear}
            className="w-24"
          />
          {roleHint && (
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {roleHint} {age !== null && `(${age} ans)`}
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <Button onClick={handleCreate} disabled={saving} className="flex-1">
          {saving ? "Création..." : "Créer ce membre"}
          {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Vous pourrez modifier ces informations à tout moment.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Preference Quiz
// ---------------------------------------------------------------------------
function QuizStep({
  member,
  onComplete,
  onSkip,
}: {
  member: CreatedMember
  onComplete: () => void
  onSkip: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">
          Préférences de {member.name}
        </h2>
        <p className="text-gray-500 text-sm">
          Quelques questions pour personnaliser les recommandations.
        </p>
      </div>

      <PreferenceQuiz
        memberId={member.id}
        memberName={member.name}
        memberEmoji={member.emoji}
        onComplete={onComplete}
      />

      <div className="text-center pt-2">
        <button
          onClick={onSkip}
          className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
        >
          Passer pour l&apos;instant
        </button>
        <p className="text-xs text-gray-400 mt-1">
          Vous pourrez compléter le quiz à tout moment depuis votre profil.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Done
// ---------------------------------------------------------------------------
function DoneStep({
  members,
  onAddAnother,
  onFinish,
}: {
  members: CreatedMember[]
  onAddAnother: () => void
  onFinish: () => void
}) {
  return (
    <div className="text-center space-y-6">
      <div className="inline-flex p-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl">
        <Check className="h-12 w-12 text-emerald-600" />
      </div>
      <h2 className="text-3xl font-bold text-gray-900">
        Votre profil est prêt !
      </h2>

      {/* Member summary */}
      <div className="flex justify-center gap-4 py-4">
        {members.map((m) => (
          <div key={m.id} className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-xl">
            <MemberAvatar
              avatarStyle={m.avatarStyle}
              avatarSeed={m.avatarSeed}
              avatarOptions={m.avatarOptions}
              avatarEmoji={m.emoji}
              name={m.name}
              size={40}
            />
            <span className="text-sm font-medium text-gray-700">{m.name}</span>
            {m.quizCompleted && (
              <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                <Sparkles className="h-3 w-3" /> Quiz complété
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <Button onClick={onFinish} size="lg">
          Découvrir mes recommandations <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
        <Button variant="outline" onClick={onAddAnother}>
          <Plus className="mr-2 h-4 w-4" /> Ajouter un autre membre
        </Button>
      </div>

      <p className="text-xs text-gray-400">
        Vous pourrez modifier tout cela à tout moment depuis votre profil.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Onboarding Wizard
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const router = useRouter()
  const { update } = useSession()
  const [step, setStep] = useState(0)
  const [members, setMembers] = useState<CreatedMember[]>([])
  const [activeMember, setActiveMember] = useState<CreatedMember | null>(null)

  const handleMemberCreated = useCallback((member: CreatedMember) => {
    setMembers((prev) => [...prev, member])
    setActiveMember(member)
    setStep(2) // Go to quiz
  }, [])

  const handleQuizComplete = useCallback(() => {
    if (activeMember) {
      setMembers((prev) =>
        prev.map((m) => (m.id === activeMember.id ? { ...m, quizCompleted: true } : m))
      )
    }
    setStep(3) // Go to done
  }, [activeMember])

  const handleQuizSkip = useCallback(() => {
    setStep(3) // Go to done without completing quiz
  }, [])

  const handleAddAnother = useCallback(() => {
    setActiveMember(null)
    setStep(1) // Back to create member
  }, [])

  const handleFinish = useCallback(async () => {
    try {
      await fetch("/api/user/onboarding", { method: "PATCH" })
      // Update the session token so middleware knows onboarding is done
      await update()
    } catch {
      // Don't block — the user can still proceed
    }
    router.push("/profil")
  }, [router, update])

  // Progress indicator
  const totalSteps = 3
  const progressStep = Math.min(step, totalSteps)

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        {step > 0 && step < 3 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">
                Étape {progressStep}/{totalSteps}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${(progressStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
          {step === 1 && (
            <CreateMemberStep
              onMemberCreated={handleMemberCreated}
              onBack={() => setStep(members.length > 0 ? 3 : 0)}
              existingMembers={members}
            />
          )}
          {step === 2 && activeMember && (
            <QuizStep
              member={activeMember}
              onComplete={handleQuizComplete}
              onSkip={handleQuizSkip}
            />
          )}
          {step === 3 && (
            <DoneStep
              members={members}
              onAddAnother={handleAddAnother}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  )
}
