"use client"

import { cn } from "@/lib/utils"
import { MemberAvatar } from "@/components/ui/MemberAvatar"
import { Heart } from "lucide-react"
import type { FamilyFitBand } from "@/lib/family-fit-display"

interface VariantMember {
  id: string
  name: string
  emoji: string
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  band: FamilyFitBand
}

interface VariantProps {
  members: VariantMember[]
  className?: string
}

// ---------------------------------------------------------------------------
// Hearts (Zelda-style HP gauge)
//
// 3 small hearts side-by-side under each avatar. Fill from left to right:
//   veryAdapted: 3/3 ❤❤❤
//   goodChoice:  2/3 ❤❤♡
//   check:       1/3 ❤♡♡
//   notYet:      0/3 ♡♡♡
// ---------------------------------------------------------------------------

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

export function FamilyFitAvatarsHearts({ members, className }: VariantProps) {
  if (members.length === 0) return null
  return (
    <div className={cn("flex items-start gap-2", className)}>
      {members.map((member) => {
        const filled = BAND_TO_HEARTS[member.band]
        const color = BAND_TO_HEART_COLOR[member.band]
        return (
          <div key={member.id} className="flex flex-col items-center gap-0.5">
            <MemberAvatar
              avatarStyle={member.avatarStyle ?? null}
              avatarSeed={member.avatarSeed ?? null}
              avatarOptions={member.avatarOptions ?? null}
              avatarEmoji={member.emoji}
              name={member.name}
              size={28}
              ring={null}
              className="shadow-sm"
            />
            <span className="text-[9px] text-gray-700 leading-none truncate max-w-[3.2rem]">
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

// ---------------------------------------------------------------------------
// Faces (predicted reaction)
//
// One emoji per member that captures how the kid is predicted to react.
//   veryAdapted: 😄
//   goodChoice:  🙂
//   check:       😐
//   notYet:      😟
// ---------------------------------------------------------------------------

const BAND_TO_FACE: Record<FamilyFitBand, string> = {
  veryAdapted: "\u{1F604}",
  goodChoice: "\u{1F642}",
  check: "\u{1F610}",
  notYet: "\u{1F61F}",
}

export function FamilyFitAvatarsFaces({ members, className }: VariantProps) {
  if (members.length === 0) return null
  return (
    <div className={cn("flex items-start gap-2", className)}>
      {members.map((member) => {
        const face = BAND_TO_FACE[member.band]
        return (
          <div key={member.id} className="flex flex-col items-center gap-0.5 relative">
            <div className="relative">
              <MemberAvatar
                avatarStyle={member.avatarStyle ?? null}
                avatarSeed={member.avatarSeed ?? null}
                avatarOptions={member.avatarOptions ?? null}
                avatarEmoji={member.emoji}
                name={member.name}
                size={28}
                ring={null}
                className="shadow-sm"
              />
              <span
                className="absolute -bottom-1 -right-1 text-[14px] leading-none drop-shadow-sm select-none"
                aria-hidden
              >
                {face}
              </span>
            </div>
            <span className="text-[9px] text-gray-700 leading-none truncate max-w-[3.2rem] mt-0.5">
              {member.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
