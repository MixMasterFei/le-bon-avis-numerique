// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"

// published-blog reads the CMS; only its slug constant is used here.
vi.mock("@/sanity/client", () => ({ sanityClient: { fetch: vi.fn() } }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }))
import {
  BLOG_ARTICLES,
  blogArticlesForShelf,
  blogLinkForFiche,
  blogSlugFromHref,
  fearAxis,
  isFrightening,
  type BlogArticleSlug,
  type FicheBlogCandidate,
} from "../blog-links"
import { AGE_GUIDE_POST_SLUG } from "../published-blog"
import { fmString, parseFrontmatter } from "../blog-import"

const NOVEMBER = 10
const DECEMBER = 11
const JANUARY = 0

const ALL_LIVE = Object.keys(BLOG_ARTICLES)
// The state on 27 Nov 2026: the two Christmas articles are scheduled (1 and 4 Dec).
const LIVE_NOV_27 = ["bon-age-film-enfant", "films-qui-font-peur-enfant-pret", "soiree-film-en-famille"]

const pick = (
  media: FicheBlogCandidate,
  opts: Partial<{ liveSlugs: string[]; month0: number; isGiftGame: boolean; alreadyLinkedSlugs: (string | null)[] }> = {},
) =>
  blogLinkForFiche(media, {
    liveSlugs: opts.liveSlugs ?? ALL_LIVE,
    month0: opts.month0 ?? DECEMBER,
    isGiftGame: opts.isGiftGame ?? false,
    alreadyLinkedSlugs: opts.alreadyLinkedSlugs,
  })?.slug ?? null

// Fixtures shaped on the catalogue (27 Nov 2026): ages and warnings as the
// fiches show them; confidence 1 like their analysis.
const horrorFilm: FicheBlogCandidate = {
  type: "MOVIE",
  title: "Conjuring : Les dossiers Warren",
  genres: ["Horreur", "Thriller"],
  expertAgeRec: 16,
  sensitiveWarnings: ["Scènes effrayantes ou angoissantes", "Images dérangeantes", "Violence"],
  enrichmentConfidence: 1,
}
const beetlejuice: FicheBlogCandidate = {
  type: "MOVIE",
  title: "Beetlejuice",
  genres: ["Fantastique", "Comédie"],
  expertAgeRec: 10,
  sensitiveWarnings: ["Scènes effrayantes ou angoissantes", "Thèmes de mort ou de deuil", "Images dérangeantes", "Violence"],
  enrichmentConfidence: 1,
}
const grinch: FicheBlogCandidate = {
  type: "MOVIE",
  title: "Le Grinch",
  genres: ["Animation", "Familial", "Comédie", "Fantastique"],
  expertAgeRec: 6,
  sensitiveWarnings: ["Scènes effrayantes ou angoissantes", "Détresse émotionnelle", "Comportements à risque imités"],
  enrichmentConfidence: 1,
}
const adultDrama: FicheBlogCandidate = {
  type: "MOVIE",
  title: "Seven",
  genres: ["Crime", "Mystère", "Thriller"],
  expertAgeRec: 16,
  sensitiveWarnings: ["Violence intense ou graphique", "Scènes effrayantes ou angoissantes", "Suspense ou tension intense"],
  enrichmentConfidence: 1,
}
const gtaVI: FicheBlogCandidate = { type: "GAME", title: "Grand Theft Auto VI", genres: ["Aventure"], expertAgeRec: 18 }
const marioOdyssey: FicheBlogCandidate = { type: "GAME", title: "Super Mario Odyssey", genres: ["Plateforme"], expertAgeRec: 7 }

describe("BLOG_ARTICLES — titles match the articles", () => {
  const dir = path.join(process.cwd(), "blog")
  const bySlug = new Map<string, string>()
  for (const file of readdirSync(dir).filter((f) => /^\d{2}-.*\.md$/.test(f))) {
    const { fm } = parseFrontmatter(readFileSync(path.join(dir, file), "utf8"))
    const slug = fmString(fm, "slug")
    const title = fmString(fm, "title")
    if (slug && title) bySlug.set(slug, title)
  }

  it.each(Object.values(BLOG_ARTICLES))("$slug carries the frontmatter title", (a) => {
    expect(bySlug.get(a.slug)).toBe(a.title)
  })

  it("keeps every teaser to one short line", () => {
    for (const a of Object.values(BLOG_ARTICLES)) {
      expect(a.teaser.length).toBeLessThanOrEqual(130)
      expect(a.teaser).not.toMatch(/\n|meilleur|incontournable|indispensable|ultime/i)
    }
  })
})

