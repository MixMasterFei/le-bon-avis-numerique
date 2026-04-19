"use client"

import Image from "next/image"
import { MemberAvatar } from "./MemberAvatar"

export interface UserAvatarData {
  id?: string
  name?: string | null
  email?: string | null
  image?: string | null
  avatarStyle?: string | null
  avatarSeed?: string | null
  avatarOptions?: Record<string, unknown> | null
}

interface UserAvatarProps {
  user: UserAvatarData
  size?: number
  className?: string
}

/**
 * Renders a User-shaped avatar using the first available source:
 *   1. `image` (NextAuth/Google OAuth)
 *   2. DiceBear from `avatarStyle` + `avatarSeed` (reuses MemberAvatar)
 *   3. Initial fallback pill (warm cream background, ink initial)
 */
export function UserAvatar({ user, size = 32, className }: UserAvatarProps) {
  const fallbackLabel = (user.name || user.email || "?").trim()[0]?.toUpperCase() || "?"
  const alt = user.name || user.email || "Utilisateur"

  if (user.image) {
    return (
      <Image
        src={user.image}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    )
  }

  if (user.avatarStyle && user.avatarSeed) {
    return (
      <MemberAvatar
        avatarStyle={user.avatarStyle}
        avatarSeed={user.avatarSeed}
        avatarOptions={user.avatarOptions ?? null}
        avatarEmoji={null}
        name={user.name ?? null}
        size={size}
        className={className}
      />
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-[11px] font-semibold ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: "#EDE7DA",
        color: "#1E1A15",
        border: "1px solid rgba(30,26,21,0.10)",
      }}
      aria-label={alt}
    >
      {fallbackLabel}
    </span>
  )
}
