import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logCronRun } from "@/lib/cron-log"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { allowsInsecureLocalCron } from "@/lib/cron-credential"
import { getGameFactsRecords, getGameSeriesRecords, getGameTimeToBeats } from "@/lib/igdb"
import {
  createPacer,
  gameFactsSourceLabel,
  planGameFactsRun,
  type GameFactsPlan,
  type GameFactsRow,
} from "@/lib/game-facts"
import { GAME_PILOT_TREATED_IDS, isGamePilot, isGamePilotControl } from "@/lib/game-pilot"

/**
 * POST /api/cron/game-facts — dispatch-only (never scheduled).
 *
 *   ?pilot=1            the treated games of the pilot (src/lib/game-pilot.ts)
 *   ?ids=a,b,c          an explicit list of media ids (≤ 200)
 *   &dryRun=1           report what would change, write nothing
 *   &allowNonPilot=1    accept ids outside the pilot (see below)
 *
 * Reads the game database for exactly those games and writes the « Fiche
 * pratique » columns (sql/add_game_facts.sql). Never a sweep of the
 * catalogue: there is no default list.
 *
 * Guardrails:
 *  - CONTROL games are always refused: the pilot compares them unchanged.
 *  - Non-pilot ids are refused unless allowNonPilot=1: the facts move
 *    content_updated_at (sitemap lastmod, « Fiche mise à jour le »), and only
 *    pilot fiches render them for now.
 *  - Nothing is inferred: the mapper (src/lib/game-facts.ts) stores « oui »
 *    or a stated value, else NULL. A failed series / duration lookup keeps
 *    the stored value; a game the source no longer returns is left untouched.
 *  - Calls are paced at ≤ 4 req/s and batched (3 requests per 100 games).
 *  - Raw UPDATE: updated_at is not churned; the DB trigger stamps
 *    content_updated_at only when a visible fact actually changes.
 *  - One cron_logs row per run (task « game-facts »), dry runs included.
 *
 * Auth: the automation credential (CRON_JOB_ROUTES) or an ADMIN session.
 */

export const maxDuration = 60

const TASK = "game-facts"
const MAX_IDS = 200
const CHUNK = 100
const IGDB_MIN_INTERVAL_MS = 250 // ≤ 4 requests per second
const ID_PATTERN = /^[A-Za-z0-9_-]{5,64}$/

function truthy(v: string | null): boolean {
  return v === "1" || v === "true"
}

