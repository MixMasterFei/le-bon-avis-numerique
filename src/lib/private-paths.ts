/**
 * The private / auth-only / legacy surfaces no crawler should ever fetch.
 *
 * Single source of truth, consumed by:
 *  - `src/app/robots.ts`     — publishes them as `Disallow` rules (the polite ask)
 *  - `src/middleware.ts`     — enforces them against crawlers that ignore robots.txt
 *
 * Keeping one list means the enforcement can never drift from what robots.txt
 * actually advertises.
 */
export const PRIVATE_PATHS = [
  "/admin/",
  // Staff console (ADMIN or MODERATOR). Same reasoning as /admin: never
  // indexed, and the middleware answers 403 to crawlers that ask anyway.
  "/steph",
  "/api/",
  "/profil",
  "/chez-vous",
  "/coin-famille",
  "/mes-avis/",
  "/ma-liste/",
  "/mes-favoris/",
  "/studio/",
  "/apercu",
  "/apercufilm",
  "/apercufilmslist",
  "/apercufoyer",
  "/apercudecouverte",
  "/inscription",
  // Per-visitor query results: one URL per question asked, so an unbounded
  // space with nothing indexable in it (the pages carry noindex too). Every
  // title it links to is already reachable from the catalogue.
  "/decouverte",
] as const

/**
 * Does `pathname` fall under one of the disallowed prefixes?
 *
 * Matches on segment boundaries ("/profil" covers "/profil/quiz/x" but not a
 * hypothetical "/profils-publics"), which is stricter than robots.txt's raw
 * prefix matching — every surface we mean to cover is enumerated explicitly
 * above, so the stricter rule costs us nothing and can't over-block.
 */
export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATHS.some((raw) => {
    const prefix = raw.endsWith("/") ? raw.slice(0, -1) : raw
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

/**
 * Deliberately AI-facing endpoints that happen to sit under a private prefix.
 *
 * The MCP server lives at `/api/mcp/*` but is public, anonymous and read-only —
 * it exists precisely so AI clients can call it. robots.txt still disallows
 * `/api/` (no crawler should *index* the endpoint), but the middleware's
 * crawler enforcement must not answer 403 there, or an MCP client sending a
 * recognised assistant user-agent would be locked out of a public tool.
 *
 * Enforcement-only: intentionally NOT applied to `isPrivatePath`, so what
 * robots.txt advertises stays exactly as-is.
 */
const AI_FACING_ENDPOINTS = ["/api/mcp"] as const

export function isAiFacingEndpoint(pathname: string): boolean {
  return AI_FACING_ENDPOINTS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
