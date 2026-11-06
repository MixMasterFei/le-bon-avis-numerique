// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildPostDocument,
  checkBlogLinks,
  draftId,
  fmString,
  heroImageValue,
  internalBlogLinks,
  legacyIds,
  liveId,
  markdownToPortableText,
  parseFrontmatter,
  parsePublishDate,
  parisDay,
  resolvePublishDate,
  selectPosts,
  validateFrontmatter,
} from "../blog-import"

const BLOG_DIR = join(process.cwd(), "blog")
const draftFiles = readdirSync(BLOG_DIR).filter((f) => /^\d\d-.+\.md$/.test(f)).sort()
const readDraft = (prefix: string) => {
  const file = draftFiles.find((f) => f.startsWith(prefix))!
  return { file, ...parseFrontmatter(readFileSync(join(BLOG_DIR, file), "utf8")) }
}

// 6 Nov 2026, 13:00 in Paris (CET = UTC+1).
const NOW = new Date("2026-11-06T12:00:00Z")

describe("parseFrontmatter", () => {
  it("reads quoted scalars, unquoted scalars, block lists and empty lists", () => {
    const { fm, body } = parseFrontmatter(
      '---\r\ntitle: "Un titre avec \\"guillemets\\""\r\nslug: mon-slug\r\ninternalLinks:\r\n  - "/films"\r\n  - /jeux\r\nsourceLinks: []\r\n---\r\n\r\n# Titre\r\n\r\nTexte.\r\n',
    )
    expect(fm.title).toBe('Un titre avec "guillemets"')
    expect(fm.slug).toBe("mon-slug")
    expect(fm.internalLinks).toEqual(["/films", "/jeux"])
    expect(fm.sourceLinks).toEqual([])
    expect(body).toBe("# Titre\n\nTexte.\n")
  })

  it("refuses a file without frontmatter", () => {
    expect(() => parseFrontmatter("# Pas de frontmatter")).toThrow(/frontmatter/)
  })
})

describe("the drafts in blog/", () => {
  it("all parse and pass the Sanity schema limits; the file name matches the slug", () => {
    expect(draftFiles.length).toBeGreaterThanOrEqual(15)
    for (const file of draftFiles) {
      const { fm } = parseFrontmatter(readFileSync(join(BLOG_DIR, file), "utf8"))
      expect({ file, errors: validateFrontmatter(fm) }).toEqual({ file, errors: [] })
      expect(file.replace(/^\d\d-/, "").replace(/\.md$/, "")).toBe(fmString(fm, "slug"))
    }
  })

  it("every frontmatter publishedAt is a readable date", () => {
    for (const file of draftFiles) {
      const raw = fmString(readDraft(file.slice(0, 2)).fm, "publishedAt")
      if (raw) expect({ file, ok: parsePublishDate(raw) !== null }).toEqual({ file, ok: true })
    }
  })

  it("12 and 09 are dated 17 November (published together, they link to each other)", () => {
    expect(fmString(readDraft("12").fm, "publishedAt")).toBe("2026-11-17")
    expect(fmString(readDraft("09").fm, "publishedAt")).toBe("2026-11-17")
  })

  const plan17Nov = (now: Date) =>
    ["12", "09"].map((n) => {
      const { fm, body } = readDraft(n)
      const date = resolvePublishDate({ mode: "publish", now, allowPast: false, frontmatterDate: fmString(fm, "publishedAt") })
      if (!date.ok) throw new Error(date.error)
      return { slug: fmString(fm, "slug")!, publishedAt: date.publishedAt!, links: internalBlogLinks(body) }
    })

  it("12 + 09 can be scheduled ahead: both go live 17 Nov 08:00 Paris, links intact", () => {
    const posts = plan17Nov(NOW)
    expect(posts.map((p) => p.publishedAt)).toEqual(["2026-11-17T07:00:00.000Z", "2026-11-17T07:00:00.000Z"])
    expect(checkBlogLinks({ posts, existingLive: [] })).toEqual([])
  })

  it("12 + 09 published on the morning of 17 Nov are dated « now », never earlier", () => {
    const morning = new Date("2026-11-17T09:30:00Z") // 10:30 in Paris
    const posts = plan17Nov(morning)
    expect(posts.map((p) => p.publishedAt)).toEqual([morning.toISOString(), morning.toISOString()])
    expect(checkBlogLinks({ posts, existingLive: [] })).toEqual([])
  })

  it("12 published alone is refused: it links to 09", () => {
    const [twelve] = plan17Nov(NOW)
    expect(checkBlogLinks({ posts: [twelve], existingLive: [] })).toEqual([
      expect.stringContaining("/blog/films-qui-font-peur-enfant-pret, qui n'est pas publié"),
    ])
  })
})