export async function POST(req: NextRequest) {
  if (!(allowsInsecureLocalCron() || (await isCronOrAdminAuthorized(req)))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = req.nextUrl.searchParams
  const dryRun = truthy(params.get("dryRun"))
  const pilot = truthy(params.get("pilot"))
  const allowNonPilot = truthy(params.get("allowNonPilot"))

  let ids: string[]
  if (pilot) {
    ids = [...GAME_PILOT_TREATED_IDS]
  } else {
    ids = [...new Set((params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))]
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "Liste vide : passer ?pilot=1 ou ?ids=…" }, { status: 400 })
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Au plus ${MAX_IDS} identifiants par appel` }, { status: 400 })
  }
  const malformed = ids.filter((id) => !ID_PATTERN.test(id))
  if (malformed.length) {
    return NextResponse.json({ error: "Identifiants invalides", malformed: malformed.slice(0, 10) }, { status: 400 })
  }
  const controls = ids.filter(isGamePilotControl)
  if (controls.length) {
    return NextResponse.json({ error: "Jeux témoins du pilote : aucune écriture", controls }, { status: 400 })
  }
  const nonPilot = ids.filter((id) => !isGamePilot(id))
  if (nonPilot.length && !allowNonPilot) {
    return NextResponse.json(
      { error: "Identifiants hors pilote (ajouter allowNonPilot=1 en connaissance de cause)", nonPilot: nonPilot.slice(0, 20) },
      { status: 400 },
    )
  }

  const startTime = Date.now()
  try {
    const rows = await prisma.mediaItem.findMany({
      where: { id: { in: ids }, type: "GAME", igdbId: { not: null } },
      select: {
        id: true,
        title: true,
        igdbId: true,
        gameOnlinePlay: true,
        gameLocalPlay: true,
        gameSplitScreen: true,
        gameMinPlayers: true,
        gameMaxPlayers: true,
        gameInGamePurchases: true,
        gameDeveloper: true,
        gamePublisher: true,
        gameSeries: true,
        gameTimeToBeatHours: true,
      },
    })
    const found = new Set(rows.map((r) => r.id))
    const skipped = ids.filter((id) => !found.has(id)) // not a game, no igdb id, or unknown

    const pace = createPacer(IGDB_MIN_INTERVAL_MS)
    const plans: GameFactsPlan[] = []
    const failedChunks: string[] = []
    const lookupFailures = { series: 0, timeToBeat: 0 }

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK) as GameFactsRow[]
      const igdbIds = chunk.map((r) => r.igdbId)
      try {
        const records = await pace(() => getGameFactsRecords(igdbIds))
        const series = await pace(() => getGameSeriesRecords(igdbIds))
        const ttb = await pace(() => getGameTimeToBeats(igdbIds))
        if (series === null) lookupFailures.series++
        if (ttb === null) lookupFailures.timeToBeat++
        plans.push(...planGameFactsRun(chunk, records, series, ttb))
      } catch (e) {
        failedChunks.push(`${chunk[0].id}…: ${e instanceof Error ? e.message : "erreur"}`)
      }
    }

    let written = 0
    const writeErrors: string[] = []
    if (!dryRun) {
      for (const p of plans) {
        if (p.outcome === "not-found") continue
        const f = p.facts
        try {
          // Always stamp the bookkeeping (a re-read happened); the trigger
          // moves content_updated_at only if a visible fact differs.
          await prisma.$executeRaw`
            UPDATE media_items SET
              game_online_play = ${f.onlinePlay},
              game_local_play = ${f.localPlay},
              game_split_screen = ${f.splitScreen},
              game_min_players = ${f.minPlayers},
              game_max_players = ${f.maxPlayers},
              game_in_game_purchases = ${f.inGamePurchases},
              game_developer = ${f.developer},
              game_publisher = ${f.publisher},
              game_series = ${f.series},
              game_time_to_beat_hours = ${f.timeToBeatHours},
              game_facts_source = ${gameFactsSourceLabel(f)},
              game_facts_checked_at = now()
            WHERE id = ${p.id} AND type = 'GAME'`
          if (p.outcome === "changed") written++
        } catch (e) {
          writeErrors.push(`${p.id}: ${e instanceof Error ? e.message : "erreur"}`)
        }
      }
    }

    const stats = {
      requested: ids.length,
      games: rows.length,
      skipped: skipped.length,
      notFound: plans.filter((p) => p.outcome === "not-found").length,
      changed: plans.filter((p) => p.outcome === "changed").length,
      unchanged: plans.filter((p) => p.outcome === "unchanged").length,
      written,
      failedChunks: failedChunks.length,
      writeErrors: writeErrors.length,
      lookupFailures,
    }
    const coverage = {
      onlinePlay: 0, localPlay: 0, splitScreen: 0, maxPlayers: 0, inGamePurchases: 0,
      developer: 0, publisher: 0, series: 0, timeToBeatHours: 0,
    }
    for (const p of plans) {
      if (p.outcome === "not-found") continue
      for (const k of Object.keys(coverage) as (keyof typeof coverage)[]) {
        if (p.facts[k] !== null) coverage[k]++
      }
    }

    const failed = failedChunks.length > 0 || writeErrors.length > 0
    const duration = Math.round((Date.now() - startTime) / 1000)
    const summary = dryRun
      ? `[dry-run] ${stats.changed} fiches changeraient, ${stats.unchanged} inchangées, ${stats.notFound} introuvables (${duration}s)`
      : `${written} fiches mises à jour, ${stats.unchanged} inchangées, ${stats.notFound} introuvables (${duration}s)`
    const details = {
      dryRun,
      pilot,
      stats,
      coverage,
      skipped: skipped.slice(0, 50),
      failedChunks,
      writeErrors: writeErrors.slice(0, 20),
      changes: plans
        .filter((p) => p.outcome === "changed")
        .slice(0, 100)
        .map((p) => (p.outcome === "not-found" ? null : { id: p.id, title: p.title, changes: p.changes })),
      notFound: plans.filter((p) => p.outcome === "not-found").map((p) => ({ id: p.id, igdbId: p.igdbId })),
    }

    await logCronRun({
      task: TASK,
      status: failed ? (plans.length ? "partial" : "error") : "success",
      summary,
      details,
      startTime,
    })
    return NextResponse.json({ success: !failed || plans.length > 0, summary, ...details })
  } catch (error) {
    await logCronRun({
      task: TASK,
      status: "error",
      summary: error instanceof Error ? error.message : "game-facts failed",
      details: { dryRun, pilot },
      startTime,
    })
    return NextResponse.json(
      { error: "game-facts failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
