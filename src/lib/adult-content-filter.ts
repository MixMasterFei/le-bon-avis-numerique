/**
 * Import-time guard against pornographic / hardcore content on a family guide.
 *
 * Deliberately TIGHT so mainstream titles that belong in the catalogue behind an
 * age gate are NOT caught: art films whose synopsis mentions "prostituée",
 * violent-but-acclaimed seinen (Berserk, Tokyo Ghoul, Chainsaw Man), 8MM-style
 * thrillers, etc. This blocks only genuinely pornographic imports — hentai,
 * eroge, explicit porn — plus the source platforms' own adult flags.
 *
 * Runs at every automated import path: TMDB movies/TV, IGDB games, AniList
 * manga. It's the forward guard that pairs with the one-off cleanup that removed
 * the pre-guard entries (deep young-kids sweep exposed the gap). Keep the token
 * list unambiguous — every addition risks blocking a legitimate title.
 */

// Unicode-letter boundaries (accents included) so "érotique" is caught but
// "neurotic"/"Erotissimo"/"ecchymose" are not. `porn\w*` covers porn/porno/
// pornographie/pornographic in one; standalone stems (hentai/eroge/nukige) can't
// hide inside common words so they need no trailing anchor beyond the boundary.
const HARDCORE_RE =
  /(?<![\p{L}])(hentai|eroge|nukige|érotiques?|erotiques?|erotica|erotic|porn\w*|softcore|sexe explicites?|sexuel\w* explicites?|sexuellement explicites?|sexually explicit|explicit sexual|ecchi)(?![\p{L}])/iu

function kw(...parts: (string | null | undefined)[]): boolean {
  return HARDCORE_RE.test(parts.filter(Boolean).join(" "))
}

/** TMDB movie: the platform's own `adult` flag + a hardcore keyword backstop
 *  (some hentai OVAs ship as `adult:false` but describe explicit sex). */
export function isAdultTmdbMovie(d: {
  adult?: boolean
  title?: string
  original_title?: string
  overview?: string
}): boolean {
  return d.adult === true || kw(d.title, d.original_title, d.overview)
}

/** TMDB TV: details carry no reliable `adult` flag → keyword backstop only. */
export function isAdultTmdbTv(d: {
  adult?: boolean
  name?: string
  original_name?: string
  overview?: string
}): boolean {
  return d.adult === true || kw(d.name, d.original_name, d.overview)
}

// IGDB "Erotic" theme id — games tagged with it are adult-only.
const IGDB_EROTIC_THEME = 42

/** IGDB game: the Erotic theme + a hardcore keyword backstop on name/summary. */
export function isAdultIgdbGame(g: {
  name?: string
  summary?: string
  themes?: { id?: number; name?: string }[]
}): boolean {
  if (g.themes?.some((t) => t.id === IGDB_EROTIC_THEME || /erotic/i.test(t.name || ""))) return true
  return kw(g.name, g.summary)
}

// AniList marks only true hentai as `isAdult`, so Ecchi smut (18+) slips through
// with isAdult:false. On a family guide we don't auto-import either genre.
const ADULT_MANGA_GENRES = new Set(["hentai", "ecchi"])

/** AniList manga: adult flag + Hentai/Ecchi genre + keyword backstop. */
export function isAdultAniListManga(m: {
  isAdult?: boolean | null
  genres: string[]
  title?: string | null
  description?: string | null
}): boolean {
  if (m.isAdult === true) return true
  if (m.genres.some((g) => ADULT_MANGA_GENRES.has(g.toLowerCase()))) return true
  return kw(m.title, m.description)
}