describe("markdownToPortableText", () => {
  const body = [
    "# Le titre (ignoré)",
    "",
    "Premier paragraphe avec **gras**, *italique* et un [lien](/notre-methode).",
    "",
    "## Section",
    "",
    "- Puce **un**",
    "- Puce deux",
    "",
    "1. Étape",
    "",
    "### Sous-section",
    "",
    "> Citation",
    "",
    "Ligne coupée",
    "en deux.",
  ].join("\n")

  it("maps headings, lists, quotes and inline marks", () => {
    const blocks = markdownToPortableText(body)
    expect(blocks.map((b) => [b.style, b.listItem ?? null])).toEqual([
      ["normal", null],
      ["h2", null],
      ["normal", "bullet"],
      ["normal", "bullet"],
      ["normal", "number"],
      ["h3", null],
      ["blockquote", null],
      ["normal", null],
    ])
    const [first] = blocks
    expect(first.children.map((c) => [c.text, c.marks.length ? c.marks[0] : null])).toEqual([
      ["Premier paragraphe avec ", null],
      ["gras", "strong"],
      [", ", null],
      ["italique", "em"],
      [" et un ", null],
      ["lien", first.markDefs[0]._key],
      [".", null],
    ])
    expect(first.markDefs[0].href).toBe("/notre-methode")
    expect(blocks.at(-1)!.children[0].text).toBe("Ligne coupée en deux.")
  })

  it("produces deterministic keys that survive an inserted paragraph", () => {
    const a = markdownToPortableText(body)
    const b = markdownToPortableText(body)
    expect(b.map((x) => x._key)).toEqual(a.map((x) => x._key))
    const c = markdownToPortableText(body.replace("## Section", "Nouveau paragraphe.\n\n## Section"))
    expect(c.map((x) => x._key)).toEqual(expect.arrayContaining(a.map((x) => x._key)))
  })

  it("keeps keys unique when a paragraph repeats", () => {
    const keys = markdownToPortableText("Même texte.\n\nMême texte.").map((x) => x._key)
    expect(new Set(keys).size).toBe(2)
  })
})

describe("internalBlogLinks", () => {
  it("finds /blog/<slug> links only, deduped", () => {
    expect(
      internalBlogLinks("[a](/blog/un-article) [b](/blog/un-article#x) [c](/films) [d](https://x.fr/blog/autre) [e](/blog/deux/)"),
    ).toEqual(["un-article", "deux"])
  })
})

describe("validateFrontmatter", () => {
  const ok = {
    title: "Un titre suffisamment long",
    slug: "un-titre",
    category: "films-series",
    excerpt: "Un résumé qui dépasse sans peine les cinquante caractères requis.",
  }

  it("accepts a valid post", () => {
    expect(validateFrontmatter(ok)).toEqual([])
  })

  it("mirrors the schema: unknown category, short excerpt, long SEO fields", () => {
    const errors = validateFrontmatter({ ...ok, category: "films", excerpt: "Trop court.", seoTitle: "x".repeat(71), seoDescription: "y".repeat(161) })
    expect(errors.join("\n")).toMatch(/category « films » inconnue/)
    expect(errors.join("\n")).toMatch(/excerpt : 11 caractères/)
    expect(errors.join("\n")).toMatch(/seoTitle : 71/)
    expect(errors.join("\n")).toMatch(/seoDescription : 161/)
  })

  it("requires alt text with a hero image and keeps the path inside the repository", () => {
    expect(validateFrontmatter({ ...ok, heroImage: "blog/images/a.jpg" })).toEqual([expect.stringMatching(/heroAlt manquant/)])
    expect(validateFrontmatter({ ...ok, heroImage: "../secret.jpg", heroAlt: "Une famille" })[0]).toMatch(/chemin relatif/)
    expect(validateFrontmatter({ ...ok, heroImage: "blog/images/a.gif", heroAlt: "Une famille" })[0]).toMatch(/\.jpg/)
    expect(validateFrontmatter({ ...ok, heroImage: "blog/images/a.webp", heroAlt: "Une famille au salon" })).toEqual([])
  })

  it("accepts a short credit, only alongside a hero image", () => {
    const hero = { heroImage: "blog/images/a.png", heroAlt: "Une famille au salon" }
    expect(validateFrontmatter({ ...ok, ...hero, heroCredit: "Image générée par IA" })).toEqual([])
    expect(validateFrontmatter({ ...ok, heroCredit: "Image générée par IA" })).toEqual(["heroCredit sans heroImage"])
    expect(validateFrontmatter({ ...ok, ...hero, heroCredit: "x".repeat(121) })[0]).toMatch(/heroCredit : 121/)
  })
})

