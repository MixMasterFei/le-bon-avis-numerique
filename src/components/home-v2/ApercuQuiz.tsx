"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, Plus, X, Loader2 } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

const SAGE = "#5C8A5C"

const GENRES = [
  "Animation", "Aventure", "Comédie", "Fantastique", "Science-Fiction",
  "Famille", "Action", "Documentaire", "Musical", "Drame",
  "Romance", "Thriller", "Horreur",
]

const SENSITIVITY_OPTIONS = [
  { value: 0, emoji: "😊", label: "Pas du tout gêné·e", description: "Ça ne le/la dérange pas" },
  { value: 1, emoji: "😐", label: "Un peu mal à l'aise", description: "Tolère mais n'apprécie pas" },
  { value: 2, emoji: "😰", label: "Assez sensible", description: "Préfère éviter" },
  { value: 3, emoji: "😱", label: "Très sensible", description: "À éviter absolument" },
]

const PREFERENCE_OPTIONS = [
  { value: 0, label: "Indifférent" },
  { value: 1, label: "Apprécié" },
  { value: 2, label: "Important" },
  { value: 3, label: "Essentiel" },
]

const SUGGESTED_AVOID_TOPICS = [
  "Mort d'un parent",
  "Maladie grave",
  "Divorce",
  "Harcèlement",
  "Drogue",
  "Suicide",
  "Guerre",
  "Religion",
]

type StepId =
  | "genres-like"
  | "genres-dislike"
  | "sensitivity-scary"
  | "sensitivity-violence"
  | "sensitivity-language"
  | "positive-content"
  | "avoid-topics"

interface Step {
  id: StepId
  section: string
  title: string
  subtitle?: string
}

function buildSteps(name: string | undefined): Step[] {
  const who = name ? name : "votre enfant"
  return [
    { id: "genres-like", section: "Ses goûts", title: `Quels genres préfère ${who} ?`, subtitle: "Sélectionnez tout ce qu'il/elle aime regarder." },
    { id: "genres-dislike", section: "Ses goûts", title: "Y a-t-il des genres à éviter ?", subtitle: "Optionnel — choisissez ceux qu'il/elle n'aime pas." },
    { id: "sensitivity-scary", section: "Sa sensibilité", title: "Face à une scène effrayante…" },
    { id: "sensitivity-violence", section: "Sa sensibilité", title: "Face à de la violence ou des bagarres…" },
    { id: "sensitivity-language", section: "Sa sensibilité", title: "Face à des gros mots ou du langage cru…" },
    { id: "positive-content", section: "Ce qui compte", title: "Quels contenus positifs cherchez-vous ?", subtitle: "Indiquez l'importance de chaque dimension." },
    { id: "avoid-topics", section: "Sujets à éviter", title: "Y a-t-il des thèmes à exclure ?", subtitle: "Optionnel — sélectionnez ce qui ne convient pas à votre foyer." },
  ]
}

