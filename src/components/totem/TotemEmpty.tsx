"use client"

import { TotemSuggestionChips } from "./TotemSuggestionChips"

export interface TotemEmptyProps {
  sourcePage: string | null
  isAuthenticated: boolean
  onPickPrompt: (text: string) => void
}

export function TotemEmpty({ sourcePage, isAuthenticated, onPickPrompt }: TotemEmptyProps) {
  return (
    <div className="space-y-4 px-1 py-2" style={{ color: "var(--color-ink)" }}>
      <div className="space-y-1.5">
        <p
          className="text-lg leading-snug"
          style={{ fontFamily: "var(--font-fraunces)", letterSpacing: "-0.01em" }}
        >
          Bonjour — je suis <em className="italic" style={{ color: "var(--color-accent)" }}>Totem</em>.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-ink2)" }}>
          Je vous aide à choisir des <em>films</em>, <em>séries</em> ou <em>jeux</em>
          {" "}adaptés à <em>votre famille</em>. Posez-moi votre question — l&apos;âge des enfants,
          {" "}leurs goûts, ce que vous voulez éviter.
        </p>
      </div>

      <TotemSuggestionChips sourcePage={sourcePage} onPick={onPickPrompt} />

      <div className="text-[11px] leading-relaxed" style={{ color: "var(--color-ink2)" }}>
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
