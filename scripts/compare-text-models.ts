/**
 * Compare text models on the daily enrichment prompt — READ-ONLY, writes
 * nothing to the database.
 *
 * Runs the exact prompt + parser of /api/admin/enrich
 * (src/lib/enrichment-analysis.ts) and the same deterministic safety floors
 * (src/lib/content-safety-floors.ts) through several models, then prints a
 * per-title table (stored age vs each model's age, « Ce qui peut marquer »
 * flags, content-score drift, tokens, latency) and a summary.
 *
 * Built for the GPT-5 family shutdown (11 Dec 2026): it names the old model on
 * purpose — the guard test that bans the old ids exempts this file only.
 *
 * Usage:
 *   npx tsx scripts/compare-text-models.ts                       # 20 titles from the DB
 *   npx tsx scripts/compare-text-models.ts --limit 30 --json out.json
 *   npx tsx scripts/compare-text-models.ts --ids id1,id2,id3
 *   npx tsx scripts/compare-text-models.ts --input titles.json   # no DATABASE_URL needed
 *   npx tsx scripts/compare-text-models.ts --export-input titles.json --dry-run   # DB → input file, no model call
 *
 * Options:
 *   --models a,b,c   model specs `id[:effort]` (default: gpt-5-mini,gpt-6.1-terra).
 *                    The old model defaults to "minimal" (its production
 *                    setting), every other id to --effort. One model can run
 *                    at several efforts: gpt-5-mini,gpt-6.1-terra:none,gpt-6.1-terra:low
 *   --effort E       default effort for ids without one: none | low | … (default none)
 *   --limit N        titles read from the DB (default 20), a mix of films / séries / jeux and ages
 *   --ids a,b,c      exact media ids (DB mode) or a filter on the input file
 *   --input F        JSON array of titles (fields below), instead of the DB
 *   --export-input F write the selected titles as an --input file
 *   --json F         write every result (raw + floored ages, metrics, usage) to F
 *   --timeout S      per-call timeout in seconds (default 60; production uses 35)
 *   --price id=IN/OUT  USD per 1M input/output tokens for the cost estimate
 *                    (repeatable; gpt-5-mini has a default, unknown ids print n/a)
 *   --dry-run        select titles and print prompt sizes, no model call
 *
 * Input file: [{ id, title, originalTitle?, type: "MOVIE"|"TV"|"GAME", synopsis?,
 *   genres: [], releaseDate?: "YYYY-MM-DD", officialRating?, tmdbVoteCount?,
 *   demographic?, pegiDescriptors?: [], topics?: [], tmdbKeywords?: [],
 *   storedAge?, storedMetrics?: { violence, sexNudity, language, consumerism,
 *   substanceUse, positiveMessages, roleModels }, storedWarnings?: [] }]
 *
 * OPENAI_API_KEY must be set (any value works behind a key-injecting proxy,
 * e.g. OPENAI_API_KEY=proxy-injected); OPENAI_BASE_URL is honoured by the SDK.
 */

import { config } from "dotenv"
config()

import { readFileSync, writeFileSync } from "fs"
import OpenAI from "openai"
import {
  buildEnrichmentMessages,
  parseEnrichmentResponse,
  ENRICHMENT_MAX_COMPLETION_TOKENS,
  type ContentAnalysis,
} from "../src/lib/enrichment-analysis"
import { buildTextCompletionParams, DEFAULT_OPENAI_TEXT_MODEL } from "../src/lib/openai-text-model"
import { applyContentSafetyFloors } from "../src/lib/content-safety-floors"

const OLD_MODEL = "gpt-5-mini"
const OLD_MODEL_EFFORT = "minimal"

/** USD per 1M tokens [input, output]. Override / add with --price. */
const DEFAULT_PRICES: Record<string, [number, number]> = {
  [OLD_MODEL]: [0.25, 2.0],
}

const AXES = ["violence", "sexNudity", "language", "consumerism", "substanceUse", "positiveMessages", "roleModels"] as const
type Metrics = Record<(typeof AXES)[number], number>

