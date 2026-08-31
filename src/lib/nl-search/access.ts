// "Recherche magique" access gate — the natural-language search on /decouverte.
//
// Graduated rollout via the `NL_SEARCH_PUBLIC` env var, with EXACTLY the
// semantics of TOTEM_PUBLIC (src/lib/totem/access.ts) so the two features can't
// drift into different rollout vocabularies:
//   "off" / "0"        → KILL SWITCH: disabled for everyone, admins included
//                        (the entry point disappears, /decouverte redirects)
//   (unset)            → admin-only (launch default)
//   "auth"             → all authenticated users
//   "true" / "1"       → fully public, anonymous visitors included
//
// As with TOTEM_PUBLIC, "false" deliberately still means admin-only (historical
// fallthrough), NOT off — use "off" or "0" to shut it down.
//
// Note this is layered UNDER the V2 gate at the entry point: the search field
// lives in the V2 hero, so a visitor needs V2 *and* this flag to see it. The
// /decouverte page itself only checks this flag, so a shared link keeps working
// for anyone the flag admits.

export type NlSearchAccessMode = "off" | "admin-only" | "authenticated" | "public"

export function getNlSearchAccessMode(): NlSearchAccessMode {
  const flag = process.env.NL_SEARCH_PUBLIC?.toLowerCase()
  if (flag === "off" || flag === "0") return "off"
  if (flag === "true" || flag === "1") return "public"
  if (flag === "auth" || flag === "authenticated") return "authenticated"
  return "admin-only"
}

export interface NlSearchAccessInput {
  isAuthenticated: boolean
  role: string | null | undefined
}

export function canUseNlSearch(input: NlSearchAccessInput): boolean {
  switch (getNlSearchAccessMode()) {
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
