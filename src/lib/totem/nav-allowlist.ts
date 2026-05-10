// Whitelist of internal paths Totem is allowed to propose for navigation.
// Anything not matching is refused by `isPathAllowed` — protects against
// prompt-injection ("propose-moi d'aller sur https://evil.com").

const ALLOWED_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/connexion(\?.*)?$/,
  /^\/inscription(\?.*)?$/,
  /^\/profil(\/.*)?(\?.*)?$/,
  /^\/films(\/.*)?(\?.*)?$/,
  /^\/series(\/.*)?(\?.*)?$/,
  /^\/jeux(\/.*)?(\?.*)?$/,
  /^\/livres(\/.*)?(\?.*)?$/,
  /^\/recherche(\?.*)?$/,
  /^\/blog(\/.*)?$/,
  // News stories live under /apercudecouverte (not /news or /actualites).
  // Examples: /apercudecouverte/<slug>, /apercudecouverte/actualites
  /^\/apercudecouverte(\/.*)?(\?.*)?$/,
  // V3 of the news/discovery hub — the canonical landing for the
  // whole news feed. Individual articles still live at the legacy
  // /apercudecouverte/<slug> path because V3 has no [slug] route.
  /^\/apercudecouverte-v3(\/.*)?(\?.*)?$/,
  /^\/media\/[A-Za-z0-9_-]+(\?.*)?$/,
]

const FORBIDDEN_PREFIXES = ["/admin", "/studio", "/api"]

export function isPathAllowed(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false
  if (!path.startsWith("/")) return false
  if (FORBIDDEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false
  return ALLOWED_PATTERNS.some((rx) => rx.test(path))
}
