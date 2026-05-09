"use client"

import { cn } from "@/lib/utils"

export interface TotemSuggestionChipsProps {
  sourcePage: string | null
  onPick: (text: string) => void
}

interface Chip {
  label: string
  text: string
}

const HOME_CHIPS: Chip[] = [
  { label: "Pour ce soir en famille", text: "Une suggestion pour une soirée famille ce soir ?" },
  { label: "Mon enfant de 5 ans aime…", text: "Mon enfant de 5 ans adore les animaux. Que recommandez-vous ?" },
  { label: "Convient à un ado anxieux ?", text: "Une série qui ne stresse pas pour un ado anxieux de 14 ans ?" },
  { label: "C'est quoi Totem Avisé ?", text: "C'est quoi Totem Avisé ?" },
]

const FILM_CHIPS: Chip[] = [
  { label: "Une alternative à ce film", text: "Une alternative plus douce à ce film ?" },
  { label: "Pour quel âge vraiment ?", text: "Pour quel âge ce film convient-il vraiment ?" },
  { label: "Un autre comme celui-ci", text: "Un autre film dans le même esprit, pour la famille ?" },
  { label: "C'est quoi Totem Avisé ?", text: "C'est quoi Totem Avisé ?" },
]

function pickChips(sourcePage: string | null): Chip[] {
  if (!sourcePage) return HOME_CHIPS
  if (sourcePage.startsWith("/media/") || sourcePage.startsWith("/films/")) return FILM_CHIPS
  return HOME_CHIPS
}

export function TotemSuggestionChips({ sourcePage, onPick }: TotemSuggestionChipsProps) {
  const chips = pickChips(sourcePage)
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c.text)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            "hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]",
          )}
          style={{
            background: "var(--color-card)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-line)",
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
