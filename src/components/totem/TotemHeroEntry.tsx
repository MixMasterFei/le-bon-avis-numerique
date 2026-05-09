"use client"

import { MessageCircle } from "lucide-react"
import { TotemAlphaBadge } from "./TotemAlphaBadge"

export interface TotemHeroEntryProps {
  serifClass?: string
}

const SUGGESTIONS = [
  "Pour ce soir en famille ?",
  "Mon enfant de 8 ans peut-il regarder ce film ?",
  "Une alternative plus douce ?",
]

function open(prompt?: string) {
  if (typeof window === "undefined") return
  if (prompt) {
    window.dispatchEvent(new CustomEvent("totem:prefill", { detail: { prompt } }))
  }
  window.dispatchEvent(new Event("totem:open"))
}

export function TotemHeroEntry({ serifClass = "" }: TotemHeroEntryProps) {
  return (
    <div className="container mx-auto px-4 md:px-8 py-8 md:py-12">
      <div
        className="mx-auto max-w-3xl rounded-3xl px-6 py-8 md:px-10 md:py-10"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
        }}
      >
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--color-ink2)" }}>
          <span
            className="inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--color-accent)" }}
            aria-hidden
          />
          Demandez à Totem
          <TotemAlphaBadge variant="full" className="ml-1" />
        </div>

        <h2
          className={`${serifClass} mt-3 text-2xl md:text-3xl lg:text-4xl leading-[1.1] font-medium`}
          style={{ fontFamily: serifClass ? undefined : "var(--font-fraunces)", letterSpacing: "-0.02em", color: "var(--color-ink)" }}
        >
          Pas le temps de chercher ?{" "}
          <em
            className="italic"
            style={{ color: "var(--color-accent)" }}
          >
            Posez la question.
          </em>
        </h2>

        <p
          className="mt-3 text-sm md:text-base leading-relaxed max-w-xl"
          style={{ color: "var(--color-ink2)" }}
        >
          Totem connaît le catalogue par cœur. Il vous suggère un titre adapté
          à <em>votre famille</em> en quelques secondes.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={() => open()}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
          >
            <MessageCircle className="h-4 w-4" />
            Démarrer une conversation
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => open(s)}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: "var(--color-bg2)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-line)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
