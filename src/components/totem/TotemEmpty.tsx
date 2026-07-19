"use client"

import { TotemSuggestionChips } from "./TotemSuggestionChips"

export interface TotemEmptyProps {
  sourcePage: string | null
  isAuthenticated: boolean
  onPickPrompt: (text: string) => void
}

export function TotemEmpty({ sourcePage, isAuthenticated, onPickPrompt }: TotemEmptyProps) {
  return (
    <div className="space-y-3 px-1 py-1 sm:space-y-4 sm:py-2" style={{ color: "var(--color-ink)" }}>
      <div className="space-y-1">
        <p
          className="text-base leading-snug sm:text-lg"
          style={{ fontFamily: "var(--font-fraunces)", letterSpacing: "-0.01em" }}
        >
          Bonjour — je suis <em className="italic" style={{ color: "var(--color-accent)" }}>Totem</em>.
        </p>
        <p className="text-sm leading-snug sm:leading-relaxed" style={{ color: "var(--color-ink2)" }}>
          Je vous aide à choisir des <em>films</em>, <em>séries</em> et <em>jeux</em> pour
          {" "}<em>votre famille</em>. Dites-moi l&apos;âge, les goûts, ce qu&apos;il faut éviter.
        </p>
        {/* Transparency disclosure (EU AI Act art. 50): visible once, at
            the start of every conversation, without breaking the persona. */}
        <p className="text-[11px] leading-snug" style={{ color: "var(--color-ink2)" }}>
          Totem est un assistant automatisé, supervisé par l&apos;équipe du site.
        </p>
      </div>

      <TotemSuggestionChips sourcePage={sourcePage} onPick={onPickPrompt} />

      {/* Hidden on mobile — keeps the first screen focused on the chips + input. */}
      <div className="hidden text-[11px] leading-relaxed sm:block" style={{ color: "var(--color-ink2)" }}>
        {isAuthenticated ? (
          <>
            Vos échanges sont conservés sur votre compte. Cliquez sur{" "}
            <span className="font-medium">l&apos;icône d&apos;historique</span>{" "}
            en haut pour les retrouver.
          </>
        ) : (
          <>Vos échanges sont conservés pour améliorer le service.</>
        )}
      </div>
    </div>
  )
}