interface QuizState {
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

const INITIAL: QuizState = {
  favoriteGenres: [],
  dislikedGenres: [],
  sensitivityScary: 2,
  sensitivityViolence: 2,
  sensitivityLanguage: 2,
  preferPositiveMessages: 1,
  preferRoleModels: 1,
  preferEducational: 1,
  avoidTopics: [],
}

interface ApercuQuizProps {
  serifClass: string
  memberId?: string
  memberName?: string
}

export function ApercuQuiz({ serifClass, memberId, memberName }: ApercuQuizProps) {
  const p = APERCU_PALETTE
  const router = useRouter()
  const [stepIdx, setStepIdx] = useState(0)
  const [state, setState] = useState<QuizState>(INITIAL)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(!!memberId)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const STEPS = buildSteps(memberName)
  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1

  useEffect(() => {
    if (!memberId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/user/family/${memberId}/preferences`)
        if (!res.ok) return
        const data = await res.json()
        const m = data.member
        if (m && !cancelled) {
          setState({
            favoriteGenres: m.favoriteGenres || [],
            dislikedGenres: m.dislikedGenres || [],
            sensitivityScary: m.sensitivityScary ?? 2,
            sensitivityViolence: m.sensitivityViolence ?? 2,
            sensitivityLanguage: m.sensitivityLanguage ?? 2,
            preferPositiveMessages: m.preferPositiveMessages ?? 1,
            preferRoleModels: m.preferRoleModels ?? 1,
            preferEducational: m.preferEducational ?? 1,
            avoidTopics: m.avoidTopics || [],
          })
        }
      } catch {
        // Use defaults if fetch fails
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [memberId])

  async function finish() {
    if (!memberId) {
      setDone(true)
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/user/family/${memberId}/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state, useCustomSettings: true }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setSaveError(data?.error || "Erreur lors de l'enregistrement")
        setSaving(false)
        return
      }
      setDone(true)
      router.refresh()
    } catch {
      setSaveError("Une erreur est survenue")
      setSaving(false)
    }
  }

  function next() {
    if (isLast) {
      finish()
      return
    }
    setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))
  }
  function prev() {
    setStepIdx((i) => Math.max(0, i - 1))
  }

  function toggleArr(field: "favoriteGenres" | "dislikedGenres" | "avoidTopics", value: string) {
    setState((s) => {
      const list = s[field]
      const nextList = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      if (field === "favoriteGenres") {
        return { ...s, favoriteGenres: nextList, dislikedGenres: s.dislikedGenres.filter((g) => g !== value) }
      }
      if (field === "dislikedGenres") {
        return { ...s, dislikedGenres: nextList, favoriteGenres: s.favoriteGenres.filter((g) => g !== value) }
      }
      return { ...s, avoidTopics: nextList }
    })
  }

  if (loading) {
    return (
      <div
        className="flex flex-col min-h-[60vh] items-center justify-center"
        style={{ background: p.bg, color: p.ink }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: p.accent }} />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col flex-1"
      style={{ background: p.bg, color: p.ink }}
    >
      {done ? (
        <DoneScreen
          serifClass={serifClass}
          memberId={memberId}
          memberName={memberName}
        />
      ) : (
        <section className="container mx-auto px-4 md:px-8 py-10 md:py-16 max-w-2xl">
          <header className="mb-8">
            <div
              className="text-[11px] font-semibold uppercase tracking-wide mb-2"
              style={{ color: p.accent }}
            >
              Quiz · {step.section}
            </div>
            <h1
              className={`${serifClass} text-2xl md:text-4xl font-medium leading-tight`}
              style={{ color: p.ink, letterSpacing: "-0.02em" }}
            >
              {step.title}
            </h1>
            {step.subtitle && (
              <p className="text-sm md:text-base mt-2" style={{ color: p.ink2 }}>
                {step.subtitle}
              </p>
            )}
          </header>

          <ProgressBar current={stepIdx + 1} total={STEPS.length} />

          <div className="mt-8 mb-12">
            {step.id === "genres-like" && (
              <GenrePills
                selected={state.favoriteGenres}
                onToggle={(g) => toggleArr("favoriteGenres", g)}
              />
            )}
            {step.id === "genres-dislike" && (
              <GenrePills
                selected={state.dislikedGenres}
                onToggle={(g) => toggleArr("dislikedGenres", g)}
                disabled={state.favoriteGenres}
                tone="warning"
              />
            )}
            {step.id === "sensitivity-scary" && (
              <SensitivityCards
                value={state.sensitivityScary}
                onChange={(v) => setState((s) => ({ ...s, sensitivityScary: v }))}
              />
            )}
            {step.id === "sensitivity-violence" && (
              <SensitivityCards
                value={state.sensitivityViolence}
                onChange={(v) => setState((s) => ({ ...s, sensitivityViolence: v }))}
              />
            )}
            {step.id === "sensitivity-language" && (
              <SensitivityCards
                value={state.sensitivityLanguage}
                onChange={(v) => setState((s) => ({ ...s, sensitivityLanguage: v }))}
              />
            )}
            {step.id === "positive-content" && (
              <PreferenceScales
                state={state}
                onChange={(field, v) => setState((s) => ({ ...s, [field]: v }))}
              />
            )}
            {step.id === "avoid-topics" && (
              <AvoidTopics
                selected={state.avoidTopics}
                onToggle={(t) => toggleArr("avoidTopics", t)}
              />
            )}
          </div>

          {saveError && (
            <div
              className="rounded-xl px-3.5 py-2.5 mb-4 text-sm"
              style={{
                background: "rgba(209, 106, 74, 0.12)",
                border: `1px solid ${p.accent}`,
                color: p.ink,
              }}
              role="alert"
            >
              {saveError}
            </div>
          )}

          <footer className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={prev}
              disabled={stepIdx === 0 || saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: p.ink, border: `1px solid ${p.line2}`, background: "transparent" }}
            >
              <ArrowLeft className="w-4 h-4" />
              Précédent
            </button>
            <span className="text-xs" style={{ color: p.ink2 }}>
              Étape {stepIdx + 1} sur {STEPS.length}
            </span>
            <button
              type="button"
              onClick={next}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: isLast ? p.accent : p.ink,
                color: isLast ? "#fff" : p.bg,
              }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isLast ? (
                <>
                  Terminer
                  <Check className="w-4 h-4" />
                </>
              ) : (
                <>
                  Suivant
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </footer>
        </section>
      )}
    </div>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const p = APERCU_PALETTE
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const status = i < current - 1 ? "done" : i === current - 1 ? "current" : "todo"
        const bg =
          status === "done" ? SAGE :
          status === "current" ? p.accent :
          p.bg2
        return (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: bg, border: status === "todo" ? `1px solid ${p.line}` : "none" }}
          />
        )
      })}
    </div>
  )
}

function GenrePills({
  selected,
  onToggle,
  disabled,
  tone = "default",
}: {
  selected: string[]
  onToggle: (g: string) => void
  disabled?: string[]
  tone?: "default" | "warning"
}) {
  const p = APERCU_PALETTE
  const activeBg = tone === "warning" ? p.accent : p.ink
  const activeFg = tone === "warning" ? "#fff" : p.bg
  return (
    <div className="flex flex-wrap gap-2">
      {GENRES.map((g) => {
        const isDisabled = disabled?.includes(g)
        const isActive = selected.includes(g)
        return (
          <button
            key={g}
            type="button"
            onClick={() => !isDisabled && onToggle(g)}
            disabled={isDisabled}
            className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-30"
            style={{
              background: isActive ? activeBg : p.card,
              color: isActive ? activeFg : p.ink,
              border: `1px solid ${isActive ? activeBg : p.line}`,
            }}
          >
            {isActive && "✓ "}
            {g}
          </button>
        )
      })}
    </div>
  )
}

function SensitivityCards({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const p = APERCU_PALETTE
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SENSITIVITY_OPTIONS.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="rounded-2xl p-4 text-left flex flex-col gap-1.5 transition-transform hover:-translate-y-0.5"
            style={{
              background: active ? p.bg2 : p.card,
              border: `2px solid ${active ? p.accent : p.line}`,
            }}
          >
            <span className="text-3xl" aria-hidden>{opt.emoji}</span>
            <span className="text-sm font-semibold" style={{ color: p.ink }}>
              {opt.label}
            </span>
            <span className="text-xs" style={{ color: p.ink2 }}>
              {opt.description}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PreferenceScales({
  state,
  onChange,
}: {
  state: QuizState
  onChange: (
    field: "preferPositiveMessages" | "preferRoleModels" | "preferEducational",
    v: number,
  ) => void
}) {
  const rows: Array<{
    field: "preferPositiveMessages" | "preferRoleModels" | "preferEducational"
    label: string
    description: string
  }> = [
    { field: "preferPositiveMessages", label: "Messages positifs", description: "Bienveillance, optimisme, valeurs" },
    { field: "preferRoleModels", label: "Modèles inspirants", description: "Personnages forts, courageux, exemplaires" },
    { field: "preferEducational", label: "Contenu éducatif", description: "Histoire, sciences, langues, culture" },
  ]
  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => (
        <PreferenceRow
          key={row.field}
          label={row.label}
          description={row.description}
          value={state[row.field]}
          onChange={(v) => onChange(row.field, v)}
        />
      ))}
    </div>
  )
}

function PreferenceRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number
  onChange: (v: number) => void
}) {
  const p = APERCU_PALETTE
  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-semibold" style={{ color: p.ink }}>
          {label}
        </div>
        <div className="text-xs" style={{ color: p.ink2 }}>
          {description}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {PREFERENCE_OPTIONS.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="px-2 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: active ? p.ink : p.card,
                color: active ? p.bg : p.ink2,
                border: `1px solid ${active ? p.ink : p.line}`,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AvoidTopics({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (t: string) => void
}) {
  const p = APERCU_PALETTE
  const [draft, setDraft] = useState("")
  const customs = selected.filter((t) => !SUGGESTED_AVOID_TOPICS.includes(t))

  function addCustom() {
    const v = draft.trim()
    if (!v || selected.includes(v)) {
      setDraft("")
      return
    }
    onToggle(v)
    setDraft("")
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {SUGGESTED_AVOID_TOPICS.map((t) => {
          const active = selected.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => onToggle(t)}
              className="px-3.5 py-1.5 rounded-full text-sm font-semibold"
              style={{
                background: active ? p.accent : p.card,
                color: active ? "#fff" : p.ink,
                border: `1px solid ${active ? p.accent : p.line}`,
              }}
            >
              {active && "✕ "}
              {t}
            </button>
          )
        })}
      </div>
      {customs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {customs.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
              style={{ background: p.accent, color: "#fff" }}
            >
              {t}
              <button
                type="button"
                onClick={() => onToggle(t)}
                aria-label={`Retirer ${t}`}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          placeholder="Ajouter un sujet personnalisé"
          className="flex-1 text-sm rounded-xl px-3.5 py-2.5 outline-none"
          style={{ background: p.bg2, border: `1px solid ${p.line2}`, color: p.ink }}
        />
        <button
          type="button"
          onClick={addCustom}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold"
          style={{ background: p.ink, color: p.bg }}
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter
        </button>
      </div>
    </div>
  )
}

function DoneScreen({
  serifClass,
  memberId,
  memberName,
}: {
  serifClass: string
  memberId?: string
  memberName?: string
}) {
  const p = APERCU_PALETTE
  const backHref = memberId ? `/profil/membres/${memberId}` : "/profil"
  return (
    <section className="container mx-auto px-4 md:px-8 py-16 md:py-24 max-w-2xl">
      <div
        className="rounded-3xl p-8 md:p-12 text-center"
        style={{ background: p.card, border: `1px solid ${p.line}` }}
      >
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{ background: SAGE, color: "#fff" }}
        >
          <Check className="w-8 h-8" />
        </div>
        <h1
          className={`${serifClass} text-3xl md:text-4xl font-medium mb-3`}
          style={{ color: p.ink, letterSpacing: "-0.02em" }}
        >
          Profil prêt{memberName ? ` pour ${memberName}` : ""} !
        </h1>
        <p className="text-base mb-8 max-w-md mx-auto" style={{ color: p.ink2 }}>
          Le quiz est complété. Vos préférences orienteront chaque
          recommandation : les films seront filtrés selon la sensibilité, l&apos;âge
          et les goûts de{memberName ? ` ${memberName}` : " votre enfant"}.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href={backHref}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
            style={{ background: p.ink, color: p.bg }}
          >
            Retour au profil
          </Link>
          <Link
            href="/films"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
            style={{ background: "transparent", color: p.ink, border: `1px solid ${p.line2}` }}
          >
            Voir des films
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
