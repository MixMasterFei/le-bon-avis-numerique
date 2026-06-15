"use client"

import { useMemo } from "react"
import Image from "next/image"
import { getAvatarDataUri, resolveAvatar } from "@/lib/avatar"
import { cn } from "@/lib/utils"
import { useV2Type } from "@/components/providers/V2TypeProvider"
import { memberColorFromName } from "@/components/home-redesign/family"

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
  // Under the V2 visual system (admin, or HOMEPAGE_V2_PUBLIC=true) every member
  // avatar becomes a two-letter colored monogram — the same slicker treatment
  // used on the V2 homepage/catalogue. Gated so the public site keeps the
  // generated avatars until the flip.
  const v2Type = useV2Type()

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

  if (v2Type) {
    const trimmed = (name ?? "").trim()
    const initials = trimmed
      ? (trimmed.charAt(0).toUpperCase() + trimmed.slice(1, 2).toLowerCase())
      : "?"
    return (
      <span
        aria-label={name ? `Avatar de ${name}` : "Avatar"}
        className={cn(
          "inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
          ringClasses,
          className,
        )}
        style={{
          width: size,
          height: size,
          background: memberColorFromName(trimmed || "?"),
          fontSize: Math.round(size * 0.4),
          letterSpacing: "-0.02em",
        }}
      >
        {initials}
      </span>
    )
  }

  return (
    <Image
      src={avatarUri}
      alt={name ? `Avatar de ${name}` : "Avatar"}
      width={size}
      height={size}
      unoptimized
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
