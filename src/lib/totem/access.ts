// Totem Assistant access gate.
//
// Default: admin-only (alpha rollout). Set `TOTEM_PUBLIC=true` in the
// environment to open it to all authenticated users, then to anonymous
// visitors. Mirrors the NEWSLETTER_PUBLIC pattern documented in CLAUDE.md.

export type TotemAccessMode = "off" | "admin-only" | "public"

export function getTotemAccessMode(): TotemAccessMode {
  const flag = process.env.TOTEM_PUBLIC?.toLowerCase()
  if (flag === "true" || flag === "1") return "public"
  return "admin-only"
}

export interface TotemAccessInput {
  isAuthenticated: boolean
  role: string | null | undefined
}

export function canUseTotem(input: TotemAccessInput): boolean {
  const mode = getTotemAccessMode()
  if (mode === "off") return false
  if (mode === "public") return true
  // admin-only
  return input.role === "ADMIN"
}
