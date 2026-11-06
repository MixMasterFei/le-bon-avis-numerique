/**
 * Pure logic behind `scripts/publish-blog.ts` — the ONLY importer from the
 * `blog/NN-*.md` drafts to Sanity. No fs and no network in this file, so all
 * of it is unit-tested (src/lib/__tests__/blog-import.test.ts).
 *
 * Document ids — live: `post-<slug>`, draft: `drafts.post-<slug>`. A second
 * importer (removed) wrote `blog-<slug>` / `drafts.blog-<slug>`: those ids are
 * reported as duplicates so they can never go live next to the real post.
 *
 * Dates — a post's publication date is explicit (frontmatter `publishedAt` or
 * the `--date` flag) and never in the past unless `--allow-past` is passed.
 * Nothing is staggered or computed: the old scripts back-dated whole batches.
 *
 * Relative imports on purpose: this module is loaded by `npx tsx` from
 * scripts/, outside the Next.js resolver.
 */
import { BLOG_CATEGORIES, isBlogCategory } from "../sanity/categories"

// ── Frontmatter ──────────────────────────────────────────────────────────

export type FrontmatterValue = string | string[]
export type Frontmatter = Record<string, FrontmatterValue>

function unquote(raw: string): string {
  const v = raw.trim()
  const dq = v.match(/^"([\s\S]*)"$/)
  if (dq) return dq[1].replace(/\\"/g, '"')
  const sq = v.match(/^'([\s\S]*)'$/)
  if (sq) return sq[1].replace(/''/g, "'")
  return v
}

/**
 * Reads the small YAML subset the drafts use: `key: "value"`, `key: value`,
 * `key: []` and block lists (`key:` followed by `  - "item"` lines).
 */
export function parseFrontmatter(md: string): { fm: Frontmatter; body: string } {
  const text = md.replace(/\r\n?/g, "\n")
  const match = text.match(/^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/)
  if (!match) throw new Error("frontmatter manquant (le fichier doit commencer par ---)")
  const fm: Frontmatter = {}
  let list: string[] | null = null
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item && list) {
      list.push(unquote(item[1]))
      continue
    }
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (!kv) continue
    const [, key, rawValue] = kv
    if (rawValue.trim() === "") {
      list = []
      fm[key] = list
    } else if (rawValue.trim() === "[]") {
      list = null
      fm[key] = []
    } else {
      list = null
      fm[key] = unquote(rawValue)
    }
  }
  return { fm, body: text.slice(match[0].length).replace(/^\s*\n/, "") }
}

/** A scalar frontmatter field, trimmed; lists and blanks read as undefined. */
export function fmString(fm: Frontmatter, key: string): string | undefined {
  const v = fm[key]
  if (typeof v !== "string") return undefined
  const t = v.trim()
  return t === "" ? undefined : t
}

// ── Markdown → Portable Text ─────────────────────────────────────────────

export interface PtSpan {
  _type: "span"
  _key: string
  text: string
  marks: string[]
}
export interface PtLinkDef {
  _type: "link"
  _key: string
  href: string
}
export interface PtBlock {
  _type: "block"
  _key: string
  style: "normal" | "h2" | "h3" | "h4" | "blockquote"
  markDefs: PtLinkDef[]
  children: PtSpan[]
  listItem?: "bullet" | "number"
  level?: number
}

/** FNV-1a — deterministic keys, so re-importing an unchanged paragraph keeps its _key. */
function hash36(seed: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*/g

function parseInline(text: string, blockKey: string): Pick<PtBlock, "children" | "markDefs"> {
  const children: PtSpan[] = []
  const markDefs: PtLinkDef[] = []
  const push = (t: string, marks: string[] = []) => {
    if (t) children.push({ _type: "span", _key: `${blockKey}s${children.length}`, text: t, marks })
  }
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const index = m.index ?? 0
    push(text.slice(last, index))
    if (m[1] !== undefined) {
      const linkKey = `${blockKey}l${markDefs.length}`
      markDefs.push({ _type: "link", _key: linkKey, href: m[2] })
      push(m[1], [linkKey])
    } else if (m[3] !== undefined) {
      push(m[3], ["strong"])
    } else if (m[4] !== undefined) {
      push(m[4], ["em"])
    }
    last = index + m[0].length
  }
  push(text.slice(last))
  if (children.length === 0) children.push({ _type: "span", _key: `${blockKey}s0`, text: "", marks: [] })
  return { children, markDefs }
}

