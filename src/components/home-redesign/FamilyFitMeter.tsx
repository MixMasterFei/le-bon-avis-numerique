"use client"

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

/**
 * V2 "POUR" appreciation row — the catalogue mock's `.cc-fam`.
 *
 * Per family member: a circular avatar + a vertical 3-segment meter. The
 * meter fills BOTTOM-UP (like a level/signal indicator) by the member's fit
 * verdict, and is colored by member *identity* (memberColor) so the row reads
 * as "who, and how much" at a glance.
 *
 * Mapping (kept identical to the classic heart gauge in FamilyFitAvatars so a
 * title never gets two different verdicts across V2 / classic):
 *   member.level → familyFitBandFromLevel  (fallback: score → ...FromScore)
 *   band         → BAND_TO_SEGMENTS        (3 / 2 / 1 / 0 lit segments)
 *   band         → FAMILY_FIT_LABELS       (hover tooltip text)
 */
export function FamilyFitMeter({ members }: { members: MemberFit[] }) {
  if (members.length === 0) return null

  return (
    <div className="flex items-start gap-2.5">
      <span
        className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em]"
        style={{ color: "var(--ink-3)" }}
      >
        Pour
      </span>
      <div className="flex items-start gap-2.5">
        {members.map((member, idx) => {
          const band = member.level
            ? familyFitBandFromLevel(member.level)
            : familyFitBandFromScore(member.score)
          const lit = BAND_TO_SEGMENTS[band]
          const color = memberColor(idx)
          const title = `${member.name} : ${FAMILY_FIT_LABELS[band]}`

          return (
            <div key={member.id} className="flex items-center gap-1" title={title}>
              <MemberMonogram name={member.name} color={color} size={24} />
              {/* vertical meter: segment s (0=top … 2=bottom) lights when
                  s >= 3 - lit, so fills from the bottom up. */}
              <div className="flex flex-col gap-[2px]">
                {[0, 1, 2].map((s) => {
                  const on = s >= 3 - lit
                  return (
                    <i
                      key={s}
                      className="block"
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 1.5,
                        background: on ? color : "var(--r0)",
                        opacity: on ? 1 : 0.5,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
