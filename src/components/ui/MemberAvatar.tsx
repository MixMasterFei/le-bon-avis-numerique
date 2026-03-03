"use client"

import { useMemo } from "react"
import { getAvatarDataUri, resolveAvatar } from "@/lib/avatar"
import { cn } from "@/lib/utils"

interface MemberAvatarProps {
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
  avatarEmoji?: string | null
  name?: string | null
  size?: number
  className?: string
  ring?: "green" | "amber" | "red" | "violet" | null
}

export function MemberAvatar({
  avatarStyle,
  avatarSeed,
  avatarOptions,
  avatarEmoji,
  name,
  size = 40,
  className,
  ring,
}: MemberAvatarProps) {
  const avatarUri = useMemo(() => {
    const resolved = resolveAvatar({
      avatarStyle,
      avatarSeed,
      avatarOptions,
      avatarEmoji,
      name,
    })
    return getAvatarDataUri(resolved.style, resolved.seed, resolved.options, size * 2)
  }, [avatarStyle, avatarSeed, avatarOptions, avatarEmoji, name, size])

  const ringClasses = ring
    ? {
        green: "ring-2 ring-emerald-400",
        amber: "ring-2 ring-amber-400",
        red: "ring-2 ring-red-400",
        violet: "ring-2 ring-violet-400",
      }[ring]
    : ""

  return (
    <img
      src={avatarUri}
      alt={name ? `Avatar de ${name}` : "Avatar"}
      width={size}
      height={size}
      className={cn(
        "rounded-full bg-gray-50 flex-shrink-0",
        ringClasses,
        className
      )}
      style={{ width: size, height: size }}
      draggable={false}
    />
  )
}