/**
 * Converts a draft body to Portable Text. Supported: `##`–`####` headings,
 * `-` / `*` bullets, `1.` numbered items, `>` quotes, **bold**, *italic* and
 * [links](url). Consecutive plain lines form one paragraph; the `# Title` line
 * is skipped (the title is its own field).
 */
export function markdownToPortableText(body: string): PtBlock[] {
  const blocks: PtBlock[] = []
  const seen = new Map<string, number>()
  const add = (style: PtBlock["style"], text: string, listItem?: PtBlock["listItem"]) => {
    const seed = `${style}|${listItem ?? ""}|${text}`
    const n = seen.get(seed) ?? 0
    seen.set(seed, n + 1)
    const key = `k${hash36(seed)}${n ? `x${n}` : ""}`
    const block: PtBlock = { _type: "block", _key: key, style, ...parseInline(text, key) }
    if (listItem) {
      block.listItem = listItem
      block.level = 1
    }
    blocks.push(block)
  }

  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) add("normal", paragraph.join(" "))
    paragraph = []
  }

  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (/^#\s/.test(line)) {
      flush()
      continue
    }
    const heading = line.match(/^(#{2,4})\s+(.+)$/)
    const bullet = line.match(/^[-*+]\s+(.+)$/)
    const numbered = line.match(/^\d+[.)]\s+(.+)$/)
    const quote = line.match(/^>\s?(.+)$/)
    if (heading) {
      flush()
      add(heading[1].length === 2 ? "h2" : heading[1].length === 3 ? "h3" : "h4", heading[2])
    } else if (bullet) {
      flush()
      add("normal", bullet[1], "bullet")
    } else if (numbered) {
      flush()
      add("normal", numbered[1], "number")
    } else if (quote) {
      flush()
      add("blockquote", quote[1])
    } else {
      paragraph.push(line)
    }
  }
  flush()
  return blocks
}