interface TitleInput {
  id: string
  title: string
  originalTitle?: string | null
  type: string
  synopsis?: string | null
  genres: string[]
  releaseDate?: string | null
  officialRating?: string | null
  tmdbVoteCount?: number | null
  demographic?: string | null
  pegiDescriptors?: string[] | null
  topics?: string[]
  tmdbKeywords?: string[]
  storedAge?: number | null
  storedMetrics?: Metrics | null
  storedWarnings?: string[]
}

interface ModelSpec {
  label: string
  model: string
  effort: string | null
}

interface RunResult {
  spec: string
  ok: boolean
  failure?: "api" | "parse"
  error?: string
  rawAge?: number
  age?: number
  metrics?: Metrics
  warnings?: string[]
  confidence?: number
  promptTokens?: number
  completionTokens?: number
  reasoningTokens?: number
  latencyMs: number
  costUsd?: number | null
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const opts = {
    models: `${OLD_MODEL},${DEFAULT_OPENAI_TEXT_MODEL}`,
    effort: "none",
    limit: 20,
    ids: [] as string[],
    input: null as string | null,
    exportInput: null as string | null,
    json: null as string | null,
    timeoutS: 60,
    prices: { ...DEFAULT_PRICES },
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const v = argv[++i]
      if (v === undefined) throw new Error(`${arg} needs a value`)
      return v
    }
    switch (arg) {
      case "--models": opts.models = next(); break
      case "--effort": opts.effort = next(); break
      case "--limit": opts.limit = Math.max(1, parseInt(next(), 10) || 20); break
      case "--ids": opts.ids = next().split(",").map((s) => s.trim()).filter(Boolean); break
      case "--input": opts.input = next(); break
      case "--export-input": opts.exportInput = next(); break
      case "--json": opts.json = next(); break
      case "--timeout": opts.timeoutS = Math.max(5, parseInt(next(), 10) || 60); break
      case "--price": {
        const m = next().match(/^(.+)=([\d.]+)\/([\d.]+)$/)
        if (!m) throw new Error("--price expects id=IN/OUT (USD per 1M tokens)")
        opts.prices[m[1]] = [parseFloat(m[2]), parseFloat(m[3])]
        break
      }
      case "--dry-run": opts.dryRun = true; break
      case "--help":
      case "-h":
        console.log(readFileSync(__filename, "utf8").split("*/")[0])
        process.exit(0)
      default:
        throw new Error(`Unknown option ${arg} (--help)`)
    }
  }
  return opts
}

function parseModelSpecs(list: string, defaultEffort: string): ModelSpec[] {
  return list.split(",").map((s) => s.trim()).filter(Boolean).map((spec) => {
    const [model, effortRaw] = spec.split(":")
    const effort = effortRaw !== undefined
      ? (effortRaw === "omit" ? null : effortRaw)
      : model === OLD_MODEL ? OLD_MODEL_EFFORT : defaultEffort
    return { label: `${model}:${effort ?? "omit"}`, model, effort }
  })
}

// ── Title selection ─────────────────────────────────────────────────────────

function ageBucket(age: number | null | undefined): string {
  if (age == null) return "?"
  if (age <= 6) return "≤6"
  if (age <= 10) return "7-10"
  if (age <= 13) return "11-13"
  return "14+"
}

/** Round-robin over (type × age bucket), most-voted first inside each cell. */
function pickMix(pool: TitleInput[], limit: number): TitleInput[] {
  const cells = new Map<string, TitleInput[]>()
  for (const t of pool) {
    const key = `${t.type}|${ageBucket(t.storedAge)}`
    const cell = cells.get(key) ?? []
    cell.push(t)
    cells.set(key, cell)
  }
  const queues = [...cells.values()]
  const picked: TitleInput[] = []
  while (picked.length < limit && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift()
      if (next) picked.push(next)
      if (picked.length >= limit) break
    }
  }
  return picked
}

