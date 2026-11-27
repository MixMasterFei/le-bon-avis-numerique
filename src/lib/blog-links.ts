import { guideKeyForTitle } from "@/lib/game-guides"
import { isChristmasSeason } from "@/lib/seasonal"
import { WARNINGS_MIN_CONFIDENCE } from "@/lib/sensitive-warnings"

// « À lire aussi » — the one blog article a fiche links to, and the
// « Conseils pour les parents » strips on /films and /jeux.
//
// Pure (no Prisma, no Sanity, no Next): the caller passes the live slugs
// (getLiveBlogSlugs, cached 5 min, never throws) and the gift-list membership
// (isNoelGiftGame), so every rule is pinned by
// src/lib/__tests__/blog-links.test.ts. A slug that is not live is never
// returned: the two Christmas articles show up by themselves on their
// publication day, and a link never points at a 404.

export type BlogArticleSlug =
  | "bon-age-film-enfant"
  | "films-qui-font-peur-enfant-pret"
  | "soiree-film-en-famille"
  | "jeux-video-noel-selon-age"
  | "gta-6-sous-le-sapin"

export interface BlogArticleRef {
  slug: BlogArticleSlug
  /** The article's real title — pinned against blog/NN-*.md by a test. */
  title: string
  /** One line, factual, no superlatives. */
  teaser: string
  shelf: "films" | "jeux"
  /** Only pushed in November–December (isChristmasSeason). */
  christmas?: boolean
}

export const BLOG_ARTICLES: Record<BlogArticleSlug, BlogArticleRef> = {
  "bon-age-film-enfant": {
    slug: "bon-age-film-enfant",
    title: "À quel âge voir un film ? Apprendre à lire les recommandations",
    teaser: "Classification, âge conseillé, sensibilité de l'enfant : dans quel ordre lire les repères avant une séance.",
    shelf: "films",
  },
  "films-qui-font-peur-enfant-pret": {
    slug: "films-qui-font-peur-enfant-pret",
    title: "Un film qui fait peur est-il adapté à votre enfant ?",
    teaser: "Ce qui risque de l'impressionner, les repères d'âge à vérifier et le droit d'arrêter le film en cours de route.",
    shelf: "films",
  },
  "soiree-film-en-famille": {
    slug: "soiree-film-en-famille",
    title: "Quel film regarder en famille ce soir ?",
    teaser: "Une méthode courte pour choisir ensemble entre deux ou trois films, selon le temps et l'envie de chacun.",
    shelf: "films",
  },
  "jeux-video-noel-selon-age": {
    slug: "jeux-video-noel-selon-age",
    title: "Quels jeux vidéo offrir à Noël selon l'âge de l'enfant",
    teaser: "PEGI, âge conseillé, achats intégrés : ce qu'il faut lire sur la boîte avant d'emballer un jeu.",
    shelf: "jeux",
    christmas: true,
  },
  "gta-6-sous-le-sapin": {
    slug: "gta-6-sous-le-sapin",
    title: "GTA 6 sous le sapin : ce que les parents doivent savoir",
    teaser: "Ce que contient le jeu, pourquoi il est classé PEGI 18 et comment répondre à un enfant qui le réclame.",
    shelf: "jeux",
    christmas: true,
  },
}

export const blogArticleHref = (slug: string) => `/blog/${slug}`