describe("heroImageValue", () => {
  it("references the uploaded asset with its alt text and optional credit", () => {
    expect(heroImageValue("image-abc-1536x1024-png", { heroAlt: "Une famille au salon", heroCredit: "Image générée par IA" })).toEqual({
      _type: "image",
      asset: { _type: "reference", _ref: "image-abc-1536x1024-png" },
      alt: "Une famille au salon",
      credit: "Image générée par IA",
    })
    expect(heroImageValue("image-abc-1536x1024-png", { heroAlt: "Une famille au salon" })).not.toHaveProperty("credit")
  })
})

describe("parsePublishDate", () => {
  it("reads a bare day as 08:00 in Paris, winter and summer", () => {
    expect(parsePublishDate("2026-11-17")?.toISOString()).toBe("2026-11-17T07:00:00.000Z")
    expect(parsePublishDate("2026-07-01")?.toISOString()).toBe("2026-07-01T06:00:00.000Z")
  })

  it("reads a Paris wall-clock time and full ISO timestamps", () => {
    expect(parsePublishDate("2026-11-17 09:30")?.toISOString()).toBe("2026-11-17T08:30:00.000Z")
    expect(parsePublishDate("2026-11-17T09:30")?.toISOString()).toBe("2026-11-17T08:30:00.000Z")
    expect(parsePublishDate("2026-11-17T09:30:00+01:00")?.toISOString()).toBe("2026-11-17T08:30:00.000Z")
    expect(parsePublishDate("2026-11-17T08:30:00Z")?.toISOString()).toBe("2026-11-17T08:30:00.000Z")
  })

  it("rejects impossible or ambiguous dates", () => {
    expect(parsePublishDate("2026-02-30")).toBeNull()
    expect(parsePublishDate("17/11/2026")).toBeNull()
    expect(parsePublishDate("2026-11-17 25:00")).toBeNull()
    expect(parsePublishDate("demain")).toBeNull()
  })

  it("computes the calendar day in Paris, not UTC", () => {
    expect(parisDay(new Date("2026-11-16T23:30:00Z"))).toBe("2026-11-17")
  })
})

describe("resolvePublishDate", () => {
  const base = { now: NOW, allowPast: false } as const

  it("takes the frontmatter date when it is in the future", () => {
    const r = resolvePublishDate({ ...base, mode: "publish", frontmatterDate: "2026-11-17" })
    expect(r).toMatchObject({ ok: true, publishedAt: "2026-11-17T07:00:00.000Z", source: "frontmatter" })
  })

  it("never back-dates by default: past day refused when publishing, dropped for a draft", () => {
    expect(resolvePublishDate({ ...base, mode: "publish", frontmatterDate: "2026-05-11" })).toMatchObject({ ok: false })
    const draft = resolvePublishDate({ ...base, mode: "draft", frontmatterDate: "2026-05-11" })
    expect(draft).toMatchObject({ ok: true, publishedAt: null })
  })

  it("an hour already gone today becomes now", () => {
    const r = resolvePublishDate({ ...base, mode: "publish", frontmatterDate: "2026-11-06" })
    expect(r).toMatchObject({ ok: true, publishedAt: NOW.toISOString() })
  })

  it("--date overrides the frontmatter, refuses the past, and --allow-past is the explicit escape hatch", () => {
    expect(resolvePublishDate({ ...base, mode: "publish", frontmatterDate: "2026-11-17", cliDate: "2026-11-24" })).toMatchObject({
      ok: true,
      publishedAt: "2026-11-24T07:00:00.000Z",
      source: "--date",
    })
    expect(resolvePublishDate({ ...base, mode: "draft", cliDate: "2026-11-01" })).toMatchObject({ ok: false })
    expect(resolvePublishDate({ ...base, mode: "publish", cliDate: "2026-11-01", allowPast: true })).toMatchObject({
      ok: true,
      publishedAt: "2026-11-01T07:00:00.000Z",
    })
    expect(resolvePublishDate({ ...base, mode: "publish", cliDate: "bientôt" })).toMatchObject({ ok: false })
  })

  it("a post already visible keeps its date when re-published", () => {
    const r = resolvePublishDate({ ...base, mode: "publish", liveDate: "2026-10-01T07:00:00.000Z", frontmatterDate: "2026-11-17" })
    expect(r).toMatchObject({ ok: true, publishedAt: "2026-10-01T07:00:00.000Z", source: "sanity (publié)" })
    if (r.ok) expect(r.notes.join(" ")).toMatch(/date conservée/)
  })

  it("a scheduled (future) live post follows a new frontmatter date", () => {
    const r = resolvePublishDate({ ...base, mode: "publish", liveDate: "2026-11-20T07:00:00.000Z", frontmatterDate: "2026-11-17" })
    expect(r).toMatchObject({ ok: true, publishedAt: "2026-11-17T07:00:00.000Z" })
  })

  it("ignores a past date left on a Sanity draft by an old import", () => {
    expect(resolvePublishDate({ ...base, mode: "draft", draftDate: "2026-05-11T07:00:00.000Z" })).toMatchObject({ ok: true, publishedAt: null })
    expect(resolvePublishDate({ ...base, mode: "publish", draftDate: "2026-05-11T07:00:00.000Z" })).toMatchObject({ ok: false })
    expect(resolvePublishDate({ ...base, mode: "publish", draftDate: "2026-11-24T07:00:00.000Z" })).toMatchObject({
      ok: true,
      publishedAt: "2026-11-24T07:00:00.000Z",
      source: "sanity (brouillon)",
    })
  })

  it("refuses to publish without any date", () => {
    expect(resolvePublishDate({ ...base, mode: "publish" })).toMatchObject({ ok: false })
    expect(resolvePublishDate({ ...base, mode: "draft" })).toMatchObject({ ok: true, publishedAt: null, source: "aucune" })
  })
})