async function loadFromDb(ids: string[], limit: number): Promise<TitleInput[]> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — pass --input titles.json to run without the DB")
  }
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.mediaItem.findMany({
      where: ids.length > 0
        ? { id: { in: ids } }
        : { isEnriched: true, type: { in: ["MOVIE", "TV", "GAME"] }, contentMetrics: { isNot: null } },
      include: { contentMetrics: true },
      orderBy: { tmdbVoteCount: { sort: "desc", nulls: "last" } },
      take: ids.length > 0 ? ids.length : limit * 15,
    })
    const titles: TitleInput[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      originalTitle: r.originalTitle,
      type: r.type,
      synopsis: r.synopsisFr,
      genres: r.genres,
      releaseDate: r.releaseDate ? r.releaseDate.toISOString().slice(0, 10) : null,
      officialRating: r.officialRating,
      tmdbVoteCount: r.tmdbVoteCount,
      demographic: r.demographic,
      pegiDescriptors: r.pegiDescriptors,
      topics: r.topics,
      storedAge: r.expertAgeRec,
      storedMetrics: r.contentMetrics
        ? Object.fromEntries(AXES.map((a) => [a, r.contentMetrics![a]])) as Metrics
        : null,
      storedWarnings: r.contentMetrics?.sensitiveWarnings ?? [],
      tmdbKeywords: [],
    }))
    const picked = ids.length > 0 ? titles : pickMix(titles, limit)
    // Same best-effort keyword grounding as the route (MOVIE/TV with a tmdbId).
    if (process.env.TMDB_API_KEY) {
      const { getMovieKeywords, getTVKeywords } = await import("../src/lib/tmdb")
      const tmdbIds = new Map(rows.map((r) => [r.id, r.tmdbId]))
      for (const t of picked) {
        const tmdbId = tmdbIds.get(t.id)
        if (!tmdbId) continue
        if (t.type === "MOVIE") t.tmdbKeywords = await getMovieKeywords(tmdbId)
        else if (t.type === "TV") t.tmdbKeywords = await getTVKeywords(tmdbId)
      }
    }
    return picked
  } finally {
    await prisma.$disconnect()
  }
}

function loadFromFile(path: string, ids: string[], limit: number): TitleInput[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as TitleInput[]
  if (!Array.isArray(parsed)) throw new Error(`${path}: expected a JSON array of titles`)
  const titles = parsed.map((t) => ({ ...t, genres: t.genres ?? [] }))
  if (ids.length > 0) return titles.filter((t) => ids.includes(t.id))
  return titles.slice(0, limit)
}

// ── Model call ──────────────────────────────────────────────────────────────

