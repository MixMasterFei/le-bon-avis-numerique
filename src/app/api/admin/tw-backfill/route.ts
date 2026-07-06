import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { prisma } from "@/lib/prisma"
import { VALID_SENSITIVE_WARNINGS } from "@/lib/sensitive-warnings"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// ── TW backfill — sensitive-warnings-ONLY enrichment pass ──────────────────
//
// One-off sweep to populate the expanded trigger-warning vocabulary (mort d'un
// animal, maladie grave…) on already-enriched films/TV without re-running the
// full enrichment (which would churn ages/metrics that are already good).
//
// Anti-hallucination design — the new labels are SPECIFIC and falsifiable
// ("Mort d'un animal" can be checked), so the bar is higher than the normal
// enrichment pass:
//   1. Per-label confidence from the model; only labels >= MIN_CONFIDENCE kept.
//   2. Recognition gate: if the model doesn't recognize the exact title, it may
//      only flag labels directly supported by the synopsis text — genre
//      stereotypes are explicitly forbidden.
//   3. Merge-only: never removes existing labels (parents may have voted them);
//      the community "Pas dans ce film" vote remains the corrective layer.
//
// Auth: /api/admin/* middleware (admin session or Bearer CRON_SECRET).
// Usage: POST /api/admin/tw-backfill?limit=15&dryRun=1[&cursor=<id>]

const MIN_CONFIDENCE = 0.75
const MAX_LABELS = 8
const CONCURRENCY = 5

interface TwItem {
  id: string
  title: string
  type: string
  releaseDate: Date | null
  genres: string[]
  synopsisFr: string | null
  contentMetrics: { id: string; sensitiveWarnings: string[] } | null
}

interface ModelLabel {
  label: string
  confidence: number
}

async function analyzeTw(openai: OpenAI, item: TwItem): Promise<ModelLabel[]> {
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : "?"
  const typeLabel = item.type === "TV" ? "série TV" : "film"
  const prompt = `Titre : "${item.title}" (${typeLabel}, ${year})
Genres : ${item.genres.slice(0, 5).join(", ") || "?"}
Synopsis : ${item.synopsisFr?.slice(0, 600) || "(absent)"}

Parmi cette liste FERMÉE d'éléments sensibles, lesquels sont présents dans ce ${typeLabel} ?
${VALID_SENSITIVE_WARNINGS.map((w) => `- ${w}`).join("\n")}

RÈGLES STRICTES (produit de confiance familiale — un label inventé est inacceptable, un label manquant est un coût mineur) :
1. Ne flagge un élément QUE si tu connais ce titre précis et que tu es sûr de sa présence, OU si le synopsis ci-dessus l'indique explicitement.
2. Si tu ne reconnais pas ce titre précis : uniquement les éléments explicites du synopsis. INTERDIT de déduire par stéréotype de genre ("film d'horreur donc probablement…").
3. En cas de doute, OMETS l'élément.
4. confidence = ta certitude que l'élément est réellement présent (0-1). Ne liste rien sous 0.6.

Réponds UNIQUEMENT en JSON : {"recognized": <bool>, "warnings": [{"label": "<label exact de la liste>", "confidence": <0-1>}]}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const completionParams = {
      model: "gpt-5-mini",
      messages: [
        {
          role: "system" as const,
          content:
            "Tu identifies des éléments sensibles dans des contenus pour un guide familial. Tu ne devines JAMAIS : mieux vaut omettre qu'inventer. Réponds toujours en JSON valide.",
        },
        { role: "user" as const, content: prompt },
      ],
      max_completion_tokens: 1200,
      reasoning_effort: "minimal",
    }
    const response = await openai.chat.completions.create(
      completionParams as unknown as Parameters<typeof openai.chat.completions.create>[0] & { stream?: false },
      { signal: controller.signal },
    )
    const content = response.choices[0]?.message?.content
    if (!content) return []
    const jsonMatch = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0]) as { warnings?: ModelLabel[] }
    if (!Array.isArray(parsed.warnings)) return []
    const valid = VALID_SENSITIVE_WARNINGS as readonly string[]
    return parsed.warnings.filter(
      (w) =>
        w &&
        typeof w.label === "string" &&
        valid.includes(w.label) &&
        typeof w.confidence === "number" &&
        w.confidence >= MIN_CONFIDENCE,
    )
  } catch {
    return [] // per-item failure → skip, never block the batch
  } finally {
    clearTimeout(timer)
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "15"), 40)
  const dryRun = searchParams.get("dryRun") === "1"
  const cursor = searchParams.get("cursor")
  const idsParam = searchParams.get("ids") // targeted sample (dry-run review)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 })
  }
  const openai = new OpenAI({ apiKey })

  const items = (await prisma.mediaItem.findMany({
    where: idsParam
      ? { id: { in: idsParam.split(",") } }
      : {
          type: { in: ["MOVIE", "TV"] },
          isEnriched: true,
          contentMetrics: { isNot: null },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
    orderBy: { id: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      releaseDate: true,
      genres: true,
      synopsisFr: true,
      contentMetrics: { select: { id: true, sensitiveWarnings: true } },
    },
  })) as TwItem[]

  const stats = { processed: 0, updated: 0, labelsAdded: 0 }
  const details: Array<{ title: string; existing: string[]; added: string[]; kept: string[] }> = []

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY)
    await Promise.all(
      chunk.map(async (item) => {
        if (!item.contentMetrics) return
        stats.processed++
        const flagged = await analyzeTw(openai, item)
        const existing = item.contentMetrics.sensitiveWarnings ?? []
        // Highest-confidence additions first, so the cap trims the weakest
        // labels — not the most valuable one (Roi Lion dry-run: 'Mort d'un
        // animal' at 0.95 was cut while 'Maltraitance' at 0.75 survived).
        const additions = flagged
          .filter((f) => !existing.includes(f.label))
          .sort((a, b) => b.confidence - a.confidence)
          .map((f) => f.label)
        const merged = [...existing, ...additions].slice(0, MAX_LABELS)
        const finalAdded = merged.filter((l) => !existing.includes(l))
        details.push({
          title: `${item.title} (${item.type})`,
          existing,
          added: finalAdded,
          kept: flagged.map((f) => `${f.label} ${f.confidence.toFixed(2)}`),
        })
        if (finalAdded.length === 0) return
        stats.labelsAdded += finalAdded.length
        if (!dryRun) {
          await prisma.contentMetrics.update({
            where: { id: item.contentMetrics.id },
            data: { sensitiveWarnings: merged },
          })
        }
        stats.updated++
      }),
    )
  }

  const lastId = items.length > 0 ? items[items.length - 1].id : null
  return NextResponse.json({
    success: true,
    dryRun,
    done: items.length < limit,
    lastId,
    stats,
    details,
  })
}
