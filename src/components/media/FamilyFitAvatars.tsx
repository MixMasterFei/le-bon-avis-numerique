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

export function FamilyFitAvatars({ members, compact = false, className }: FamilyFitAvatarsProps) {
  if (members.length === 0) return null

  const isOverlapping = members.length >= 4

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <div className={cn("flex items-center", isOverlapping ? "-space-x-1.5" : "gap-1.5")}>
        {members.map((member, i) => {
          return (
            <div
              key={member.id}
              className={cn(
                "flex flex-col items-center",
                isOverlapping && i > 0 && "-ml-1.5"
              )}
              title={`${member.name} — ${member.score}% compatible`}
            >
              <MemberAvatar
                avatarStyle={member.avatarStyle ?? null}
                avatarSeed={member.avatarSeed ?? null}
                avatarOptions={member.avatarOptions ?? null}
                avatarEmoji={member.emoji ?? null}
                name={member.name}
                size={compact ? 20 : 24}
                ring={null}
                className="shadow-sm ring-1 ring-gray-200"
              />
              {!isOverlapping && !compact && (
                <span className="text-[9px] text-gray-500 mt-0.5 leading-none truncate max-w-[3rem] text-center">
                  {member.name}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {isOverlapping && (
        <span className="text-[9px] text-gray-400 ml-1">
          {members.length} membres
        </span>
      )}
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
