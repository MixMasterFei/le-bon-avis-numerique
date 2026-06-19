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
import { writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { prisma } from "../../src/lib/prisma"
import { officialToAge } from "./rating-map"
import { computeStats } from "./metrics"

const SAMPLE = parseInt(process.env.EVAL_SAMPLE ?? "60", 10)

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
]

interface Item {
  id: string
  type: string
  title: string
  genres: string[]
  synopsisFr: string | null
  expertAgeRec: number
  official: number
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
    const content = data?.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)
    const age = Number(parsed.age)
    if (!Number.isFinite(age)) return null
    return Math.max(0, Math.min(18, Math.round(age)))
  } catch {
    return null
  }
}

/** Run an async fn over items with bounded concurrency. */
async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

async function main() {
  const missing = PROVIDERS.filter((p) => !p.apiKey).map((p) => p.name)
  if (missing.length > 0) {
    console.log("Cannot run the A/B — missing API key(s) for:", missing.join(", "))
    console.log("Set OPENAI_API_KEY and MISTRAL_API_KEY (env or .env.local), then re-run.")
    console.log("This script is the GPT-vs-Mistral comparison for the sovereignty decision; it is intentionally not run without both keys.")
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
      })
    }
  }
  console.log(`Sample: ${sample.length} items. Rating with ${PROVIDERS.length} providers…`)

  const lines: string[] = [
    "# Plan B — Step 2: provider A/B (GPT vs Mistral)",
    "",
    `_Sample of ${sample.length} catalog items. Each provider re-rated them from title/genres/synopsis; scored vs the official answer key and vs Totem's current ratings._`,
    "",
    "| Provider | vs Official: MAE | ±2 | vs Totem: MAE | ±2 | unparseable |",
    "|---|---|---|---|---|---|",
  ]

  for (const p of PROVIDERS) {
    const preds = await mapPool(sample, 4, (it) => rateItem(p, it))
    const okOfficial: { pred: number; ref: number }[] = []
    const okTotem: { pred: number; ref: number }[] = []
    let failed = 0
    preds.forEach((pred, idx) => {
      if (pred === null) { failed++; return }
      okOfficial.push({ pred, ref: sample[idx].official })
      okTotem.push({ pred, ref: sample[idx].expertAgeRec })
    })
    const vsOfficial = computeStats(okOfficial)
    const vsTotem = computeStats(okTotem)
    console.log(`${p.name}: vsOfficial MAE ${vsOfficial.mae} ±2 ${vsOfficial.within2}% | vsTotem MAE ${vsTotem.mae} ±2 ${vsTotem.within2}% | failed ${failed}`)
    lines.push(`| ${p.name} | ${vsOfficial.mae} | ${vsOfficial.within2}% | ${vsTotem.mae} | ${vsTotem.within2}% | ${failed} |`)
  }

  lines.push(
    "",
    "**How to read:** lower MAE / higher ±2 vs the official answer key = closer to the legal reference. 'vs Totem' shows how much each provider agrees with the current pipeline. If Mistral matches or beats GPT here, the sovereignty switch is low-risk on quality.",
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