describe("selectPosts", () => {
  const posts = draftFiles.map((file) => ({ file, slug: file.replace(/^\d\d-/, "").replace(/\.md$/, "") }))

  it("selects by number (padded or not), slug or file name", () => {
    expect(selectPosts(posts, ["12,09"]).selected.map((p) => p.file.slice(0, 2))).toEqual(["09", "12"])
    expect(selectPosts(posts, ["9"]).selected.map((p) => p.file.slice(0, 2))).toEqual(["09"])
    expect(selectPosts(posts, ["bon-age-film-enfant", "14-soiree-film-en-famille.md"]).selected.map((p) => p.file.slice(0, 2))).toEqual(["12", "14"])
  })

  it("reports unknown tokens", () => {
    expect(selectPosts(posts, ["12 99 inconnu"]).unknown).toEqual(["99", "inconnu"])
  })
})

describe("checkBlogLinks", () => {
  it("accepts a target already live before the post, refuses one scheduled after it", () => {
    const post = { slug: "a", publishedAt: "2026-11-17T07:00:00.000Z", links: ["b"] }
    expect(checkBlogLinks({ posts: [post], existingLive: [{ slug: "b", publishedAt: "2026-11-10T07:00:00.000Z" }] })).toEqual([])
    expect(checkBlogLinks({ posts: [post], existingLive: [{ slug: "b", publishedAt: "2026-11-24T07:00:00.000Z" }] })[0]).toMatch(/publié plus tard/)
  })
})

describe("buildPostDocument", () => {
  const { fm, body } = readDraft("12")

  it("builds the draft and live documents with the importer's ids", () => {
    expect(liveId("x")).toBe("post-x")
    expect(draftId("x")).toBe("drafts.post-x")
    expect(legacyIds("x")).toEqual(["blog-x", "drafts.blog-x"])
    const doc = buildPostDocument({ id: draftId("bon-age-film-enfant"), fm, body, publishedAt: null })
    expect(doc).toMatchObject({
      _id: "drafts.post-bon-age-film-enfant",
      _type: "post",
      slug: { _type: "slug", current: "bon-age-film-enfant" },
      author: "Totem Avisé",
      category: "films-series",
      seoTitle: "À quel âge voir un film ? Comprendre les repères",
    })
    expect(doc).not.toHaveProperty("publishedAt")
    expect(doc).not.toHaveProperty("mainImage")
    expect(doc.body[0].style).toBe("normal") // the « # Titre » line is not repeated
  })

  it("carries the date and the image when given", () => {
    const image = { _type: "image" as const, asset: { _type: "reference" as const, _ref: "image-abc-1200x630-jpg" }, alt: "Une famille" }
    const doc = buildPostDocument({ id: liveId("bon-age-film-enfant"), fm, body, publishedAt: "2026-11-17T07:00:00.000Z", mainImage: image })
    expect(doc.publishedAt).toBe("2026-11-17T07:00:00.000Z")
    expect(doc.mainImage).toEqual(image)
  })
})
