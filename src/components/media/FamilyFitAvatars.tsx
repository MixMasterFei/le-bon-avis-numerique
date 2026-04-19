"use client"

import { cn } from "@/lib/utils"
import { MemberAvatar } from "@/components/ui/MemberAvatar"

interface MemberFit {
  id: string
  name: string
  emoji: string // kept for backward compat
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  score: number
}

interface FamilyFitAvatarsProps {
  members: MemberFit[]
  compact?: boolean
  className?: string
}

/**
 * Per-member fit avatars under a media card. Always side-by-side
 * (no overlap) so each member is individually identifiable. Avatar
 * size shrinks as the member count grows so 5-6 members still fit
 * inside a narrow poster card without piling up.
 *
 * In non-compact mode (used on big cards) each avatar carries the
 * member's name underneath; compact mode (used on rails / small
 * cards) shows avatars only.
 */
export function FamilyFitAvatars({ members, compact = false, className }: FamilyFitAvatarsProps) {
  if (members.length === 0) return null

  // Shrink avatar size as the count grows so a foyer with 6 members
  // still fits in a ~140px-wide card. All sizes are non-overlapping.
  const baseSize = compact ? 20 : 24
  const size =
    members.length >= 6 ? baseSize - 6 :
    members.length >= 4 ? baseSize - 4 :
    baseSize

  // Tighten the gap when it gets crowded too.
  const gapClass =
    members.length >= 6 ? "gap-0.5" :
    members.length >= 4 ? "gap-1" :
    "gap-1.5"

  return (
    <div className={cn("flex items-start", gapClass, className)}>
      {members.map((member) => (
        <div
          key={member.id}
          className="flex flex-col items-center"
          title={`${member.name} — ${member.score}% compatible`}
        >
          <MemberAvatar
            avatarStyle={member.avatarStyle ?? null}
            avatarSeed={member.avatarSeed ?? null}
            avatarOptions={member.avatarOptions ?? null}
            avatarEmoji={member.emoji ?? null}
            name={member.name}
            size={size}
            ring={null}
            className="shadow-sm ring-1 ring-gray-200"
          />
          {!compact && members.length <= 4 && (
            <span className="text-[9px] text-gray-500 mt-0.5 leading-none truncate max-w-[3rem] text-center">
              {member.name}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export function FamilyFitAvatarsSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-full bg-gray-200 animate-pulse",
            compact ? "h-5 w-5" : "h-6 w-6"
          )}
        />
      ))}
    </div>
  )
}
