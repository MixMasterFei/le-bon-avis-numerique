/**
 * Plan B — Step 2 provider A/B: GPT vs Mistral on Totem's own data.
 *
 * Re-rates a stratified sample of catalog titles with each provider and scores
 * them with the SAME metric as the baseline, against two references:
 *   - the official answer key (PEGI/CSA), and
 *   - Totem's current expertAgeRec (agreement with the existing pipeline).
 *
 * This is the concrete tool for the sovereignty decision (see
 * docs/roadmap/vivatech-positioning.md): does a French/European model match or
 * beat the US one on our data, before committing to a switch?
 *
 * COSTS MONEY + needs keys (does NOT run without them):
 *   OPENAI_API_KEY, MISTRAL_API_KEY
 * Optional: EVAL_SAMPLE (default 60) — items per type bucket is sample/3.
 *
 * Run: npx tsx scripts/eval/provider-ab.ts
 * Writes: docs/reports/eval/provider-ab.md
 */
import { writeFileSync, mkdirSync, readFileSync } from "fs"
import { join } from "path"
import { prisma } from "../../src/lib/prisma"
import { officialToAge, ratingSystem } from "./rating-map"
import { computeStats } from "./metrics"

// tsx/Prisma only auto-loads `.env`; load `.env.local` too (where local-only
// keys like MISTRAL_API_KEY live). First non-empty value wins; real shell env
// always wins.
function loadEnvFiles() {
  for (const f of [".env", ".env.local"]) {
    try {
      const txt = readFileSync(join(process.cwd(), f), "utf8")
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/)
        if (!m) continue
        let val = m[2].trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (val.length > 0 && !process.env[m[1]]) process.env[m[1]] = val
      }
    } catch {
      /* file absent — fine */
    }
  }
}
loadEnvFiles()

const SAMPLE = parseInt(process.env.EVAL_SAMPLE ?? "60", 10)
const REPORT_DATE = "2026-06-19"

interface Provider {
  name: string
  url: string
  model: string
  apiKey: string | undefined
}

const PROVIDERS: Provider[] = [
  {
    name: "GPT (gpt-4o-mini)",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
  },
  {
    name: "Mistral (mistral-small-latest)",
    url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    apiKey: process.env.MISTRAL_API_KEY,
  },
  {
    name: "Mistral (mistral-medium-latest)",
    url: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-medium-latest",
    apiKey: process.env.MISTRAL_API_KEY,
  },
]

interface Item {
  id: string
  type: string
  title: string
  genres: string[]
  synopsisFr: string | null
  expertAgeRec: number
  official: number
  officialRatingRaw: string
}

const SYSTEM_PROMPT =
  "Tu es un expert en protection de l'enfance qui recommande, pour des familles francophones, l'âge minimum conseillé pour un contenu (film, série ou jeu vidéo). Tu raisonnes sur l'expérience globale (violence, peur, thèmes, langage), pas seulement la classification légale. Réponds STRICTEMENT en JSON: {\"age\": <entier 0-18>}."

function userPrompt(it: Item): string {
  return [
    `Type: ${it.type}`,
    `Titre: ${it.title}`,
    `Genres: ${it.genres.join(", ") || "—"}`,
    `Synopsis: ${it.synopsisFr ?? "—"}`,
    "",
    "Âge minimum conseillé pour la famille ? Réponds en JSON {\"age\": <entier>}.",
  ].join("\n")
}

async function rateItem(p: Provider, it: Item): Promise<number | null> {
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(it) },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const content: string | undefined = data?.choices?.[0]?.message?.content
    if (!content) return null
    // Be lenient: some models wrap JSON in prose or a code fence.
    let parsed: { age?: unknown } | null = null
    try {
      parsed = JSON.parse(content)
    } catch {
      const m = content.match(/\{[\s\S]*?\}/)
      if (m) {
        try { parsed = JSON.parse(m[0]) } catch { parsed = null }
      }
    }
    // Last resort: first integer in the text.
    let age = parsed ? Number(parsed.age) : NaN
    if (!Number.isFinite(age)) {
      const n = content.match(/\b(\d{1,2})\b/)
      age = n ? Number(n[1]) : NaN
    }
    if (!Number.isFinite(age)) return null
    return Math.max(0, Math.min(18, Math.round(age)))
  } catch {
    return null
  }
}

/** Run an async fn over items with bounded concurrency + per-call delay
 *  (free LLM tiers rate-limit aggressively, so keep this gentle). */
async function mapPool<T, R>(items: T[], limit: number, delayMs: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
      }
    }),
  )
  return out
}

