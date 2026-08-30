"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Minus, Plus, X } from "lucide-react"
import { intentToSearchParams } from "@/lib/nl-search/validate"
import { AVOID_RULES } from "@/lib/nl-search/vocab"
import type { NlIntent } from "@/lib/nl-search/types"

const TYPE_LABELS: Record<NlIntent["mediaType"], string> = {
  MOVIE: "Films",
  TV: "Séries",
  GAME: "Jeux",
}

const TYPE_CYCLE: NlIntent["mediaType"][] = ["MOVIE", "TV", "GAME"]

/**
 * The interpretation, made editable.
 *
 * Every chip is both an explanation ("voici ce que nous avons compris") and a
 * control: correcting a misread age or dropping a theme rewrites the URL with
 * structured params, which re-renders the page from the database alone — no
 * new interpretation, no cost, and no need to retype the question.
 */
export function ChipsInterpretation({ intent, query }: { intent: NlIntent; query: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const apply = (next: NlIntent) => {
    const params = intentToSearchParams(next, query)
    startTransition(() => {
      router.replace(`/decouverte?${params.toString()}`, { scroll: false })
    })
  }

  const chipStyle = {
    background: "var(--paper-2)",
    border: "1px solid var(--line)",
    color: "var(--ink)",
  }

  const chips: React.ReactNode[] = []

  // Media type — cycles rather than removes (a search is always OF something).
  chips.push(
    <button
      key="type"
      type="button"
      disabled={isPending}
      onClick={() => {
        const idx = TYPE_CYCLE.indexOf(intent.mediaType)
        const nextType = TYPE_CYCLE[(idx + 1) % TYPE_CYCLE.length]
        // Themes and platforms belong to a type's vocabulary; changing the type
        // invalidates them, so drop them rather than silently filtering nothing.
        apply({ ...intent, mediaType: nextType, themes: [], platforms: [], railSecondaire: null })
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-opacity hover:opacity-75 disabled:opacity-50"
      style={chipStyle}
      aria-label={`Type : ${TYPE_LABELS[intent.mediaType]} — changer`}
    >
      {TYPE_LABELS[intent.mediaType]}
    </button>,
  )

  // Age — a stepper, because a misread age is the single most consequential
  // error the interpretation can make and retyping the question to fix it
  // would be absurd.
  if (intent.maxAge !== null) {
    chips.push(
      <span
        key="age"
        className="inline-flex items-center gap-1 rounded-full py-1 pl-3.5 pr-1 text-[13px] font-bold"
        style={chipStyle}
      >
        jusqu&apos;à {intent.maxAge} ans
        <button
          type="button"
          disabled={isPending || intent.maxAge <= 0}
          onClick={() => apply({ ...intent, maxAge: Math.max(0, (intent.maxAge ?? 0) - 1) })}
          className="grid h-6 w-6 place-items-center rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
          aria-label="Diminuer l'âge"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={isPending || intent.maxAge >= 18}
          onClick={() => apply({ ...intent, maxAge: Math.min(18, (intent.maxAge ?? 0) + 1) })}
          className="grid h-6 w-6 place-items-center rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
          aria-label="Augmenter l'âge"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => apply({ ...intent, maxAge: null, railSecondaire: null })}
          className="grid h-6 w-6 place-items-center rounded-full transition-opacity hover:opacity-70"
          aria-label="Retirer le filtre d'âge"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>,
    )
  }

  const removable = (key: string, label: string, onRemove: () => void) => (
    <span
      key={key}
      className="inline-flex items-center gap-1 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13px] font-bold"
      style={chipStyle}
    >
      {label}
      <button
        type="button"
        disabled={isPending}
        onClick={onRemove}
        className="grid h-5 w-5 place-items-center rounded-full transition-opacity hover:opacity-70 disabled:opacity-40"
        aria-label={`Retirer ${label}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  )

  for (const theme of intent.themes) {
    chips.push(
      removable(`theme-${theme}`, theme, () =>
        apply({ ...intent, themes: intent.themes.filter((t) => t !== theme) }),
      ),
    )
  }

  for (const platform of intent.platforms) {
    chips.push(
      removable(`platform-${platform}`, platform, () =>
        apply({ ...intent, platforms: intent.platforms.filter((p) => p !== platform) }),
      ),
    )
  }

  for (const key of intent.eviter) {
    chips.push(
      removable(`avoid-${key}`, AVOID_RULES[key]?.label ?? key, () =>
        apply({ ...intent, eviter: intent.eviter.filter((k) => k !== key) }),
      ),
    )
  }

  if (chips.length === 0) return null

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2" style={{ opacity: isPending ? 0.6 : 1 }}>
        <span className="text-[13px] font-semibold" style={{ color: "var(--ink-3)" }}>
          Nous avons compris&nbsp;:
        </span>
        {chips}
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
        Pas tout à fait ça&nbsp;? Ajustez directement ces critères.
      </p>
    </div>
  )
}
