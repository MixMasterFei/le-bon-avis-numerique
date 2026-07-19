// Totem Assistant access gate.
//
// Graduated rollout via the `TOTEM_PUBLIC` env var:
//   "off" / "0"        → KILL SWITCH: disabled for everyone, admins included
//                        (403 on all /api/totem routes, dock not rendered)
//   (unset)            → admin-only (alpha default)
//   "auth"             → all authenticated users (logged-in, any role)
//   "true" / "1"       → fully public, anonymous visitors included
// This lets the assistant open to logged-in members first and only then to
// anonymous traffic — a deliberate two-step, not a single jump to public.
// Mirrors the NEWSLETTER_PUBLIC pattern documented in CLAUDE.md.
//
// Note: "false" deliberately still means admin-only (its historical
// behavior via fallthrough), NOT off — remapping it could silently flip an
// existing Vercel env value into a full shutdown. Use "off" or "0".

export type TotemAccessMode = "off" | "admin-only" | "authenticated" | "public"

export function getTotemAccessMode(): TotemAccessMode {
  const flag = process.env.TOTEM_PUBLIC?.toLowerCase()
  if (flag === "off" || flag === "0") return "off"
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