describe("blogLinkForFiche — films and series", () => {
  it("sends a horror film to the fear article", () => {
    expect(pick(horrorFilm)).toBe("films-qui-font-peur-enfant-pret")
  })

  it("sends a « Fantastique » title with two fear signals to the fear article (Beetlejuice)", () => {
    expect(fearAxis(beetlejuice)).toBe(2)
    expect(pick(beetlejuice)).toBe("films-qui-font-peur-enfant-pret")
  })

  it("sends family animation to the family-evening article, even with one « scènes effrayantes » flag (Le Grinch)", () => {
    expect(isFrightening(grinch)).toBe(false)
    expect(pick(grinch)).toBe("soiree-film-en-famille")
  })

  it("counts the fear tone of the analysis on its own", () => {
    const tense = { ...adultDrama, toneTags: ["Effrayant et angoissant"] }
    expect(isFrightening(adultDrama)).toBe(false)
    expect(isFrightening(tense)).toBe(true)
  })

  it("ignores warnings below the fiche's confidence gate", () => {
    expect(isFrightening({ ...horrorFilm, enrichmentConfidence: 0.4 })).toBe(false)
    expect(isFrightening({ ...horrorFilm, enrichmentConfidence: null })).toBe(false)
  })

  it("needs a recommended age for the family article: no age, no family pick", () => {
    expect(pick({ ...grinch, expertAgeRec: null, sensitiveWarnings: [] }, { alreadyLinkedSlugs: [] })).toBe("bon-age-film-enfant")
    expect(pick({ ...grinch, expertAgeRec: 12 })).toBe("bon-age-film-enfant")
    expect(pick({ ...grinch, expertAgeRec: 0 })).toBe("soiree-film-en-famille")
  })

  it("gives an adult drama the age article, unless the age-guide link already points there", () => {
    expect(pick(adultDrama)).toBe("bon-age-film-enfant")
    expect(pick(adultDrama, { alreadyLinkedSlugs: [AGE_GUIDE_POST_SLUG] })).toBeNull()
  })

  it("never repeats the age-guide article on a page — a frightening or family film falls back to nothing else", () => {
    const linked = { alreadyLinkedSlugs: [blogSlugFromHref(`/blog/${AGE_GUIDE_POST_SLUG}`)] }
    expect(pick(horrorFilm, linked)).toBe("films-qui-font-peur-enfant-pret")
    expect(pick(horrorFilm, { ...linked, liveSlugs: ["bon-age-film-enfant"] })).toBeNull()
    expect(pick(grinch, { ...linked, liveSlugs: ["bon-age-film-enfant"] })).toBeNull()
  })

  it("falls back to the age article on a series when the preferred one is not live", () => {
    const series = { ...grinch, type: "TV" }
    expect(pick(series)).toBe("soiree-film-en-famille")
    expect(pick(series, { liveSlugs: ["bon-age-film-enfant"] })).toBe("bon-age-film-enfant")
  })

  it("links nothing on books and manga", () => {
    expect(pick({ type: "BOOK", title: "Le Petit Prince", genres: ["Familial"], expertAgeRec: 6 })).toBeNull()
  })
})

describe("blogLinkForFiche — games", () => {
  it("sends GTA VI to the GTA article in season, once it is live", () => {
    expect(pick(gtaVI, { month0: DECEMBER })).toBe("gta-6-sous-le-sapin")
    expect(pick(gtaVI, { month0: NOVEMBER, liveSlugs: LIVE_NOV_27 })).toBeNull()
    expect(pick(gtaVI, { month0: JANUARY })).toBeNull()
  })

  it("matches every GTA title, not only VI", () => {
    expect(pick({ ...gtaVI, title: "Grand Theft Auto: The Trilogy" })).toBe("gta-6-sous-le-sapin")
  })

  it("sends a gift-list game to the Christmas article, in season and once live", () => {
    expect(pick(marioOdyssey, { isGiftGame: true, month0: DECEMBER })).toBe("jeux-video-noel-selon-age")
    expect(pick(marioOdyssey, { isGiftGame: true, month0: NOVEMBER, liveSlugs: LIVE_NOV_27 })).toBeNull()
    expect(pick(marioOdyssey, { isGiftGame: true, month0: JANUARY })).toBeNull()
  })

  it("links nothing on a game off the gift list", () => {
    expect(pick(marioOdyssey, { isGiftGame: false, month0: DECEMBER })).toBeNull()
  })

  it("never sends a game to a film article", () => {
    expect(pick({ ...marioOdyssey, genres: ["Familial"] }, { isGiftGame: false })).toBeNull()
  })
})

describe("live-slug gating", () => {
  it("returns only live articles: nothing when the CMS answered nothing", () => {
    for (const media of [horrorFilm, beetlejuice, grinch, adultDrama, gtaVI]) {
      expect(pick(media, { liveSlugs: [], isGiftGame: true })).toBeNull()
    }
  })

  it("the strips list only live articles of their shelf", () => {
    const slugs = (shelf: "films" | "jeux", liveSlugs: string[], month0: number) =>
      blogArticlesForShelf(shelf, { liveSlugs, month0 }).map((a) => a.slug)

    expect(slugs("films", LIVE_NOV_27, NOVEMBER)).toEqual(LIVE_NOV_27)
    expect(slugs("films", ["bon-age-film-enfant", "gta-6-sous-le-sapin"], DECEMBER)).toEqual(["bon-age-film-enfant"])
    // Games: nothing before 1 Dec, then the live ones — in season only.
    expect(slugs("jeux", LIVE_NOV_27, NOVEMBER)).toEqual([])
    expect(slugs("jeux", ALL_LIVE, DECEMBER)).toEqual(["jeux-video-noel-selon-age", "gta-6-sous-le-sapin"])
    expect(slugs("jeux", ALL_LIVE, JANUARY)).toEqual([])
  })
})

describe("blogSlugFromHref", () => {
  it("reads a blog href and nothing else", () => {
    expect(blogSlugFromHref("/blog/bon-age-film-enfant")).toBe("bon-age-film-enfant")
    expect(blogSlugFromHref("/noel/jeux-video-a-offrir")).toBeNull()
    expect(blogSlugFromHref(null)).toBeNull()
  })

  it("the age-guide slug is one of the mapped articles", () => {
    expect(Object.keys(BLOG_ARTICLES)).toContain(AGE_GUIDE_POST_SLUG as BlogArticleSlug)
  })
})