async function runOne(
  openai: OpenAI,
  spec: ModelSpec,
  title: TitleInput,
  timeoutS: number,
  prices: Record<string, [number, number]>,
): Promise<RunResult> {
  const item = {
    ...title,
    releaseDate: title.releaseDate ? new Date(title.releaseDate) : null,
  }
  const params = buildTextCompletionParams({
    model: spec.model,
    reasoningEffort: spec.effort,
    messages: buildEnrichmentMessages(item, title.tmdbKeywords ?? []),
    maxCompletionTokens: ENRICHMENT_MAX_COMPLETION_TOKENS,
  })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutS * 1000)
  const started = Date.now()
  let response: OpenAI.Chat.Completions.ChatCompletion
  try {
    response = (await openai.chat.completions.create(
      params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      { signal: controller.signal },
    )) as OpenAI.Chat.Completions.ChatCompletion
  } catch (error) {
    return {
      spec: spec.label,
      ok: false,
      failure: "api",
      error: (error instanceof Error ? error.message : String(error)).slice(0, 200),
      latencyMs: Date.now() - started,
    }
  } finally {
    clearTimeout(timer)
  }
  const latencyMs = Date.now() - started
  const usage = response.usage
  const promptTokens = usage?.prompt_tokens
  const completionTokens = usage?.completion_tokens
  const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens
  const price = prices[spec.model]
  const costUsd = price && promptTokens != null && completionTokens != null
    ? (promptTokens * price[0] + completionTokens * price[1]) / 1_000_000
    : null
  const base = { spec: spec.label, latencyMs, promptTokens, completionTokens, reasoningTokens, costUsd }

  let analysis: ContentAnalysis
  const logError = console.error
  try {
    console.error = () => {} // the parser logs bad JSON; the table reports it
    analysis = parseEnrichmentResponse(response.choices[0]?.message?.content, item)
  } catch (error) {
    return { ...base, ok: false, failure: "parse", error: (error instanceof Error ? error.message : String(error)).slice(0, 200) }
  } finally {
    console.error = logError
  }

  // Same deterministic floors the route applies before writing.
  const floored = applyContentSafetyFloors({
    expertAgeRec: analysis.expertAgeRec,
    metrics: analysis.contentMetrics,
    genres: title.genres,
    topics: [...(title.topics ?? []), ...analysis.tags],
    visualStyle: analysis.visualStyle,
    type: title.type,
    officialRating: title.officialRating,
    pegiDescriptors: title.pegiDescriptors,
  })
  return {
    ...base,
    ok: true,
    rawAge: analysis.expertAgeRec,
    age: floored.expertAgeRec,
    metrics: floored.metrics as Metrics,
    warnings: analysis.sensitiveWarnings,
    confidence: analysis.confidence,
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

function metricDrift(a: Metrics | null | undefined, b: Metrics | null | undefined): string {
  if (!a || !b) return "—"
  const parts = AXES.map((axis) => {
    const d = b[axis] - a[axis]
    return d === 0 ? null : `${axis.slice(0, 3)}${d > 0 ? "+" : ""}${d}`
  }).filter(Boolean)
  return parts.length === 0 ? "=" : parts.join(" ")
}

function ageDiffBucket(stored: number | null | undefined, age: number | undefined): "same" | "1" | "2+" | null {
  if (stored == null || age == null) return null
  const d = Math.abs(age - stored)
  return d === 0 ? "same" : d === 1 ? "1" : "2+"
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const specs = parseModelSpecs(opts.models, opts.effort)
  if (specs.length === 0) throw new Error("--models is empty")

  const titles = opts.input
    ? loadFromFile(opts.input, opts.ids, opts.limit)
    : await loadFromDb(opts.ids, opts.limit)
  if (titles.length === 0) throw new Error("No title to compare")

  if (opts.exportInput) {
    writeFileSync(opts.exportInput, JSON.stringify(titles, null, 2))
    console.log(`Wrote ${titles.length} titles to ${opts.exportInput}`)
  }

  const mix = titles.reduce<Record<string, number>>((acc, t) => {
    const k = `${t.type} ${ageBucket(t.storedAge)}`
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  console.log(`${titles.length} titles · ${specs.map((s) => s.label).join(" vs ")}`)
  console.log(`Mix: ${Object.entries(mix).map(([k, v]) => `${k}: ${v}`).join(" · ")}\n`)

  if (opts.dryRun) {
    for (const t of titles) {
      const chars = buildEnrichmentMessages({ ...t, releaseDate: t.releaseDate ? new Date(t.releaseDate) : null }, t.tmdbKeywords ?? [])
        .reduce((n, m) => n + m.content.length, 0)
      console.log(`${pad(t.title, 40)} ${pad(t.type, 5)} stored ${t.storedAge ?? "?"}  prompt ${chars} chars`)
    }
    console.log("\n--dry-run: no model call.")
    return
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set (any value works behind a key-injecting proxy)")
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const rows: { title: TitleInput; results: RunResult[] }[] = []
  for (const [i, title] of titles.entries()) {
    const results: RunResult[] = []
    for (const spec of specs) {
      results.push(await runOne(openai, spec, title, opts.timeoutS, opts.prices))
    }
    rows.push({ title, results })

    console.log(`[${i + 1}/${titles.length}] ${title.title} (${title.type}) — stored age ${title.storedAge ?? "?"}`)
    for (const r of results) {
      if (!r.ok) {
        console.log(`   ${pad(r.spec, 26)} FAILED (${r.failure}) ${r.error ?? ""} · ${r.latencyMs} ms`)
        continue
      }
      const ageNote = r.rawAge !== r.age ? `${r.age} (modèle ${r.rawAge})` : `${r.age}`
      console.log(
        `   ${pad(r.spec, 26)} âge ${pad(ageNote, 14)} scores ${pad(metricDrift(title.storedMetrics, r.metrics), 30)} ` +
          `tokens ${r.promptTokens ?? "?"}/${r.completionTokens ?? "?"}${r.reasoningTokens ? ` (raisonnement ${r.reasoningTokens})` : ""} · ${r.latencyMs} ms`,
      )
      console.log(`   ${" ".repeat(26)} marquer: ${r.warnings && r.warnings.length > 0 ? r.warnings.join(", ") : "—"}`)
    }
    if (title.storedWarnings && title.storedWarnings.length > 0) {
      console.log(`   ${pad("stocké", 26)} marquer: ${title.storedWarnings.join(", ")}`)
    }
  }

  // Summary per model: vs the stored age, and vs the first model.
  console.log("\n── Résumé ──")
  const baseline = specs[0].label
  for (const spec of specs) {
    const results = rows.map((r) => ({ title: r.title, r: r.results.find((x) => x.spec === spec.label)! }))
    const ok = results.filter((x) => x.r.ok)
    const vsStored = { same: 0, "1": 0, "2+": 0 }
    const vsBase = { same: 0, "1": 0, "2+": 0 }
    for (const { title, r } of ok) {
      const b = ageDiffBucket(title.storedAge, r.age)
      if (b) vsStored[b]++
      const baseResult = rows.find((row) => row.title.id === title.id)!.results.find((x) => x.spec === baseline)
      const bb = baseResult?.ok ? ageDiffBucket(baseResult.age, r.age) : null
      if (bb) vsBase[bb]++
    }
    const apiFailures = results.filter((x) => !x.r.ok && x.r.failure === "api").length
    const parseFailures = results.filter((x) => !x.r.ok && x.r.failure === "parse").length
    const latencies = results.map((x) => x.r.latencyMs)
    const meanLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length))
    const costs = ok.map((x) => x.r.costUsd).filter((c): c is number => typeof c === "number")
    const meanCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null
    const meanTokens = (key: "promptTokens" | "completionTokens" | "reasoningTokens") => {
      const vals = ok.map((x) => x.r[key]).filter((v): v is number => typeof v === "number")
      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    }
    console.log(`\n${spec.label}`)
    console.log(`  réponses exploitables : ${ok.length}/${results.length} · échecs API ${apiFailures} · JSON invalide/vide ${parseFailures}`)
    console.log(`  âge vs stocké         : identique ${vsStored.same} · ±1 ${vsStored["1"]} · ±2+ ${vsStored["2+"]}`)
    if (spec.label !== baseline) {
      console.log(`  âge vs ${baseline} : identique ${vsBase.same} · ±1 ${vsBase["1"]} · ±2+ ${vsBase["2+"]}`)
    }
    console.log(`  tokens moyens         : entrée ${meanTokens("promptTokens")} · sortie ${meanTokens("completionTokens")} (raisonnement ${meanTokens("reasoningTokens")})`)
    console.log(`  latence moyenne       : ${meanLatency} ms`)
    console.log(`  coût moyen / titre    : ${meanCost != null ? `$${meanCost.toFixed(5)}` : `n/a (--price ${spec.model}=IN/OUT)`}`)
  }

  if (opts.json) {
    writeFileSync(opts.json, JSON.stringify({ models: specs, rows }, null, 2))
    console.log(`\nRésultats complets : ${opts.json}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
