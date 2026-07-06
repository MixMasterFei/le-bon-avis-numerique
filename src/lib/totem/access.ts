// Totem Assistant access gate.
//
// Totem is account-gated by design: a connected user is required at every
// rollout stage. The `TOTEM_PUBLIC` env var only widens WHICH connected
// users get access:
//   (unset)                      → admin-only (alpha default)
//   "true" / "1" / "auth"        → all authenticated users (any role)
// There is deliberately NO anonymous mode — family context (ages, quiz,
// sensibilités) is what makes Totem's answers reliable, and the anonymous
// rate limiter is per-instance on Vercel (too soft for open traffic).
// Mirrors the NEWSLETTER_PUBLIC pattern documented in CLAUDE.md.

export type TotemAccessMode = "admin-only" | "authenticated"

export function getTotemAccessMode(): TotemAccessMode {
  const flag = process.env.TOTEM_PUBLIC?.toLowerCase()
  if (flag === "true" || flag === "1" || flag === "auth" || flag === "authenticated") {
    return "authenticated"
  }
  return "admin-only"
}

export interface TotemAccessInput {
  isAuthenticated: boolean
  role: string | null | undefined
}

export function canUseTotem(input: TotemAccessInput): boolean {
  // A connected account is a hard prerequisite in every mode.
  if (!input.isAuthenticated) return false
  switch (getTotemAccessMode()) {
    case "authenticated":
      return true
    case "admin-only":
      return input.role === "ADMIN"
  }
}
