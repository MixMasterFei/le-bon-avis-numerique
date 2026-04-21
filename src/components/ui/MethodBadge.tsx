"use client"

import Link from "next/link"
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { APERCU_PALETTE } from "@/components/home-v2/apercuTheme"

interface MethodBadgeProps {
  /** Anchor in /notre-methode to deep-link to. Default = #recommandations-age */
  anchor?: string
  /** Label shown in the pill. Default = "Analyse automatisée · en calibrage". */
  label?: string
  /** Tooltip body — what the badge actually discloses. */
  description?: string
  /** Optional variant for size/density. */
  size?: "sm" | "xs"
}

const DEFAULT_DESCRIPTION =
  "Cette estimation est générée par analyse automatisée du contenu (synopsis, classifications officielles, genres, thèmes). Elle est progressivement calibrée par les votes des foyers qui ont vu l'œuvre."

/**
 * Subtle eyebrow-style disclosure pill that signals a surface is auto-generated
 * and in active calibration — rather than a human-expert verdict.
 *
 * Placed on the 4 surfaces that could otherwise be read as human judgment:
 * expert age rec, content metrics, "what parents need to know", and topics tags.
 */
export function MethodBadge({
  anchor = "recommandations-age",
  label = "Analyse automatisée · en calibrage",
  description = DEFAULT_DESCRIPTION,
  size = "sm",
}: MethodBadgeProps) {
  const p = APERCU_PALETTE
  const isXs = size === "xs"

  const pill = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        isXs ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-[11px]"
      }`}
      style={{
        background: p.bg2,
        color: p.ink2,
        border: `1px solid ${p.line}`,
      }}
    >
      <Info
        className={isXs ? "h-2.5 w-2.5" : "h-3 w-3"}
        style={{ color: p.ink2 }}
      />
      {label}
    </span>
  )

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="cursor-help focus:outline-none"
            aria-label="Comment cette estimation est-elle générée ?"
          >
            {pill}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <p className="text-xs leading-relaxed mb-2">{description}</p>
          <Link
            href={`/notre-methode#${anchor}`}
            className="text-xs font-semibold underline"
            style={{ color: p.accent }}
          >
            En savoir plus sur notre méthode →
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
