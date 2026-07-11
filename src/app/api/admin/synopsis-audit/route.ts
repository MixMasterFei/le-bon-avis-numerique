import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { AUDIT_BATCH_SIZE, runAuditBatch, correctionPasses, type AuditItemInput } from "@/lib/synopsis-audit"

export const dynamic = "force-dynamic"
export const maxDuration = 300

// Grammar + naturalness audit of enriched synopsisFr text (see
// src/lib/synopsis-audit.ts for what "issue" means). Self-draining: targets
// synopsis_fr_checked_at IS NULL, most-popular first, marks every examined
// row as checked, and terminates on its own once the catalogue is covered —
// safe to run nightly forever (see cron.yml "Synopsis audit" + the nightly
// top-up folded into daily-enrich).
//   POST /api/admin/synopsis-audit?limit=120[&dryRun=1]
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "120")), 300)
  const dryRun = searchParams.get("dryRun") === "1" || searchParams.get("dryRun") === "true"

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 400 })
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const candidates = await prisma.mediaItem.findMany({
    where: { isEnriched: true, synopsisFr: { not: null }, synopsisFrCheckedAt: null },
    select: { id: true, title: true, type: true, synopsisFr: true },
    // Most-viewed titles audited first — highest reader impact per run.
    orderBy: { tmdbVoteCount: { sort: "desc", nulls: "last" } },
    take: limit,
  })

  const stats = { examined: 0, clean: 0, fixed: 0, flagged: 0, errors: 0 }
  const flaggedSample: string[] = []
  const fixedSample: { title: string; before: string; after: string }[] = []

  // Vercel Pro 300s ceiling, same headroom convention as backfill-game-styles
  // and enrich (per-batch OpenAI call capped at 35s).
  const TIME_BUDGET_MS = 265_000
  let bailedOnTime = false

  for (let i = 0; i < candidates.length; i += AUDIT_BATCH_SIZE) {
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      bailedOnTime = true
      break
    }
    const batch = candidates.slice(i, i + AUDIT_BATCH_SIZE)
    const items: AuditItemInput[] = batch.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      synopsis: m.synopsisFr!,
    }))

    const verdicts = await runAuditBatch(openai, items)
    const verdictById = new Map(verdicts.map((v) => [v.id, v]))

    for (const item of batch) {
      const verdict = verdictById.get(item.id)
      stats.examined++

      // The model dropped this id (parse failure, truncated response, etc.)
      // — leave it unchecked so the next run retries it.
      if (!verdict) {
        stats.errors++
        continue
      }

      if (!verdict.hasIssue) {
        stats.clean++
        if (!dryRun) {
          await prisma.mediaItem.update({ where: { id: item.id }, data: { synopsisFrCheckedAt: new Date() } })
        }
        continue
      }

      if (correctionPasses(item.synopsisFr!, verdict.corrected)) {
        stats.fixed++
        if (fixedSample.length < 15) {
          fixedSample.push({ title: item.title, before: item.synopsisFr!, after: verdict.corrected })
        }
        if (!dryRun) {
          await prisma.mediaItem.update({
            where: { id: item.id },
            data: { synopsisFr: verdict.corrected, synopsisFrCheckedAt: new Date() },
          })
        }
      } else {
        // Flagged, but the model's fix (if any) didn't clear the safety gate
        // — mark checked anyway (re-asking won't change the verdict) and
        // surface it in the log for a human pass rather than dropping it.
        stats.flagged++
        if (flaggedSample.length < 20) flaggedSample.push(`${item.title} (${verdict.issueType ?? "?"})`)
        if (!dryRun) {
          await prisma.mediaItem.update({ where: { id: item.id }, data: { synopsisFrCheckedAt: new Date() } })
        }
      }
    }

    await new Promise((r) => setTimeout(r, 300))
  }

  const remaining = await prisma.mediaItem.count({
    where: { isEnriched: true, synopsisFr: { not: null }, synopsisFrCheckedAt: null },
  })
  const done = remaining === 0

  await logCronRun({
    task: "synopsis-audit",
    status: stats.errors > 10 ? "partial" : bailedOnTime ? "partial" : "success",
    summary:
      candidates.length === 0
        ? "Rien à vérifier — catalogue à jour"
        : `${stats.examined} vérifiés, ${stats.fixed} corrigés, ${stats.flagged} signalés (${remaining} restants)${dryRun ? " [dryRun]" : ""}`,
    details: { ...stats, done, remaining, dryRun, bailedOnTime, flaggedSample, fixedSample },
    startTime,
  })

  return NextResponse.json({ success: true, done, remaining, stats, dryRun, fixedSample, flaggedSample })
}

// GET status: how much of the catalogue still needs a pass.
export async function GET() {
  const remaining = await prisma.mediaItem.count({
    where: { isEnriched: true, synopsisFr: { not: null }, synopsisFrCheckedAt: null },
  })
  const checked = await prisma.mediaItem.count({
    where: { isEnriched: true, synopsisFr: { not: null }, synopsisFrCheckedAt: { not: null } },
  })
  return NextResponse.json({ remaining, checked, total: remaining + checked })
}
