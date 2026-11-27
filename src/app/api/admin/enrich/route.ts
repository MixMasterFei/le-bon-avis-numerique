import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { notUnreleasedWhere, unenrichedBacklogWhere } from "@/lib/enrich-filter"
import { getMovieKeywords, getTVKeywords } from "@/lib/tmdb"
import { applyContentSafetyFloors } from "@/lib/content-safety-floors"
import {
  VALID_TOPICS,
  buildEnrichmentMessages,
  filterToValidList,
  parseEnrichmentResponse,
  ENRICHMENT_MAX_COMPLETION_TOKENS,
  type ContentAnalysis,
  type EnrichmentPromptItem,
  enrichRunStatus,
} from "@/lib/enrichment-analysis"
import { buildTextCompletionParams, createTextCompletion, openaiTextModel } from "@/lib/openai-text-model"
import OpenAI from "openai"

// Vercel Pro lets us go up to 300s — same ceiling as /enrich-deep,
// /import-cnc-ratings, /news-discover. We need it because the text model
// occasionally takes 25-35s on a single analysis (especially mangas
// with the long manga rubric appended), and the previous 60s ceiling
// only fit 1-2 items per batch before bailing on time.
export const maxDuration = 300

// Batch enrichment API - Enrich items that don't have content metrics
// Uses the OpenAI text model (src/lib/openai-text-model.ts) to generate age
// ratings, content analysis, and v2 metadata. Prompt + parser live in
// src/lib/enrichment-analysis.ts.

interface EnrichmentResult {
  processed: number
  enriched: number
  skipped: number
  errors: number
  details: string[]
}

function computeFinalConfidence(
  aiConfidence: number,
  item: { synopsis: string | null; genres: string[]; officialRating: string | null; tmdbVoteCount: number | null }
): { score: number; needsDeepEnrich: boolean } {
  let score = Math.min(1.0, Math.max(0.0, aiConfidence))

  // Heuristic adjustments based on input data quality
  if (!item.synopsis || item.synopsis.length < 50) score *= 0.7
  if (item.genres.length === 0) score *= 0.8
  if (!item.officialRating) score *= 0.9
  if (item.tmdbVoteCount && item.tmdbVoteCount > 1000) score = Math.min(1.0, score * 1.1)

  score = Math.round(score * 100) / 100

  return { score, needsDeepEnrich: score < 0.6 }
}

/** Thrown when the model call itself failed (no answer, API error, timeout,
 *  unparseable JSON) — as opposed to a DB or keyword-fetch error. The status
 *  rule counts these to tell a dead model from a bad item. */
class ModelCallError extends Error {}

