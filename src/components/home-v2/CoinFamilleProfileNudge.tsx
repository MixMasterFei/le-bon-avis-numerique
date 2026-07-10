"use client"

import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { APERCU_PALETTE } from "./apercuTheme"

export interface ProfileNudgeMember {
  id: string
  name: string
  completionPercent: number
  nextStep: string
}

/**
 * Compact banner when a family exists but profiles are still thin — keeps
 * the personalized rails useful while steering parents to the highest-impact
 * completion step per member.
 */
export function CoinFamilleProfileNudge({ members }: { members: ProfileNudgeMember[] }) {
  const p = APERCU_PALETTE
  const incomplete = members.filter((member) => member.completionPercent < 70)
  if (incomplete.length === 0) return null

  const focus = [...incomplete].sort((a, b) => a.completionPercent - b.completionPercent)[0]

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ background: p.bg2, border: `1px solid ${p.line}` }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: p.card, color: p.accent }}
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: p.ink }}>
            Des suggestions encore plus précises pour {focus.name}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: p.ink2 }}>
            Profil à {focus.completionPercent} % — {focus.nextStep.toLowerCase()}.
          </p>
        </div>
      </div>
      <Link
        href={`/profil/membres/${focus.id}`}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-3.5 py-2 text-xs font-semibold transition-opacity hover:opacity-90 sm:self-center"
        style={{ background: p.ink, color: p.bg }}
      >
        Compléter le profil
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
