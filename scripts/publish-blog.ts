/**
 * Publish the blog/ markdown articles to Sanity.
 *
 * Reads every blog/NN-*.md file, parses its frontmatter + body, converts the
 * markdown body to Sanity Portable Text, and upserts one `post` document per
 * file (createOrReplace, so re-running is idempotent). No mainImage is set —
 * the owner adds photos afterwards in Sanity Studio (/studio).
 *
 * Usage:
 *   npx tsx scripts/publish-blog.ts --dry-run        # prints docs, writes nothing (no token needed)
 *   SANITY_API_WRITE_TOKEN=xxx npx tsx scripts/publish-blog.ts            # imports as DRAFTS (default)
 *   SANITY_API_WRITE_TOKEN=xxx npx tsx scripts/publish-blog.ts --publish  # writes LIVE published posts
 *
 * Default = drafts: posts land in Sanity Studio (/studio) as "Brouillon",
 * editable, with NO image, and do NOT appear on /blog until you publish each
 * one in Studio (or re-run with --publish). The token must have write access
 * to dataset "production".
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@sanity/client"
import { projectId, dataset, apiVersion } from "../src/sanity/env"

const BLOG_DIR = join(process.cwd(), "blog")
const DRY_RUN = process.argv.includes("--dry-run")
// Default to drafts (staging in Studio). --publish writes live posts.
const PUBLISH = process.argv.includes("--publish")

let keyCounter = 0
const key = () => `k${(keyCounter++).toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

type Span = { _type: "span"; _key: string; text: string; marks: string[] }
type MarkDef = { _type: "link"; _key: string; href: string }
type Block = {
  _type: "block"
  _key: string
  style: string
  markDefs: MarkDef[]
  children: Span[]
  listItem?: "bullet"
  level?: number
}

/** Parse inline **bold** and [text](url) into Portable Text spans + markDefs. */
function parseInline(text: string): { children: Span[]; markDefs: MarkDef[] } {
  const children: Span[] = []
  const markDefs: MarkDef[] = []
  const span = (t: string, marks: string[] = []): Span => ({ _type: "span", _key: key(), text: t, marks })
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) children.push(span(text.slice(last, m.index)))
    if (m[1] !== undefined) {
      const k = key()
      markDefs.push({ _type: "link", _key: k, href: m[2] })
      children.push(span(m[1], [k]))
    } else if (m[3] !== undefined) {
      children.push(span(m[3], ["strong"]))
    }
    last = re.lastIndex
  }
  if (last < text.length) children.push(span(text.slice(last)))
  if (children.length === 0) children.push(span(""))
  return { children, markDefs }
}

/** Convert the markdown body (one paragraph per line) to Portable Text. */
function markdownToPortableText(body: string): Block[] {
  const blocks: Block[] = []
  for (const raw of body.split("\n")) {
    const t = raw.trim()
    if (!t) continue
    if (t.startsWith("# ")) continue // H1 == title field, skip to avoid a duplicate heading
    let style = "normal"
    let listItem: "bullet" | undefined
    let content = t
    if (t.startsWith("### ")) {
      style = "h3"
      content = t.slice(4)
    } else if (t.startsWith("## ")) {
      style = "h2"
      content = t.slice(3)
    } else if (t.startsWith("- ")) {
      listItem = "bullet"
      content = t.slice(2)
    }
    const { children, markDefs } = parseInline(content)
    const block: Block = { _type: "block", _key: key(), style, markDefs, children }
    if (listItem) {
      block.listItem = "bullet"
      block.level = 1
    }
    blocks.push(block)
  }
  return blocks
}

/** Minimal frontmatter reader for the simple `key: "value"` lines we use. */
function parseFrontmatter(md: string): { fm: Record<string, string>; body: string } {
  if (!md.startsWith("---")) throw new Error("missing frontmatter")
  const end = md.indexOf("\n---", 3)
  const raw = md.slice(3, end)
  const body = md.slice(end + 4).replace(/^\s*\n/, "")
  const fm: Record<string, string> = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^(\w+):\s*"([\s\S]*?)"\s*$/)
    if (m) fm[m[1]] = m[2]
  }
  return { fm, body }
}

