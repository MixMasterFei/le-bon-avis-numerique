// Totem Assistant access gate.
//
// Graduated rollout via the `TOTEM_PUBLIC` env var:
//   (unset)            → admin-only (alpha default)
//   "auth"             → all authenticated users (logged-in, any role)
//   "true" / "1"       → fully public, anonymous visitors included
// This lets the assistant open to logged-in members first and only then to
// anonymous traffic — a deliberate two-step, not a single jump to public.
// Mirrors the NEWSLETTER_PUBLIC pattern documented in CLAUDE.md.

export type TotemAccessMode = "off" | "admin-only" | "authenticated" | "public"

export function getTotemAccessMode(): TotemAccessMode {
  const flag = process.env.TOTEM_PUBLIC?.toLowerCase()
  if (flag === "true" || flag === "1") return "public"
  if (flag === "auth" || flag === "authenticated") return "authenticated"
  return "admin-only"
}

export interface TotemAccessInput {
  isAuthenticated: boolean
  role: string | null | undefined
}

export function canUseTotem(input: TotemAccessInput): boolean {
  switch (getTotemAccessMode()) {
    case "off":
      return false
    case "public":
      return true
    case "authenticated":
      return input.isAuthenticated
    case "admin-only":
      return input.role === "ADMIN"
  }
}
