import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@sanity/client"
import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, "..")
const blogDir = path.join(rootDir, "blog")

dotenv.config({ path: path.join(rootDir, ".env.local") })
dotenv.config({ path: path.join(rootDir, ".env") })

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "9cylu9mu"
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production"
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01"
const token = process.env.SANITY_API_TOKEN
const dryRun = process.argv.includes("--dry-run")

if (!token && !dryRun) {
  console.error("Missing SANITY_API_TOKEN. Add a Sanity write token to .env.local before importing drafts.")
  process.exit(1)
}

const client = dryRun
  ? null
  : createClient({
      projectId,
      dataset,
      apiVersion,
      token,
      useCdn: false,
    })

function parseFrontmatter(raw, fileName) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) throw new Error(`${fileName}: missing frontmatter`)

  const data = {}
  let currentArrayKey = null

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue

    const arrayItem = line.match(/^\s*-\s+"?(.+?)"?\s*$/)
    if (arrayItem && currentArrayKey) {
      data[currentArrayKey].push(arrayItem[1])
      continue
    }

    const keyValue = line.match(/^([A-Za-z0-9_]+):(?:\s*(.*))?$/)
    if (!keyValue) continue

    const [, key, rawValue = ""] = keyValue
    if (rawValue.trim() === "") {
      data[key] = []
      currentArrayKey = key
      continue
    }

    currentArrayKey = null
    data[key] = rawValue.trim().replace(/^"(.*)"$/, "$1")
  }

  return { data, body: match[2] }
}

function stableKey(seed) {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `k${(hash >>> 0).toString(36)}`
}

function parseInline(text, seed) {
  const children = []
  const markDefs = []
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let cursor = 0
  let index = 0

  function pushSpan(spanText, marks = []) {
    if (!spanText) return
    children.push({
      _key: stableKey(`${seed}:span:${index}:${spanText}`),
      _type: "span",
      text: spanText,
      marks,
    })
    index += 1
  }

  for (const match of text.matchAll(pattern)) {
    pushSpan(text.slice(cursor, match.index))

    if (match[2] && match[3]) {
      const key = stableKey(`${seed}:link:${match[3]}:${index}`)
      markDefs.push({ _key: key, _type: "link", href: match[3] })
      pushSpan(match[2], [key])
    } else if (match[4]) {
      pushSpan(match[4], ["strong"])
    } else if (match[5]) {
      pushSpan(match[5], ["em"])
    }

    cursor = match.index + match[0].length
  }

  pushSpan(text.slice(cursor))

  return { children, markDefs }
}

function makeBlock(text, style, seed, listItem) {
  const { children, markDefs } = parseInline(text, seed)
  return {
    _key: stableKey(seed),
    _type: "block",
    style,
    markDefs,
    children,
    ...(listItem ? { listItem, level: 1 } : {}),
  }
}

function markdownToPortableText(markdown, title) {
  const normalized = markdown.replace(/\r\n/g, "\n").trim()
  const lines = normalized.split("\n")
  const blocks = []
  let paragraph = []
  let blockIndex = 0

  function flushParagraph() {
    const text = paragraph.join(" ").trim()
    paragraph = []
    if (!text) return
    blocks.push(makeBlock(text, "normal", `block:${blockIndex}:${text}`))
    blockIndex += 1
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      continue
    }

    if (trimmed === `# ${title}` || trimmed.startsWith("# ")) {
      flushParagraph()
      continue
    }

    const heading = trimmed.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      const style = heading[1].length === 2 ? "h2" : heading[1].length === 3 ? "h3" : "h4"
      blocks.push(makeBlock(heading[2], style, `block:${blockIndex}:${heading[2]}`))
      blockIndex += 1
      continue
    }

    const bullet = trimmed.match(/^-\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      blocks.push(makeBlock(bullet[1], "normal", `block:${blockIndex}:${bullet[1]}`, "bullet"))
      blockIndex += 1
      continue
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/)
    if (numbered) {
      flushParagraph()
      blocks.push(makeBlock(numbered[1], "normal", `block:${blockIndex}:${numbered[1]}`, "number"))
      blockIndex += 1
      continue
    }

    paragraph.push(trimmed)
  }

  flushParagraph()
  return blocks
}

function plannedPublicationDate(index) {
  const firstMondayAtParisNine = Date.UTC(2026, 4, 11, 7, 0, 0)
  return new Date(firstMondayAtParisNine + index * 7 * 24 * 60 * 60 * 1000).toISOString()
}

const files = fs
  .readdirSync(blogDir)
  .filter((file) => /^\d{2}-.+\.md$/.test(file))
  .sort()

if (files.length === 0) {
  console.error(`No numbered Markdown files found in ${blogDir}`)
  process.exit(1)
}

const docs = files.map((file, index) => {
  const raw = fs.readFileSync(path.join(blogDir, file), "utf8")
  const { data, body } = parseFrontmatter(raw, file)

  if (!data.title || !data.slug || !data.category || !data.excerpt) {
    throw new Error(`${file}: missing required frontmatter title, slug, category or excerpt`)
  }

  return {
    _id: `drafts.blog-${data.slug}`,
    _type: "post",
    title: data.title,
    slug: { _type: "slug", current: data.slug },
    author: data.author || "L'equipe Totem Avise",
    publishedAt: plannedPublicationDate(index),
    category: data.category,
    excerpt: data.excerpt,
    body: markdownToPortableText(body, data.title),
    ...(data.seoTitle ? { seoTitle: data.seoTitle } : {}),
    ...(data.seoDescription ? { seoDescription: data.seoDescription } : {}),
  }
})

if (dryRun) {
  console.log(`Dry run: prepared ${docs.length} Sanity draft posts for ${projectId}/${dataset}.`)
  for (const doc of docs) {
    console.log(`- ${doc._id} / ${doc.slug.current} / ${doc.body.length} blocks`)
  }
  process.exit(0)
}

const transaction = client.transaction()
for (const doc of docs) {
  transaction.createOrReplace(doc)
}

const result = await transaction.commit({ visibility: "sync" })

console.log(`Imported ${docs.length} Sanity draft posts into ${projectId}/${dataset}.`)
for (const doc of docs) {
  console.log(`- ${doc._id} / ${doc.slug.current}`)
}
console.log(`Transaction id: ${result.transactionId}`)
