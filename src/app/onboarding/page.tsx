"use client"

import { useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { ArrowRight, ArrowLeft, Check, Plus, Sparkles, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  AvatarPicker,
  defaultAvatarValue,
  type AvatarValue,
} from "@/components/ui/AvatarPicker"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { PreferenceQuiz } from "@/components/profile/PreferenceQuiz"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

const SAGE = "#5C8A5C"

interface CreatedMember {
  id: string
  name: string
  emoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  birthYear: number | null
  birthMonth: number | null
  quizCompleted: boolean
}

// ---------------------------------------------------------------------------
// Step 0: Welcome
// ---------------------------------------------------------------------------
function WelcomeStep({ onNext }: { onNext: () => void }) {
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  return (
    <div className="text-center space-y-5">
      <div
        className="inline-flex p-4 rounded-3xl"
        style={{ background: p.bg2, color: p.accent }}
      >
        <Users className="h-10 w-10" />
      </div>
      <h1
        className={`${serifClass} text-3xl md:text-4xl font-medium leading-[1.05]`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        Bienvenue sur{" "}
        <em className="italic" style={{ color: p.accent }}>
          Totem Avisé
        </em>
      </h1>
      <p
        className="text-base md:text-lg max-w-md mx-auto leading-relaxed"
        style={{ color: p.ink2 }}
      >
        Dites-nous qui fait partie de votre foyer pour recevoir des
        recommandations personnalisées.
      </p>
      <p className="text-sm max-w-md mx-auto" style={{ color: p.ink2 }}>
        Que vous ayez des enfants, des ados ou que vous soyez simplement
        cinéphile, on s&apos;adapte.
      </p>
      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 mt-2"
        style={{ background: p.ink, color: p.bg }}
      >
        Commencer
        <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-xs" style={{ color: p.ink2 }}>
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
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  const [name, setName] = useState("")
  const [emoji] = useState("👧")
  const [avatarValue, setAvatarValue] = useState<AvatarValue>(
    defaultAvatarValue()
  )
  const [birthYear, setBirthYear] = useState("")
  const [birthMonth, setBirthMonth] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const currentYear = new Date().getFullYear()

  const parsedMonth = birthMonth ? parseInt(birthMonth) : null
  const yearDiff = birthYear ? currentYear - parseInt(birthYear) : null
  const age =
    yearDiff !== null
      ? parsedMonth &&
        parsedMonth >= 1 &&
        parsedMonth <= 12 &&
        new Date().getMonth() + 1 < parsedMonth
        ? yearDiff - 1
        : yearDiff
      : null
  const roleHint =
    age === null ? null : age < 13 ? "Enfant" : age < 18 ? "Ado" : "Adulte"

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
        birthMonth: birthMonth ? parseInt(birthMonth) : null,
        quizCompleted: false,
      })
    } catch {
      setError("Erreur réseau. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          {existingMembers.length === 0
            ? "Qui regardera avec vous ?"
            : "Ajouter un autre membre"}
        </h2>
        <p className="text-sm" style={{ color: p.ink2 }}>
          Vous pourrez ajouter d&apos;autres membres plus tard.
        </p>
      </div>

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
              <span className="text-xs" style={{ color: p.ink2 }}>
                {m.name}
              </span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1 opacity-50">
            <Plus className="h-6 w-6" style={{ color: p.ink2 }} />
            <span className="text-xs" style={{ color: p.ink2 }}>
              Nouveau
            </span>
          </div>
        </div>
      )}

      <AvatarPicker value={avatarValue} onChange={setAvatarValue} />

      <div>
        <label
          htmlFor="member-name"
          className="block text-xs font-semibold mb-1.5"
          style={{ color: p.ink2 }}
        >
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

      <div>
        <label
          htmlFor="birth-month"
          className="block text-xs font-semibold mb-1.5"
          style={{ color: p.ink2 }}
        >
          Date de naissance{" "}
          <span className="font-normal" style={{ color: p.ink2, opacity: 0.7 }}>
            (optionnel)
          </span>
        </label>
        <div className="flex items-center gap-3">
          <select
            id="birth-month"
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            className="flex h-9 rounded-md px-3 py-1 text-sm outline-none"
            style={{
              background: p.bg2,
              border: `1px solid ${p.line2}`,
              color: p.ink,
            }}
          >
            <option value="">Mois</option>
            {[
              "Janv.",
              "Fév.",
              "Mars",
              "Avr.",
              "Mai",
              "Juin",
              "Juil.",
              "Août",
              "Sept.",
              "Oct.",
              "Nov.",
              "Déc.",
            ].map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
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
            <span
              className="text-xs px-3 py-1 rounded-full"
              style={{ background: p.bg2, color: p.ink }}
            >
              {roleHint} {age !== null && `(${age} ans)`}
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: p.accent }}>
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "transparent",
            color: p.ink,
            border: `1px solid ${p.line2}`,
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: p.ink, color: p.bg }}
        >
          {saving ? "Création..." : "Créer ce membre"}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-xs text-center" style={{ color: p.ink2 }}>
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
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2
          className={`${serifClass} text-2xl md:text-3xl font-medium`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Préférences de{" "}
          <em className="italic" style={{ color: p.accent }}>
            {member.name}
          </em>
        </h2>
        <p className="text-sm" style={{ color: p.ink2 }}>
          Quelques questions pour personnaliser les recommandations.
        </p>
      </div>

      {/* birthYear/birthMonth tune the quiz to the member's age — without
          them an under-10 child would be asked the intimate-scenes question
          the sequence is designed to skip, and an adult would get the
          third-person "de X" phrasing instead of self mode. */}
      <PreferenceQuiz
        memberId={member.id}
        memberName={member.name}
        memberEmoji={member.emoji}
        birthYear={member.birthYear}
        birthMonth={member.birthMonth}
        onComplete={onComplete}
      />

      <div className="text-center pt-2">
        <button
          onClick={onSkip}
          className="text-sm underline transition-opacity hover:opacity-70"
          style={{ color: p.ink2 }}
        >
          Passer pour l&apos;instant
        </button>
        <p className="text-xs mt-1" style={{ color: p.ink2 }}>
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
  const p = APERCU_PALETTE
  const serifClass = "font-serif"
  return (
    <div className="text-center space-y-5">
      <div
        className="inline-flex items-center justify-center w-16 h-16 rounded-full"
        style={{ background: SAGE, color: "#fff" }}
      >
        <Check className="h-8 w-8" />
      </div>
      <h2
        className={`${serifClass} text-2xl md:text-3xl font-medium`}
        style={{ color: p.ink, letterSpacing: "-0.02em" }}
      >
        Votre{" "}
        <em className="italic" style={{ color: p.accent }}>
          profil
        </em>{" "}
        est prêt !
      </h2>

      <div className="flex justify-center gap-3 py-4 flex-wrap">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex flex-col items-center gap-2 p-3 rounded-xl"
            style={{ background: p.bg2 }}
          >
            <MemberAvatar
              avatarStyle={m.avatarStyle}
              avatarSeed={m.avatarSeed}
              avatarOptions={m.avatarOptions}
              avatarEmoji={m.emoji}
              name={m.name}
              size={40}
            />
            <span className="text-sm font-medium" style={{ color: p.ink }}>
              {m.name}
            </span>
            {m.quizCompleted && (
              <span
                className="text-[10px] flex items-center gap-0.5"
                style={{ color: SAGE }}
              >
                <Sparkles className="h-3 w-3" /> Quiz complété
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button
          onClick={onFinish}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: p.ink, color: p.bg }}
        >
          Découvrir mes recommandations
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={onAddAnother}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "transparent",
            color: p.ink,
            border: `1px solid ${p.line2}`,
          }}
        >
          <Plus className="h-4 w-4" />
          Ajouter un autre membre
        </button>
      </div>

      <p className="text-xs" style={{ color: p.ink2 }}>
        Vous pourrez modifier tout cela à tout moment depuis votre profil.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Onboarding Wizard
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const p = APERCU_PALETTE
  const { update } = useSession()
  const [step, setStep] = useState(0)
  const [members, setMembers] = useState<CreatedMember[]>([])
  const [activeMember, setActiveMember] = useState<CreatedMember | null>(null)

  const handleMemberCreated = useCallback((member: CreatedMember) => {
    setMembers((prev) => [...prev, member])
    setActiveMember(member)
    setStep(2)
  }, [])

  const handleQuizComplete = useCallback(() => {
    if (activeMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === activeMember.id ? { ...m, quizCompleted: true } : m
        )
      )
    }
    setStep(3)
  }, [activeMember])

  const handleQuizSkip = useCallback(() => {
    setStep(3)
  }, [])

  const handleAddAnother = useCallback(() => {
    setActiveMember(null)
    setStep(1)
  }, [])

  const handleFinish = useCallback(async () => {
    try {
      // The PATCH also rotates the session JWT server-side (see the route),
      // so the middleware sees onboardingCompleted=true immediately after.
      await fetch("/api/user/onboarding", { method: "PATCH" })
      await update()
    } catch {
      // Don't block — user can still proceed
    }
    // HARD navigation, not router.push: the Next client router may have
    // PREFETCHED /profil while onboarding was still incomplete and cached the
    // middleware's 307 → /onboarding for it — a push would replay that stale
    // redirect and bounce the user back here forever. A full page load
    // re-evaluates the middleware with the fresh cookie. One-time hop, so the
    // reload cost is irrelevant.
    window.location.assign("/profil")
  }, [update])

  const totalSteps = 3
  const progressStep = Math.min(step, totalSteps)

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: p.bg, color: p.ink }}
    >
      <div className="w-full max-w-lg">
        {step > 0 && step < 3 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: p.ink2 }}>
                Étape {progressStep}/{totalSteps}
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const status =
                  i < progressStep - 1
                    ? "done"
                    : i === progressStep - 1
                      ? "current"
                      : "todo"
                const bg =
                  status === "done"
                    ? SAGE
                    : status === "current"
                      ? p.accent
                      : p.bg2
                return (
                  <div
                    key={i}
                    className="flex-1 h-1.5 rounded-full"
                    style={{
                      background: bg,
                      border:
                        status === "todo"
                          ? `1px solid ${p.line}`
                          : "none",
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div
          className="rounded-3xl p-6 md:p-8"
          style={{
            background: p.card,
            border: `1px solid ${p.line}`,
          }}
        >
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
