"use client"

import { useState } from "react"
import {
  FAMILY_FIT_LABELS,
  familyFitBandFromLevel,
  familyFitBandFromScore,
} from "@/lib/family-fit-display"
import type { FitLevel } from "@/lib/family-fit-score"
import { memberColor, BAND_TO_SEGMENTS } from "./family"
import { MemberMonogram } from "./MemberMonogram"

interface MemberFit {
  id: string
  name: string
  emoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  score: number
  level?: FitLevel
  reason?: string
  hasPreferences?: boolean
}

const MAX_VISIBLE = 3

/**
 * V2 per-member appreciation row (the catalogue mock's `.cc-fam`).
 *
 * Per family member: a monogram + a vertical 3-segment meter that fills
 * BOTTOM-UP by the member's fit verdict, colored by member identity. Mapping
 * is identical to the classic heart gauge (FamilyFitAvatars) so a title never
 * shows two different verdicts across V2 / classic:
 *   member.level → familyFitBandFromLevel (fallback score → ...FromScore)
 *   band → BAND_TO_SEGMENTS (lit segments) / FAMILY_FIT_LABELS (tooltip)
 *
 * To keep the row inside the card, only the first MAX_VISIBLE members render;
 * the rest collapse into a "+N" chip that expands the full family on hover/tap.
 */
function MemberUnit({ member, idx }: { member: MemberFit; idx: number }) {
  const band = member.level
    ? familyFitBandFromLevel(member.level)
    : familyFitBandFromScore(member.score)
  const lit = BAND_TO_SEGMENTS[band]
  const color = memberColor(idx)
  const title = `${member.name} : ${FAMILY_FIT_LABELS[band]}`
  return (
    <div className="flex items-center gap-1" title={title}>
      <MemberMonogram name={member.name} color={color} size={24} />
      <div className="flex flex-col gap-[2px]">
        {[0, 1, 2].map((s) => {
          const on = s >= 3 - lit
          return (
            <i
              key={s}
              className="block"
              style={{ width: 5, height: 5, borderRadius: 1.5, background: on ? color : "var(--r0)", opacity: on ? 1 : 0.5 }}
            />
          )
        })}
      </div>
    </div>
  )
}

export function FamilyFitMeter({ members }: { members: MemberFit[] }) {
  const [open, setOpen] = useState(false)
  if (members.length === 0) return null

  const visible = members.slice(0, MAX_VISIBLE)
  const overflow = members.slice(MAX_VISIBLE)

  return (
    <div className="flex items-center gap-2">
      {visible.map((member, idx) => (
        <MemberUnit key={member.id} member={member} idx={idx} />
      ))}

      {overflow.length > 0 && (
        <div
          className="relative"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            aria-label={`Voir les ${overflow.length} autres membres`}
            className="flex h-6 items-center justify-center rounded-full px-2 text-[11px] font-bold"
            style={{ background: "var(--paper-2)", color: "var(--ink-2)", border: "1px solid var(--line)" }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen((o) => !o)
            }}
          >
            +{overflow.length}
          </button>

          {/* Expanded full-family popover */}
          <div
            className={`absolute bottom-full left-0 z-40 mb-2 w-max max-w-[260px] rounded-xl p-2.5 transition-all duration-150 ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
            style={{ background: "var(--card)", border: "1px solid var(--line)", boxShadow: "0 18px 40px -16px rgba(40,28,12,.5)" }}
          >
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
              Toute la famille
            </div>
            <div className="flex flex-col gap-1.5">
              {members.map((member, idx) => {
                const band = member.level
                  ? familyFitBandFromLevel(member.level)
                  : familyFitBandFromScore(member.score)
                return (
                  <div key={member.id} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <MemberMonogram name={member.name} color={memberColor(idx)} size={20} />
                      <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>{member.name}</span>
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: "var(--ink-2)" }}>
                      {FAMILY_FIT_LABELS[band]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
