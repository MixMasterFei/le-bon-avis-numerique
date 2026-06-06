"use client"

import Link from "next/link"
import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ProvisionalBadgeProps {
  /** "xs" for cards, "sm" for the detail page. */
  size?: "xs" | "sm"
  /** Wrap in a tooltip explaining the provisional age (detail page). Cards use a plain pill. */
  withTooltip?: boolean
}

const DESCRIPTION =
  "Cet âge est une estimation provisoire (classification officielle ou genre) en attendant notre analyse complète. Il peut évoluer."

/**
 * Flags a film whose age rating is a provisional estimate — imported recently and
 * not yet fully analysed. Honest signal next to the age badge so a derived age is
 * never read as a confirmed expert verdict. See [[provisional-ratings]].
 */
export function ProvisionalBadge({ size = "xs", withTooltip = false }: ProvisionalBadgeProps) {
  const isXs = size === "xs"

  const pill = (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border border-amber-300 bg-amber-50 text-amber-700 ${
        isXs ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      <Info className={isXs ? "h-2.5 w-2.5" : "h-3 w-3"} />
      Âge provisoire
    </span>
  )

  if (!withTooltip) return pill

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="cursor-help focus:outline-none"
            aria-label="Pourquoi cet âge est-il provisoire ?"
          >
            {pill}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <p className="text-xs leading-relaxed mb-2">{DESCRIPTION}</p>
          <Link
            href="/notre-methode#recommandations-age"
            className="text-xs font-semibold underline text-amber-700"
          >
            Notre méthode →
          </Link>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