async function main() {
  const active = PROVIDERS.filter((p) => p.apiKey)
  const skipped = PROVIDERS.filter((p) => !p.apiKey)
  if (skipped.length > 0) {
    console.log("Skipping (no API key set):", skipped.map((p) => p.name).join(", "))
  }
  if (active.length === 0) {
    console.log("No provider keys available — set OPENAI_API_KEY and/or MISTRAL_API_KEY in .env.local and re-run.")
    return
  }

  // Stratified sample: enriched items with synopsis + a mappable official rating.
  const perType = Math.max(1, Math.floor(SAMPLE / 3))
  const sample: Item[] = []
  for (const type of ["MOVIE", "TV", "GAME"] as const) {
    const rows = await prisma.mediaItem.findMany({
      where: {
        type,
        isEnriched: true,
        expertAgeRec: { not: null },
        officialRating: { not: null },
        synopsisFr: { not: null },
      },
      select: { id: true, type: true, title: true, genres: true, synopsisFr: true, expertAgeRec: true, officialRating: true },
      take: perType,
      orderBy: { id: "asc" },
    })
    for (const r of rows) {
      const official = officialToAge(r.officialRating)
      if (official === null) continue
      sample.push({
        id: r.id,
        type: r.type,
        title: r.title,
        genres: r.genres ?? [],
        synopsisFr: r.synopsisFr,
        expertAgeRec: r.expertAgeRec as number,
        official,
        officialRatingRaw: r.officialRating as string,
      })
    }
  }
  console.log(`Sample: ${sample.length} items. Rating with: ${active.map((p) => p.name).join(", ")}…`)

  const lines: string[] = [
    "# Plan B — Step 2: provider A/B (GPT vs Mistral)",
    "",
    `_Generated ${REPORT_DATE}. Sample of ${sample.length} catalog items; each provider re-rated them from title/genres/synopsis. Scored with the same metric as the baseline, bucketed by type._`,
    "",
    skipped.length > 0 ? `> Note: skipped (no key set): ${skipped.map((p) => p.name).join(", ")}.\n` : "",
    "| Provider | Games vs PEGI: MAE / ±2 | Rated film·TV vs CSA: MAE / ±2 | vs Totem (agreement): MAE / ±2 | unparseable |",
    "|---|---|---|---|---|",
  ]

  for (const p of active) {
    // Gentle: 2 in flight + 600ms spacing to avoid free-tier 429s.
    const preds = await mapPool(sample, 2, 600, (it) => rateItem(p, it))
    const games: { pred: number; ref: number }[] = []
    const filmtv: { pred: number; ref: number }[] = []
    const totem: { pred: number; ref: number }[] = []
    let failed = 0
    preds.forEach((pred, idx) => {
      if (pred === null) { failed++; return }
      const s = sample[idx]
      totem.push({ pred, ref: s.expertAgeRec })
      if (s.type === "GAME" && ratingSystem(s.officialRatingRaw) === "PEGI") games.push({ pred, ref: s.official })
      else if ((s.type === "MOVIE" || s.type === "TV") && s.official > 0) filmtv.push({ pred, ref: s.official })
    })
    const g = computeStats(games)
    const f = computeStats(filmtv)
    const t = computeStats(totem)
    console.log(`${p.name}: games vsPEGI MAE ${g.mae}/±2 ${g.within2}% (n${g.n}) | film·TV vsCSA MAE ${f.mae}/±2 ${f.within2}% (n${f.n}) | vsTotem MAE ${t.mae}/±2 ${t.within2}% | failed ${failed}`)
    lines.push(`| ${p.name} | ${g.mae} / ${g.within2}% (n=${g.n}) | ${f.mae} / ${f.within2}% (n=${f.n}) | ${t.mae} / ${t.within2}% | ${failed} |`)
  }

  lines.push(
    "",
    "**Reference — current Totem pipeline (from the baseline):** games vs PEGI MAE 2.09 / ±2 68.5%; rated film·TV vs CSA MAE 1.32 / ±2 81.6%.",
    "",
    "**How to read:** lower MAE / higher ±2 vs the answer key = closer to the reference. 'vs Totem' = agreement with the current pipeline. A provider that matches/beats the baseline numbers is a safe swap on quality; if Mistral does, the sovereignty switch is low-risk.",
    "",
  )

  const outDir = join(process.cwd(), "docs", "reports", "eval")
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, "provider-ab.md")
  writeFileSync(outPath, lines.join("\n"), "utf8")
  console.log(`\nReport written: ${outPath}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
