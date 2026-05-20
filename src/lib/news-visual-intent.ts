import crypto from "node:crypto"
import { DEFAULT_MODEL, getAnthropic } from "@/lib/anthropic"
import { callClaudeWithTimeout } from "@/lib/anthropic-with-timeout"
import { deriveNewsImageConcept } from "@/lib/news-image-concepts"
import { prisma } from "@/lib/prisma"

export interface NewsVisualIntent {
  query: string
  negativeTerms: string[]
  confidence: number
  label: string
  reason?: string
  source: "llm" | "rule"
}

export interface VisualIntentInput {
  title: string
  summary?: string | null
  body?: string | null
  category?: string | null
}

interface VisualIntentOptions {
  cacheOnly?: boolean
}

const INTENT_CACHE_PROVIDER = "visual-intent-v1"
const INTENT_CACHE_VERSION = "v1"
const MIN_CONFIDENCE = 0.72
const INTENT_TIMEOUT_MS = 7_000

const BANNED_QUERY_TERMS = [
  "netflix",
  "disney",
  "fortnite",
  "iphone",
  "apple",
  "google",
  "meta",
  "tiktok",
  "instagram",
  "nintendo",
  "roblox",
  "minecraft",
  "logo",
  "brand",
]

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function cacheKey(input: VisualIntentInput): string {
  const raw = normalize(`${input.category ?? ""}\n${input.title}\n${input.summary ?? ""}\n${input.body ?? ""}`)
  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32)
  return `${INTENT_CACHE_VERSION}:${hash}`
}

function cleanQuery(query: unknown): string {
  if (typeof query !== "string") return ""
  return normalize(query)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 7)
    .join(" ")
}

function cleanTerms(terms: unknown): string[] {
  if (!Array.isArray(terms)) return []
  const out = terms
    .flatMap((term) => (typeof term === "string" ? [cleanQuery(term)] : []))
    .filter((term) => term.length >= 3)
    .slice(0, 10)
  return Array.from(new Set(out))
}

function hasBannedQueryTerm(query: string): boolean {
  return BANNED_QUERY_TERMS.some((term) => new RegExp(`\\b${term}\\b`, "i").test(query))
}

function parseIntent(raw: string): NewsVisualIntent | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>
    const query = cleanQuery(parsed.query)
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0
    if (!query || hasBannedQueryTerm(query)) return null
    return {
      query,
      negativeTerms: cleanTerms(parsed.negativeTerms),
      confidence,
      label: typeof parsed.label === "string" ? parsed.label.slice(0, 60) : "intention visuelle",
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 240) : undefined,
      source: "llm",
    }
  } catch {
    return null
  }
}

async function readIntentCache(input: VisualIntentInput): Promise<NewsVisualIntent | null> {
  try {
    const row = await prisma.stockImageCache.findUnique({
      where: {
        provider_keywordsKey: {
          provider: INTENT_CACHE_PROVIDER,
          keywordsKey: cacheKey(input),
        },
      },
    })
    if (!row) return null
    const parsed = JSON.parse(row.credit) as Omit<NewsVisualIntent, "query">
    return {
      ...parsed,
      query: row.imageUrl,
      negativeTerms: Array.isArray(parsed.negativeTerms) ? parsed.negativeTerms : [],
      source: parsed.source === "rule" ? "rule" : "llm",
    }
  } catch {
    return null
  }
}

async function writeIntentCache(input: VisualIntentInput, intent: NewsVisualIntent): Promise<void> {
  try {
    await prisma.stockImageCache.upsert({
      where: {
        provider_keywordsKey: {
          provider: INTENT_CACHE_PROVIDER,
          keywordsKey: cacheKey(input),
        },
      },
      create: {
        provider: INTENT_CACHE_PROVIDER,
        keywordsKey: cacheKey(input),
        imageUrl: intent.query,
        credit: JSON.stringify({
          negativeTerms: intent.negativeTerms,
          confidence: intent.confidence,
          label: intent.label,
          reason: intent.reason,
          source: intent.source,
        }),
        licenseUrl: "visual-intent",
      },
      update: {
        imageUrl: intent.query,
        credit: JSON.stringify({
          negativeTerms: intent.negativeTerms,
          confidence: intent.confidence,
          label: intent.label,
          reason: intent.reason,
          source: intent.source,
        }),
        createdAt: new Date(),
      },
    })
  } catch (err) {
    console.warn("[news-visual-intent] cache write failed:", err)
  }
}

function ruleIntent(input: VisualIntentInput): NewsVisualIntent | null {
  const concept = deriveNewsImageConcept(input)
  if (concept.matchedTerms.length === 0) return null
  return {
    query: concept.query,
    negativeTerms: [],
    confidence: 0.78,
    label: concept.label,
    source: "rule",
  }
}

async function llmIntent(input: VisualIntentInput): Promise<NewsVisualIntent | null> {
  if (process.env.NEWS_VISUAL_INTENT_LLM === "false") return null
  let anthropic
  try {
    anthropic = getAnthropic()
  } catch {
    return null
  }

  const prompt = `You choose legal, generic stock-photo search intent for a French family-news card.

Return ONLY compact JSON:
{"query":"3 to 7 English words","negativeTerms":["word"],"confidence":0.0,"label":"short French label","reason":"short reason"}

Rules:
- Read the article meaning, not isolated keywords.
- Query must describe a concrete scene a stock-photo API can find.
- No logos, brands, copyrighted characters, celebrities, screenshots, exact incident photos, or text overlays.
- Prefer simple representative scenes: "children feet running track", "museum gallery exhibition visitors", "teenager playing mobile game smartphone".
- Add negativeTerms for likely bad literal matches.
- confidence below 0.72 if no clear generic visual exists.

Category: ${input.category ?? "unknown"}
Title: ${input.title}
Summary: ${input.summary ?? ""}
Body excerpt: ${(input.body ?? "").slice(0, 1400)}`

  const response = await callClaudeWithTimeout(
    (signal) =>
      anthropic.messages.create(
        {
          model: DEFAULT_MODEL,
          max_tokens: 360,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        },
        { signal },
      ),
    INTENT_TIMEOUT_MS,
    "news-visual-intent",
  )
  if (!response) return null

  const text = response.content
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .join("")

  return parseIntent(text)
}

export async function resolveNewsVisualIntent(
  input: VisualIntentInput,
  options: VisualIntentOptions = {},
): Promise<NewsVisualIntent | null> {
  const cached = await readIntentCache(input)
  if (cached) return cached

  if (options.cacheOnly) {
    return ruleIntent(input)
  }

  const rule = ruleIntent(input)
  const llm = await llmIntent(input)
  const intent = llm && llm.confidence >= MIN_CONFIDENCE ? llm : rule ?? llm
  if (!intent) return null
  await writeIntentCache(input, intent)
  return intent
}