async function analyzeWithOpenAI(
  openai: OpenAI,
  item: EnrichmentPromptItem,
  tmdbKeywords: string[] = [],
  retryCount = 0
): Promise<ContentAnalysis> {
  try {
    // Per-call abort — the model occasionally takes 25-35s on a
    // single analysis (mangas in particular, with the long manga
    // rubric appended). Capping each call at 35s lets a slow item
    // finish without dragging neighbours into a timeout, and the
    // outer 270s loop budget still fits 5+ items even at the worst
    // per-call duration. OpenAI SDK default is 10 min — useless.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 35_000)
    let response
    try {
      // Reasoning tokens count against max_completion_tokens. With a
      // "medium" effort (the API default), 1500 tokens got eaten by
      // reasoning before any output was produced, so
      // .choices[0].message.content came back empty and the parser
      // threw "No response from OpenAI". The shared helper sends a low
      // effort ("none" by default, see src/lib/openai-text-model.ts) and
      // the 4000 budget gives the structured JSON output (~1k tokens)
      // comfortable room.
      response = await createTextCompletion(
        openai,
        buildTextCompletionParams({
          messages: buildEnrichmentMessages(item, tmdbKeywords),
          maxCompletionTokens: ENRICHMENT_MAX_COMPLETION_TOKENS,
        }),
        { signal: controller.signal },
      )
    } finally {
      clearTimeout(timer)
    }

    return parseEnrichmentResponse(response.choices[0]?.message?.content, item)
  } catch (error) {
    // Retry on rate limit or temporary errors (max 2 retries)
    if (retryCount < 2) {
      const isRateLimit = error instanceof Error &&
        (error.message.includes("rate") || error.message.includes("429") || error.message.includes("timeout"))

      if (isRateLimit) {
        // Wait longer for rate limit errors
        await new Promise((resolve) => setTimeout(resolve, 2000 * (retryCount + 1)))
        return analyzeWithOpenAI(openai, item, tmdbKeywords, retryCount + 1)
      }
    }
    if (error instanceof ModelCallError) throw error
    throw new ModelCallError(error instanceof Error ? error.message : String(error))
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await request.json()
    const {
      type = "all", // "movie", "tv", "game", or "all"
      limit = 10, // How many to process at once
      onlyMissing = true, // Only enrich items without contentMetrics
      onlyLegacy = false, // Only re-enrich items missing v2 fields (toneTags empty)
      recalibrate = false, // Re-enrich already-enriched items whose scores look
                           // over-calibrated under the old rubric (see below)
      mediaId, // When set, re-enrich EXACTLY this one item (forced, ignores the
               // batch modes above) — for targeted corrections of a single title.
    } = body

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 400 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result: EnrichmentResult = {
      processed: 0,
      enriched: 0,
      skipped: 0,
      errors: 0,
      details: [],
    }

    // Build query based on type.
    // MANGA is explicitly excluded from all automated enrichment pipelines:
    // the manga catalog is internal-only (not public) and should not consume
    // enrichment budget or appear in job logs. The weekly-manga import route
    // exists for historical data but is no longer called by cron (see cron.yml).
    const PUBLIC_TYPES = ["MOVIE", "TV", "GAME"] as const
    const typeFilter = type === "all"
      ? { type: { in: [...PUBLIC_TYPES] } }
      : type === "manga"
        ? { type: "MANGA" as const } // explicit single-title admin override only
        : { type: type.toUpperCase() as (typeof PUBLIC_TYPES)[number] }

    // Never fully enrich a title that hasn't been released yet — there's
    // no content to assess, so the model confabulates content metrics
    // (violence/language/etc.) from the premise alone and presents them
    // as a definitive evaluation. These titles stay "provisional" (age
    // estimate only, badged "à confirmer") until their release date
    // passes, then the cron picks them up. Preserves the documented
    // invariant: provisional ⟹ !isEnriched ⟹ no ContentMetrics.
    // Shared predicate (also drives the dashboard backlog count) lives in
    // src/lib/enrich-filter so all three agree on "enrichable". See there.
    const notUnreleased = notUnreleasedWhere()

    // Build where clause based on mode
    let whereClause
    if (mediaId) {
      // Targeted single-title re-enrichment (forced below).
      whereClause = { id: String(mediaId) }
    } else if (recalibrate) {
      // Re-enrich the genuinely over-scored cluster under the new rubric. NOT
      // every ≤12 title with a high axis — a 12+ live-action film with violence
      // 4 ("Important") is usually correct. The over-scoring concentrates in:
      //   • young titles (≤10) with a sensibility axis ≥4 (the Jungle-Cruise
      //     pattern: family adventure scored like a thriller), and
      //   • Animation / Famille titles with an axis ≥4 (cartoon peril scored
      //     like realistic violence — the old rubric had no stylized discount),
      // plus all-zero rows (likely a failed/empty pass).
      // Each item is marked `enrichmentSource: "AI_RECAL"` after processing and
      // excluded here, so repeated batches drain the set once and then no-op —
      // a clean, terminating sweep (the previous `updatedAt` guard was bumped by
      // unrelated crons and wrongly blocked most of the set).
      whereClause = {
        ...typeFilter,
        isEnriched: true,
        NOT: { contentMetrics: { enrichmentSource: "AI_RECAL" } },
        OR: [
          {
            AND: [
              {
                OR: [
                  { expertAgeRec: { not: null, lte: 10 } },
                  { genres: { hasSome: ["Animation", "Familial", "Family"] } },
                ],
              },
              {
                contentMetrics: {
                  OR: [
                    { violence: { gte: 4 } },
                    { sexNudity: { gte: 4 } },
                    { language: { gte: 4 } },
                    { substanceUse: { gte: 4 } },
                  ],
                },
              },
            ],
          },
          {
            contentMetrics: {
              is: { violence: 0, sexNudity: 0, language: 0, substanceUse: 0 },
            },
          },
        ],
      }
    } else if (onlyLegacy) {
      // Re-enrich items that have metrics but missing v2 fields
      whereClause = {
        ...typeFilter,
        contentMetrics: { isNot: null },
        OR: [
          { contentMetrics: { toneTags: { isEmpty: true } } },
          { contentMetrics: { enrichmentConfidence: null } },
          // Legacy rows enriched before the warnings feature: never computed
          // (null), as opposed to "computed, none found" (empty array). Using
          // the timestamp lets the sweep terminate instead of re-processing
          // warning-free titles forever.
          { contentMetrics: { sensitiveWarningsAt: null } },
        ],
      }
    } else if (onlyMissing) {
      // Filter on isEnriched: false to match what the dashboard reports
      // as "œuvres à enrichir". The previous filter (contentMetrics: null)
      // missed items that had a partial metrics row from a failed run
      // — they showed up on the dashboard counter but were invisible to
      // the enrichment cron + manual triggers, leaving a stuck backlog.
      whereClause = {
        ...typeFilter,
        isEnriched: false,
      }
    } else {
      whereClause = typeFilter
    }

    // Apply the release-date guard to every mode.
    whereClause = { AND: [whereClause, notUnreleased] }

    // Find items to enrich
    const items = await prisma.mediaItem.findMany({
      where: whereClause,
      include: { contentMetrics: true },
      orderBy: recalibrate
        ? { updatedAt: "asc" as const } // oldest-touched first → drains + terminates
        : onlyLegacy
          ? { tmdbVoteCount: { sort: "desc" as const, nulls: "last" as const } }
          : { createdAt: "desc" },
      take: Math.min(limit, 50), // Max 50 at a time
    })

    result.processed = items.length
    result.details.push(`Found ${items.length} items to enrich`)

    // Safety bail before Vercel's 300s function ceiling. With per-
    // item 35s OpenAI timeout (see analyzeWithOpenAI), worst case for
    // a single item is ~37s including post-processing + the inter-
    // item delay. Bail at 270s leaves ~30s headroom for a final
    // in-flight item to complete and the response to serialize back
    // before the gateway kill. Caller (auto-mode loop) re-invokes to
    // pick up the rest.
    const TIME_BUDGET_MS = 270_000
    let bailedOnTime = false
    // Items where the model was called, and those where the call itself
    // failed — so a dead model logs "error" instead of a quiet "partial".
    let modelAttempts = 0
    let modelFailures = 0

    for (const item of items) {
      try {
        // Skip if already has metrics and onlyMissing is true (but recalibrate
        // and a targeted mediaId deliberately re-process already-enriched items).
        if (onlyMissing && !onlyLegacy && !recalibrate && !mediaId && item.contentMetrics) {
          result.skipped++
          continue
        }

        if (Date.now() - startTime > TIME_BUDGET_MS) {
          bailedOnTime = true
          result.details.push(
            `⏱ Time budget reached (${Math.round((Date.now() - startTime) / 1000)}s); stopping early. ${result.enriched} enriched, ${items.length - result.enriched - result.errors - result.skipped} remaining in this batch.`,
          )
          break
        }

        // Best-effort TMDB keyword grounding (MOVIE/TV with a tmdbId only).
        // Never blocks enrichment: the fetchers swallow errors and return [].
        let tmdbKeywords: string[] = []
        if (item.tmdbId) {
          if (item.type === "MOVIE") tmdbKeywords = await getMovieKeywords(item.tmdbId)
          else if (item.type === "TV") tmdbKeywords = await getTVKeywords(item.tmdbId)
        }

        // Analyze with OpenAI
        modelAttempts++
        const analysis = await analyzeWithOpenAI(openai, {
          title: item.title,
          originalTitle: item.originalTitle,
          type: item.type,
          synopsis: item.synopsisFr,
          genres: item.genres,
          releaseDate: item.releaseDate,
          officialRating: item.officialRating,
          tmdbVoteCount: item.tmdbVoteCount,
          demographic: item.demographic,
          pegiDescriptors: item.pegiDescriptors,
        }, tmdbKeywords)

        // Deterministic safety stack (PEGI axis floors → age floor → young-age
        // metric clamp), shared verbatim with every other write path via
        // src/lib/content-safety-floors.ts. topics MUST union the item's
        // PERSISTED topics (deterministic, IGDB-derived — the reliable "Horreur"
        // signal) with the fresh analysis.tags, never the fresh tags alone:
        // VALID_TOPICS does not even contain "Horreur", so a horror floor keyed
        // on analysis.tags alone only fired by luck (bug found + fixed
        // 2026-07-11 after a re-enrichment pass wrongly LOWERED horror titles).
        const floored = applyContentSafetyFloors({
          expertAgeRec: analysis.expertAgeRec,
          metrics: analysis.contentMetrics,
          genres: item.genres,
          topics: [...item.topics, ...analysis.tags],
          visualStyle: analysis.visualStyle,
          type: item.type,
          officialRating: item.officialRating,
          pegiDescriptors: item.pegiDescriptors,
        })
        analysis.expertAgeRec = floored.expertAgeRec
        analysis.contentMetrics = floored.metrics

        // Mark recalibrated rows so the recalibrate sweep processes each once
        // and then terminates (see the recalibrate whereClause above).
        const enrichmentSource = recalibrate ? "AI_RECAL" : "AI_BASIC"

        // Compute final confidence with heuristic adjustments
        const { score: finalConfidence, needsDeepEnrich } = computeFinalConfidence(
          analysis.confidence,
          {
            synopsis: item.synopsisFr,
            genres: item.genres,
            officialRating: item.officialRating,
            tmdbVoteCount: item.tmdbVoteCount,
          }
        )

        // Update the item
        await prisma.mediaItem.update({
          where: { id: item.id },
          data: {
            expertAgeRec: analysis.expertAgeRec,
            synopsisFr: analysis.synopsis || item.synopsisFr,
            // A fresh synopsis needs a fresh grammar/tone pass — un-mark it so
            // the synopsis-audit sweep picks it back up instead of trusting a
            // check that ran against the PREVIOUS text.
            synopsisFrCheckedAt: null,
            topics: [...new Set([...item.topics, ...filterToValidList(analysis.tags, VALID_TOPICS)])],
            isEnriched: true,
          },
        })

        // Create or update content metrics with v2 fields
        await prisma.contentMetrics.upsert({
          where: { mediaId: item.id },
          update: {
            violence: analysis.contentMetrics.violence,
            sexNudity: analysis.contentMetrics.sexNudity,
            language: analysis.contentMetrics.language,
            consumerism: analysis.contentMetrics.consumerism,
            substanceUse: analysis.contentMetrics.substanceUse,
            positiveMessages: analysis.contentMetrics.positiveMessages,
            roleModels: analysis.contentMetrics.roleModels,
            whatParentsNeedToKnow: analysis.whatParentsNeedToKnow,
            // V2 fields
            enrichmentConfidence: finalConfidence,
            enrichmentSource,
            needsDeepEnrich,
            toneTags: analysis.toneTags,
            pacing: analysis.pacing || null,
            visualStyle: analysis.visualStyle || null,
            emotionalThemes: analysis.emotionalThemes,
            sensitiveWarnings: analysis.sensitiveWarnings,
            sensitiveWarningsAt: new Date(),
            pass1At: new Date(),
          },
          create: {
            mediaId: item.id,
            violence: analysis.contentMetrics.violence,
            sexNudity: analysis.contentMetrics.sexNudity,
            language: analysis.contentMetrics.language,
            consumerism: analysis.contentMetrics.consumerism,
            substanceUse: analysis.contentMetrics.substanceUse,
            positiveMessages: analysis.contentMetrics.positiveMessages,
            roleModels: analysis.contentMetrics.roleModels,
            whatParentsNeedToKnow: analysis.whatParentsNeedToKnow,
            // V2 fields
            enrichmentConfidence: finalConfidence,
            enrichmentSource,
            needsDeepEnrich,
            toneTags: analysis.toneTags,
            pacing: analysis.pacing || null,
            visualStyle: analysis.visualStyle || null,
            emotionalThemes: analysis.emotionalThemes,
            sensitiveWarnings: analysis.sensitiveWarnings,
            sensitiveWarningsAt: new Date(),
            pass1At: new Date(),
          },
        })

        result.enriched++
        result.details.push(`✓ Enriched: ${item.title} (age ${analysis.expertAgeRec}+, confidence ${finalConfidence}${needsDeepEnrich ? " → needs deep" : ""})`)

        // Delay to avoid rate limiting - longer for larger batches
        const delay = items.length > 20 ? 1000 : 500
        await new Promise((resolve) => setTimeout(resolve, delay))
      } catch (error) {
        result.errors++
        if (error instanceof ModelCallError) modelFailures++
        result.details.push(
          `✗ Error enriching ${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    }

    const status = enrichRunStatus({
      modelAttempts,
      modelFailures,
      errors: result.errors,
      bailedOnTime,
    })
    const modelDown = status === "error"
    await logCronRun({
      task: "enrich",
      status,
      summary:
        result.processed === 0
          ? `Backlog vide — rien a enrichir (${type})`
          : modelDown
            ? `Modèle indisponible ? ${modelFailures}/${modelAttempts} analyses en échec, 0 enrichi (${type}, ${openaiTextModel()})`
            : `${result.enriched} enrichis sur ${result.processed} (${type})${modelFailures > 0 ? ` — ${modelFailures}/${modelAttempts} analyses en échec` : ""}${bailedOnTime ? " — bailed on time" : ""}`,
      details: { ...result, type, bailedOnTime, modelAttempts, modelFailures, model: openaiTextModel() },
      startTime,
    })

    return NextResponse.json({
      success: true,
      result,
      bailedOnTime,
    })
  } catch (error) {
    console.error("Enrichment error:", error)

    await logCronRun({
      task: "enrich",
      status: "error",
      summary: error instanceof Error ? error.message : "Enrichment failed",
      startTime,
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Enrichment failed" },
      { status: 500 }
    )
  }
}

// GET to check enrichment status including v2 confidence distribution
export async function GET() {
  const stats = await prisma.mediaItem.groupBy({
    by: ["type"],
    _count: { id: true },
  })

  const withMetrics = await prisma.mediaItem.count({
    where: { contentMetrics: { isNot: null } },
  })

  // Backlog count = items the cron + manual triggers will actually
  // pick up. Mirrors the POST onlyMissing filter (isEnriched:false AND
  // released) so the dashboard, the script preflight, and the actual
  // processing all agree on what "needs enrichment" means. Unreleased
  // titles are excluded — enrich skips them, so counting them here would
  // show a backlog that never drains.
  const withoutMetrics = await prisma.mediaItem.count({
    where: unenrichedBacklogWhere(),
  })

  // Also count items missing age recommendation (even if they have empty metrics)
  const withoutAgeRec = await prisma.mediaItem.count({
    where: {
      OR: [
        { expertAgeRec: null },
        { expertAgeRec: 0 },
      ],
    },
  })

  // V2: Confidence distribution
  const confidenceHigh = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: { gte: 0.7 } },
  })
  const confidenceMedium = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: { gte: 0.4, lt: 0.7 } },
  })
  const confidenceLow = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: { lt: 0.4, not: null } },
  })
  const confidenceUnscored = await prisma.contentMetrics.count({
    where: { enrichmentConfidence: null },
  })
  const needsDeepEnrich = await prisma.contentMetrics.count({
    where: { needsDeepEnrich: true },
  })
  const deepEnriched = await prisma.contentMetrics.count({
    where: { enrichmentSource: "AI_DEEP" },
  })
  const hasV2Fields = await prisma.contentMetrics.count({
    where: { NOT: { toneTags: { isEmpty: true } } },
  })

  const recentlyEnriched = await prisma.mediaItem.findMany({
    where: { contentMetrics: { isNot: null } },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      title: true,
      type: true,
      expertAgeRec: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({
    stats: stats.reduce((acc, s) => ({ ...acc, [s.type]: s._count.id }), {}),
    enrichment: {
      withMetrics,
      withoutMetrics,
      withoutAgeRec,
      percentComplete: withMetrics + withoutMetrics > 0
        ? Math.round((withMetrics / (withMetrics + withoutMetrics)) * 100)
        : 0,
      // V2 stats
      confidenceDistribution: {
        high: confidenceHigh,
        medium: confidenceMedium,
        low: confidenceLow,
        unscored: confidenceUnscored,
      },
      needsDeepEnrich,
      deepEnriched,
      hasV2Fields,
    },
    recentlyEnriched,
  })
}