/** Slugs of the other blog posts a draft links to (`/blog/<slug>`), deduped. */
export function internalBlogLinks(body: string): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(/\]\(\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?(?:[?#][^)]*)?\)/g)) out.add(m[1])
  return [...out]
}

// ── Validation (mirrors src/sanity/schemas/post.ts) ──────────────────────

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HERO_EXTENSIONS = /\.(jpe?g|png|webp)$/i

/** Same limits as the Sanity schema: the API write bypasses Studio validation. */
export function validateFrontmatter(fm: Frontmatter): string[] {
  const errors: string[] = []
  const title = fmString(fm, "title")
  const slug = fmString(fm, "slug")
  const category = fmString(fm, "category")
  const excerpt = fmString(fm, "excerpt")
  const seoTitle = fmString(fm, "seoTitle")
  const seoDescription = fmString(fm, "seoDescription")
  const heroImage = fmString(fm, "heroImage")
  const heroAlt = fmString(fm, "heroAlt")
  const heroCredit = fmString(fm, "heroCredit")

  if (!title) errors.push("title manquant")
  else if (title.length < 10 || title.length > 120) errors.push(`title : ${title.length} caractères (10 à 120)`)
  if (!slug) errors.push("slug manquant")
  else if (!SLUG_PATTERN.test(slug) || slug.length > 96) errors.push(`slug invalide « ${slug} » (minuscules, chiffres et tirets, 96 max)`)
  if (!category) errors.push("category manquante")
  else if (!isBlogCategory(category))
    errors.push(`category « ${category} » inconnue (valeurs : ${BLOG_CATEGORIES.map((c) => c.value).join(", ")})`)
  if (!excerpt) errors.push("excerpt manquant")
  else if (excerpt.length < 50 || excerpt.length > 300) errors.push(`excerpt : ${excerpt.length} caractères (50 à 300)`)
  if (seoTitle && seoTitle.length > 70) errors.push(`seoTitle : ${seoTitle.length} caractères (70 max)`)
  if (seoDescription && seoDescription.length > 160) errors.push(`seoDescription : ${seoDescription.length} caractères (160 max)`)
  if (heroImage) {
    if (heroImage.startsWith("/") || heroImage.split(/[\\/]/).includes("..") || /^[a-z]+:/i.test(heroImage))
      errors.push(`heroImage doit être un chemin relatif au dépôt, sans « .. » (reçu « ${heroImage} »)`)
    else if (!HERO_EXTENSIONS.test(heroImage)) errors.push("heroImage doit être un fichier .jpg, .jpeg, .png ou .webp")
    if (!heroAlt) errors.push("heroAlt manquant : le texte alternatif est obligatoire avec heroImage")
    else if (heroAlt.length > 200) errors.push(`heroAlt : ${heroAlt.length} caractères (200 max)`)
  }
  if (heroCredit && !heroImage) errors.push("heroCredit sans heroImage")
  if (heroCredit && heroCredit.length > 120) errors.push(`heroCredit : ${heroCredit.length} caractères (120 max)`)
  return errors
}

/** mainImage value for an uploaded hero (alt required by the schema, credit optional). */
export function heroImageValue(assetId: string, fm: Frontmatter): SanityImageValue {
  const credit = fmString(fm, "heroCredit")
  return {
    _type: "image",
    asset: { _type: "reference", _ref: assetId },
    alt: fmString(fm, "heroAlt"),
    ...(credit ? { credit } : {}),
  }
}

// ── Dates (Europe/Paris) ─────────────────────────────────────────────────

const PARIS = "Europe/Paris"
/** A date-only `publishedAt` ("2026-11-17") means 08:00 in Paris that day. */
export const DEFAULT_PUBLISH_HOUR = 8

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARIS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const wallFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PARIS,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

/** Calendar day (YYYY-MM-DD) of an instant, in Paris. */
export function parisDay(at: Date): string {
  return dayFormatter.format(at)
}

/** "17/11/2026 08:00" — for the importer's console output. */
export function formatParis(at: Date): string {
  const p = Object.fromEntries(wallFormatter.formatToParts(at).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

function parisOffsetMinutes(at: Date): number {
  const p = Object.fromEntries(wallFormatter.formatToParts(at).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((asUtc - at.getTime()) / 60000)
}

function parisWallClock(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const first = guess - parisOffsetMinutes(new Date(guess)) * 60000
  // One refinement step handles the DST switch between the guess and the answer.
  return new Date(guess - parisOffsetMinutes(new Date(first)) * 60000)
}

function isRealDay(y: number, mo: number, d: number): boolean {
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

/**
 * Accepts "2026-11-17" (→ 08:00 Paris), "2026-11-17 09:30" / "2026-11-17T09:30"
 * (Paris wall clock) or a full ISO timestamp with Z / offset.
 */
export function parsePublishDate(raw: string): Date | null {
  const v = raw.trim()
  const local = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/)
  if (local) {
    const [y, mo, d] = [+local[1], +local[2], +local[3]]
    if (!isRealDay(y, mo, d)) return null
    const h = local[4] === undefined ? DEFAULT_PUBLISH_HOUR : +local[4]
    const mi = local[5] === undefined ? 0 : +local[5]
    if (h > 23 || mi > 59) return null
    return parisWallClock(y, mo, d, h, mi)
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) {
    const t = new Date(v)
    return Number.isNaN(t.getTime()) ? null : t
  }
  return null
}

export type DateSource = "--date" | "frontmatter" | "sanity (publié)" | "sanity (brouillon)" | "aucune"

export interface DateResolutionInput {
  mode: "draft" | "publish"
  now: Date
  allowPast: boolean
  /** `--date` flag (explicit, applies to the selected posts). */
  cliDate?: string
  /** `publishedAt` in the .md frontmatter. */
  frontmatterDate?: string
  /** publishedAt of the live document `post-<slug>`, when it exists. */
  liveDate?: string
  /** publishedAt of the draft `drafts.post-<slug>`, when it exists (set in Studio or by a previous run). */
  draftDate?: string
}

export type DateResolution =
  | { ok: true; publishedAt: string | null; source: DateSource; notes: string[] }
  | { ok: false; error: string }

/**
 * Decides the `publishedAt` written by the importer.
 *
 * 1. A post that is already visible keeps its date (it is history) unless
 *    `--date` overrides it.
 * 2. Otherwise: `--date` › frontmatter › a date already set on the draft.
 * 3. A new date is never in the past: an earlier day is refused (publish) or
 *    dropped (draft — Studio then requires a date before publishing) unless
 *    `--allow-past`; an hour already gone today becomes "now".
 * 4. Publishing without any date is refused. Nothing is ever computed.
 */
export function resolvePublishDate(input: DateResolutionInput): DateResolution {
  const { mode, now, allowPast } = input
  const today = parisDay(now)
  const notes: string[] = []

  const parseExisting = (raw?: string) => {
    if (!raw) return null
    const t = new Date(raw)
    return Number.isNaN(t.getTime()) ? null : t
  }
  const live = parseExisting(input.liveDate)
  const draft = parseExisting(input.draftDate)
  const fromFrontmatter = input.frontmatterDate ? parsePublishDate(input.frontmatterDate) : null
  if (input.frontmatterDate && !fromFrontmatter)
    return { ok: false, error: `publishedAt « ${input.frontmatterDate} » illisible (attendu : AAAA-MM-JJ, AAAA-MM-JJ HH:MM ou ISO)` }

  /** Applies rule 3 to a candidate date. */
  const normalizeNew = (date: Date, source: DateSource, strict: boolean): DateResolution => {
    if (parisDay(date) < today) {
      if (allowPast) {
        notes.push(`date passée acceptée (--allow-past) : ${formatParis(date)}`)
        return { ok: true, publishedAt: date.toISOString(), source, notes }
      }
      const message = `${source} ${formatParis(date)} est dans le passé — choisissez une date à partir d'aujourd'hui, ou --allow-past pour antidater volontairement`
      if (strict || mode === "publish") return { ok: false, error: message }
      notes.push(`${message}. Brouillon importé sans date.`)
      return { ok: true, publishedAt: null, source: "aucune", notes }
    }
    if (date.getTime() < now.getTime()) {
      notes.push(`heure déjà passée aujourd'hui : publication datée de maintenant`)
      return { ok: true, publishedAt: now.toISOString(), source, notes }
    }
    return { ok: true, publishedAt: date.toISOString(), source, notes }
  }

  if (input.cliDate) {
    const date = parsePublishDate(input.cliDate)
    if (!date) return { ok: false, error: `--date « ${input.cliDate} » illisible (attendu : AAAA-MM-JJ, AAAA-MM-JJ HH:MM ou ISO)` }
    return normalizeNew(date, "--date", true)
  }

  if (live && live.getTime() <= now.getTime()) {
    if (fromFrontmatter && parisDay(fromFrontmatter) !== parisDay(live))
      notes.push(`déjà publié le ${formatParis(live)} : date conservée (frontmatter ${formatParis(fromFrontmatter)} ignoré ; --date pour la changer)`)
    return { ok: true, publishedAt: live.toISOString(), source: "sanity (publié)", notes }
  }

  if (fromFrontmatter) {
    if (draft && parisDay(draft) !== parisDay(fromFrontmatter))
      notes.push(`la date du brouillon Sanity (${formatParis(draft)}) est remplacée par celle du frontmatter`)
    return normalizeNew(fromFrontmatter, "frontmatter", false)
  }

  if (live) {
    // Scheduled in Sanity (future date), no newer instruction: keep the schedule.
    return { ok: true, publishedAt: live.toISOString(), source: "sanity (publié)", notes }
  }

  if (draft) {
    if (parisDay(draft) < today && !allowPast) {
      notes.push(`date passée du brouillon Sanity ignorée (${formatParis(draft)}) — sans doute calculée par un ancien import`)
    } else {
      return normalizeNew(draft, "sanity (brouillon)", false)
    }
  }

  if (mode === "publish")
    return { ok: false, error: "aucune date de publication : ajoutez publishedAt au frontmatter ou passez --date AAAA-MM-JJ" }
  return { ok: true, publishedAt: null, source: "aucune", notes }
}

// ── Selection ────────────────────────────────────────────────────────────

/**
 * `--only 12,09` / `--only 12 --only bon-age-film-enfant`: numbers match the
 * NN- prefix, other tokens match the slug or the file name.
 */
export function selectPosts<T extends { file: string; slug?: string }>(
  posts: T[],
  tokens: string[],
): { selected: T[]; unknown: string[] } {
  const wanted = tokens.flatMap((t) => t.split(/[,\s]+/)).map((t) => t.trim()).filter(Boolean)
  const selected = new Set<T>()
  const unknown: string[] = []
  for (const token of wanted) {
    const number = /^\d{1,2}$/.test(token) ? token.padStart(2, "0") : null
    const hits = posts.filter((p) =>
      number
        ? p.file.startsWith(`${number}-`)
        : p.slug === token || p.file === token || p.file.replace(/\.md$/, "") === token || p.file.replace(/^\d\d-/, "").replace(/\.md$/, "") === token,
    )
    if (hits.length === 0) unknown.push(token)
    for (const h of hits) selected.add(h)
  }
  return { selected: posts.filter((p) => selected.has(p)), unknown }
}

// ── Sanity documents ─────────────────────────────────────────────────────

export const liveId = (slug: string) => `post-${slug}`
export const draftId = (slug: string) => `drafts.post-${slug}`
/** Ids written by the removed `import-blog-drafts.mjs`. */
export const legacyIds = (slug: string) => [`blog-${slug}`, `drafts.blog-${slug}`]

export interface SanityImageValue {
  _type?: "image"
  asset?: { _type?: "reference"; _ref?: string }
  alt?: string
  [extra: string]: unknown
}

export interface PostDocument {
  _id: string
  _type: "post"
  title: string
  slug: { _type: "slug"; current: string }
  author: string
  publishedAt?: string
  category: string
  excerpt: string
  seoTitle?: string
  seoDescription?: string
  mainImage?: SanityImageValue
  body: PtBlock[]
}

/** Assumes `validateFrontmatter(fm)` returned no error. */
export function buildPostDocument(args: {
  id: string
  fm: Frontmatter
  body: string
  publishedAt: string | null
  mainImage?: SanityImageValue | null
}): PostDocument {
  const { fm } = args
  const seoTitle = fmString(fm, "seoTitle")
  const seoDescription = fmString(fm, "seoDescription")
  return {
    _id: args.id,
    _type: "post",
    title: fmString(fm, "title") ?? "",
    slug: { _type: "slug", current: fmString(fm, "slug") ?? "" },
    author: fmString(fm, "author") ?? "Totem Avisé",
    ...(args.publishedAt ? { publishedAt: args.publishedAt } : {}),
    category: fmString(fm, "category") ?? "",
    excerpt: fmString(fm, "excerpt") ?? "",
    ...(seoTitle ? { seoTitle } : {}),
    ...(seoDescription ? { seoDescription } : {}),
    ...(args.mainImage ? { mainImage: args.mainImage } : {}),
    body: markdownToPortableText(args.body),
  }
}

/**
 * Links between posts of a publication: a post may only link to a post that is
 * already live, or goes live in the same run no later than itself — otherwise
 * the link 404s for readers (the editorial plan publishes 12 and 09 together
 * for exactly this reason).
 */
export function checkBlogLinks(args: {
  posts: { slug: string; publishedAt: string; links: string[] }[]
  /** Visible-or-scheduled live documents already in Sanity, by slug. */
  existingLive: { slug: string; publishedAt?: string }[]
}): string[] {
  const errors: string[] = []
  const batch = new Map(args.posts.map((p) => [p.slug, p.publishedAt]))
  for (const post of args.posts) {
    const at = new Date(post.publishedAt).getTime()
    for (const target of post.links) {
      if (target === post.slug) continue
      const inBatch = batch.get(target)
      const live = args.existingLive.find((d) => d.slug === target && d.publishedAt)?.publishedAt
      const targetAt = inBatch ?? live
      if (!targetAt) {
        errors.push(`${post.slug} renvoie vers /blog/${target}, qui n'est pas publié — publiez-les ensemble (--only) ou retirez le lien`)
      } else if (new Date(targetAt).getTime() > at) {
        errors.push(`${post.slug} renvoie vers /blog/${target}, publié plus tard (${formatParis(new Date(targetAt))}) — le lien serait cassé entre-temps`)
      }
    }
  }
  return errors
}