function main() {
  const files = readdirSync(BLOG_DIR)
    .filter((f) => /^\d\d-.+\.md$/.test(f))
    .sort()

  const today = new Date()
  const docs = files.map((file, i) => {
    const { fm, body } = parseFrontmatter(readFileSync(join(BLOG_DIR, file), "utf8"))
    if (!fm.title || !fm.slug || !fm.category || !fm.excerpt) {
      throw new Error(`${file}: missing required frontmatter (title/slug/category/excerpt)`)
    }
    // Stagger publishedAt 3 days apart, oldest first, newest = today, all <= now.
    const published = new Date(today.getTime() - (files.length - 1 - i) * 3 * 24 * 60 * 60 * 1000)
    return {
      // drafts.* id = staged in Studio (not public). Plain id = live.
      _id: `${PUBLISH ? "" : "drafts."}post-${fm.slug}`,
      _type: "post",
      title: fm.title,
      slug: { _type: "slug", current: fm.slug },
      author: fm.author || "L'équipe Totem Avisé",
      publishedAt: published.toISOString(),
      category: fm.category,
      excerpt: fm.excerpt,
      ...(fm.seoTitle ? { seoTitle: fm.seoTitle } : {}),
      ...(fm.seoDescription ? { seoDescription: fm.seoDescription } : {}),
      body: markdownToPortableText(body),
    }
  })

  console.log(`Parsed ${docs.length} posts. Mode: ${PUBLISH ? "LIVE (published)" : "DRAFTS (staged in Studio)"}.`)

  if (DRY_RUN) {
    const sample = docs[0]
    console.log(`\n--- DRY RUN: sample doc (${sample._id}) ---`)
    console.log(JSON.stringify({ ...sample, body: sample.body.slice(0, 6) }, null, 2))
    console.log(`\n(body has ${sample.body.length} blocks; showing first 6)`)
    console.log("\nAll slugs + categories + publishedAt:")
    for (const d of docs) console.log(`  ${d._id}  [${d.category}]  ${d.publishedAt.slice(0, 10)}  ${d.body.length} blocks`)
    console.log(`\nNothing written (dry run). Mode would be: ${PUBLISH ? "LIVE" : "DRAFTS"}. Set SANITY_API_WRITE_TOKEN and drop --dry-run to run.`)
    return
  }

  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!token) {
    console.error("ERROR: SANITY_API_WRITE_TOKEN is not set. Add it to .env.local or pass it inline.")
    process.exit(1)
  }

  const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })
  ;(async () => {
    // Preserve anything the owner set in Studio (photos, adjusted dates): re-running
    // syncs text/body from the .md but never clobbers an existing mainImage/publishedAt.
    const ids = docs.map((d) => d._id)
    const existing: { _id: string; publishedAt?: string; mainImage?: unknown }[] = await client.fetch(
      `*[_id in $ids]{ _id, publishedAt, mainImage }`,
      { ids },
    )
    const prior = new Map(existing.map((e) => [e._id, e]))

    for (const doc of docs) {
      const before = prior.get(doc._id)
      if (before?.mainImage) (doc as Record<string, unknown>).mainImage = before.mainImage
      if (before?.publishedAt) doc.publishedAt = before.publishedAt
      await client.createOrReplace(doc)
      const kept = [before?.mainImage ? "image conservée" : null, before?.publishedAt ? "date conservée" : null].filter(Boolean).join(", ")
      console.log(`  ${PUBLISH ? "published" : "staged"} ${doc._id}${kept ? ` (${kept})` : ""}`)
    }
    console.log(
      PUBLISH
        ? `\nDone. ${docs.length} posts published live to Sanity (${dataset}). They appear on /blog within ~5 min.`
        : `\nDone. ${docs.length} drafts staged in Sanity (${dataset}). Open /studio to review, add photos, then Publish each when ready.`,
    )
  })().catch((e) => {
    console.error("Publish failed:", e instanceof Error ? e.message : e)
    process.exit(1)
  })
}

main()
