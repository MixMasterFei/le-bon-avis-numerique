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
  /**
   * Render a discreet "?" help button instead of the full text pill. Same
   * tooltip (the label becomes the tooltip heading). Use where the disclosure
   * would otherwise repeat several times on one page.
   */
  iconOnly?: boolean
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
  iconOnly = false,
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

  // Discreet "?" help button — same tooltip, far less visual repetition.
  const help = (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold leading-none"
      style={{
        width: isXs ? 16 : 18,
        height: isXs ? 16 : 18,
        fontSize: isXs ? 10 : 11,
        background: p.bg2,
        color: p.ink2,
        border: `1px solid ${p.line}`,
      }}
    >
      ?
    </span>
  )

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="cursor-help focus:outline-none"
            aria-label={`${label} — comment cette estimation est-elle générée ?`}
          >
            {iconOnly ? help : pill}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          {iconOnly && <p className="text-xs font-semibold mb-1">{label}</p>}
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