/** The slug behind a « /blog/<slug> » href, or null for any other link. */
export function blogSlugFromHref(href: string | null | undefined): string | null {
  const m = href?.match(/^\/blog\/([a-z0-9-]+)\/?$/)
  return m ? m[1] : null
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

// ── Frightening signal ──────────────────────────────────────────────────
// ContentMetrics has no numeric « fear » score: the content analysis records
// fear as closed-list warnings (« Ce qui peut marquer ») and as a tone tag.
// The fear axis below counts those signals, the tone tag weighing 2 (it is
// the analysis's read of the WHOLE work, not of a scene).
//   - a frightening genre (horreur, épouvante, fantastique) needs an axis ≥ 2:
//     « Fantastique » is also plain fantasy, and one « scènes effrayantes »
//     flag is what Le Grinch carries — not enough to send a family-film
//     audience to the fear article;
//   - any other title needs the fear tone itself (axis ≥ 2 with the tone).
// Warnings only count above the fiche's own confidence gate
// (WARNINGS_MIN_CONFIDENCE), so the link never cites a fear the page hides.

const FRIGHT_GENRES = new Set(["horreur", "horror", "epouvante", "fantastique", "fantasy"])
const FEAR_WARNINGS = new Set(
  [
    "Scènes effrayantes ou angoissantes",
    "Images dérangeantes",
    "Suspense ou tension intense",
    "Clowns effrayants",
  ].map(fold),
)
export const FEAR_TONE = "Effrayant et angoissant"
export const FEAR_AXIS_MIN = 2

const FAMILY_GENRES = new Set(["animation", "familial", "famille", "family", "comedie", "comedy"])
/** « Soirée film en famille » up to this recommended age. */
export const FAMILY_MAX_AGE = 10

export interface FicheBlogCandidate {
  type: string
  title: string
  genres?: readonly string[] | null
  expertAgeRec?: number | null
  /** Empty when the content analysis is hidden (pre-release, provisional). */
  sensitiveWarnings?: readonly string[] | null
  enrichmentConfidence?: number | null
  toneTags?: readonly string[] | null
}

export function fearAxis(media: FicheBlogCandidate): number {
  const confident = (media.enrichmentConfidence ?? 0) >= WARNINGS_MIN_CONFIDENCE
  const warnings = confident
    ? new Set((media.sensitiveWarnings ?? []).map(fold).filter((w) => FEAR_WARNINGS.has(w))).size
    : 0
  return warnings + (hasFearTone(media) ? 2 : 0)
}

function hasFearTone(media: FicheBlogCandidate): boolean {
  return (media.toneTags ?? []).some((t) => fold(t) === fold(FEAR_TONE))
}

export function isFrightening(media: FicheBlogCandidate): boolean {
  // The fear tone alone puts the axis at 2.
  if (hasFearTone(media)) return true
  const frightGenre = (media.genres ?? []).some((g) => FRIGHT_GENRES.has(fold(g)))
  return frightGenre && fearAxis(media) >= FEAR_AXIS_MIN
}

export function isFamilyFilm(media: FicheBlogCandidate): boolean {
  const age = media.expertAgeRec
  if (typeof age !== "number" || age < 0 || age > FAMILY_MAX_AGE) return false
  return (media.genres ?? []).some((g) => FAMILY_GENRES.has(fold(g)))
}

export function isGtaTitle(title: string): boolean {
  return guideKeyForTitle(title) === "gta" || /grand theft auto/i.test(title)
}

/** Articles in preference order for this fiche, before live / duplicate gating. */
export function blogCandidatesForFiche(
  media: FicheBlogCandidate,
  opts: { month0: number; isGiftGame: boolean },
): BlogArticleSlug[] {
  if (media.type === "MOVIE" || media.type === "TV") {
    // The general age article is the fallback: on a film fiche it is usually
    // already the « Comment lire cet âge ? » link, and the dedupe drops it.
    if (isFrightening(media)) return ["films-qui-font-peur-enfant-pret", "bon-age-film-enfant"]
    if (isFamilyFilm(media)) return ["soiree-film-en-famille", "bon-age-film-enfant"]
    return ["bon-age-film-enfant"]
  }
  if (media.type === "GAME") {
    if (!isChristmasSeason(opts.month0)) return []
    const out: BlogArticleSlug[] = []
    if (isGtaTitle(media.title)) out.push("gta-6-sous-le-sapin")
    if (opts.isGiftGame) out.push("jeux-video-noel-selon-age")
    return out
  }
  return []
}

/**
 * The one « À lire aussi » article for a fiche, or null. Only a live article,
 * never one the page already links (`alreadyLinkedSlugs`, e.g. the
 * « Comment lire cet âge ? » link to AGE_GUIDE_POST_SLUG).
 */
export function blogLinkForFiche(
  media: FicheBlogCandidate,
  opts: {
    liveSlugs: readonly string[]
    month0: number
    isGiftGame: boolean
    alreadyLinkedSlugs?: readonly (string | null | undefined)[]
  },
): BlogArticleRef | null {
  const live = new Set(opts.liveSlugs)
  const taken = new Set((opts.alreadyLinkedSlugs ?? []).filter((s): s is string => !!s))
  const slug = blogCandidatesForFiche(media, opts).find((s) => live.has(s) && !taken.has(s))
  return slug ? BLOG_ARTICLES[slug] : null
}

/**
 * Live articles for the « Conseils pour les parents » strip: film articles on
 * /films, game articles on /jeux (Christmas ones in season only).
 */
export function blogArticlesForShelf(
  shelf: "films" | "jeux",
  opts: { liveSlugs: readonly string[]; month0: number },
): BlogArticleRef[] {
  const live = new Set(opts.liveSlugs)
  return Object.values(BLOG_ARTICLES).filter(
    (a) => a.shelf === shelf && live.has(a.slug) && (!a.christmas || isChristmasSeason(opts.month0)),
  )
}
