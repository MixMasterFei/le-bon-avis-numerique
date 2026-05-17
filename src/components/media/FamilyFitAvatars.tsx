"use client"

import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import {
  FAMILY_FIT_LABELS,
  familyFitBandFromLevel,
  familyFitBandFromScore,
  type FamilyFitBand,
} from "@/lib/family-fit-display"
import type { FitLevel } from "@/lib/family-fit-score"

interface MemberFit {
  id: string
  name: string
  emoji: string // kept for backward compat
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  score: number
  level?: FitLevel
  reason?: string
  hasPreferences?: boolean
}

interface FamilyFitAvatarsProps {
  members: MemberFit[]
  compact?: boolean
  className?: string
}

// Zelda-style HP gauge: 3 hearts under each member, filled by fit band.
// Picked over the colored-ring approach (chosen via /test/avatar-variants)
// because the verdict is now visible at a glance instead of hidden in a
// hover tooltip.
const BAND_TO_HEARTS: Record<FamilyFitBand, number> = {
  veryAdapted: 3,
  goodChoice: 2,
  check: 1,
  notYet: 0,
}

const BAND_TO_HEART_COLOR: Record<FamilyFitBand, string> = {
  veryAdapted: "text-emerald-500",
  goodChoice: "text-sky-500",
  check: "text-amber-500",
  notYet: "text-rose-400",
}

/**
 * Per-member fit pills under a media card. Each pill is a small avatar
 * with the member's name and a 3-heart gauge below — heart count encodes
 * the fit band (3 = très adapté, 2 = bon choix, 1 = à vérifier, 0 = trop
 * tôt). Always side-by-side (no overlap) so each member is individually
 * identifiable.
 *
 * `compact` shrinks the avatar slightly so rails / small cards still fit
 * 4+ members on a narrow poster.
 */
export function FamilyFitAvatars({ members, compact = false, className }: FamilyFitAvatarsProps) {
  if (members.length === 0) return null

  const baseSize = compact ? 26 : 30
  const size =
    members.length >= 5 ? baseSize - 4 :
    members.length >= 4 ? baseSize - 2 :
    baseSize

  const gapClass =
    members.length >= 5 ? "gap-0.5" :
    members.length >= 4 ? "gap-1" :
    "gap-1.5"

  return (
    <div className={cn("flex items-start", gapClass, className)}>
      {members.map((member) => {
        const band = member.level
          ? familyFitBandFromLevel(member.level)
          : familyFitBandFromScore(member.score)
        const filled = BAND_TO_HEARTS[band]
        const color = BAND_TO_HEART_COLOR[band]
        const shortReason = member.reason
          ? member.reason
              .replace("Bas\u00e9 surtout sur l'\u00e2ge", "\u00e2ge")
              .replace("Bas\u00e9 uniquement sur l'\u00e2ge", "\u00e2ge")
              .replace("Recommand\u00e9 \u00e0 partir de", "d\u00e8s")
          : member.hasPreferences === false
            ? "\u00e2ge"
            : ""
        const title = `${member.name} : ${FAMILY_FIT_LABELS[band]}${shortReason ? ` \u00b7 ${shortReason}` : ""}`

        return (
          <div
            key={member.id}
            className="flex flex-col items-center gap-0.5"
            title={title}
          >
            <MemberAvatar
              avatarStyle={member.avatarStyle ?? null}
              avatarSeed={member.avatarSeed ?? null}
              avatarOptions={member.avatarOptions ?? null}
              avatarEmoji={member.emoji ?? null}
              name={member.name}
              size={size}
              ring={null}
              className="shadow-sm"
            />
            <span className="text-[9px] text-gray-700 leading-none truncate max-w-[3.2rem] text-center">
              {member.name}
            </span>
            <div className="flex gap-[1px]">
              {[0, 1, 2].map((i) => (
                <Heart
                  key={i}
                  className={cn("h-2.5 w-2.5", i < filled ? color : "text-gray-300")}
                  fill={i < filled ? "currentColor" : "none"}
                  strokeWidth={2}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FamilyFitAvatarsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-start gap-1.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className={cn(
              "rounded-full bg-gray-200 animate-pulse",
              compact ? "h-[26px] w-[26px]" : "h-[30px] w-[30px]"
            )}
          />
          <div className="h-2 w-8 rounded bg-gray-200 animate-pulse" />
          <div className="h-2 w-9 rounded bg-gray-100 animate-pulse" />
        </div>
      ))}
    </div>
  )
}
