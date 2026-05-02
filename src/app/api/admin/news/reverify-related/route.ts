import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isCronOrAdminAuthorized } from "@/lib/cron-auth"
import { logCronRun } from "@/lib/cron-log"
import { loadCatalogIndex, extractCatalogMatches, findInCatalog, type LinkableMedia } from "@/lib/news-linkify"
import { verifyCatalogSubjects } from "@/lib/news-subject-verify"

// Backfill — re-runs the catalog-subject pipeline on already-published
// stories whose `relatedMediaIds` were stamped by the pre-verifier
// linkifier (text-only scan, no LLM check). Strips off candidates
// that aren't actually the article's subject so the related-items
// mini-cards on the story page stop showing unrelated movies/series/
// games.
//
// Same shape as /api/admin/news/reprocess-images: cursor-paginated
// internally, 50s safety bail, returns { done } so the Operations
// Center auto-loop can clear the backlog across multiple invocations.
//
// Idempotent — re-running on a story whose subjects already pass
// verification is a no-op (same input → same LLM verdict, modulo
// model nondeterminism). We re-run the WHOLE pipeline (extract +
// verify) rather than just verify the existing relatedMediaIds,
// because the existing list may have been truncated to 3 by the
// pre-verifier linkifier and dropping false positives could leave
// room for valid candidates that were squeezed out.

const BATCH_SIZE = 25 // Each story = one LLM call, so keep batches small.

export async function POST(req: NextRequest) {
  if (!(await isCronOrAdminAuthorized(req))) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const startTime = Date.now()
  let scanned = 0
  let updated = 0
  let cleared = 0      // had candidates → ended with empty (all rejected by verifier)
  let unchanged = 0    // verifier kept the same set
  const verdicts: Record<string, number> = {}
  let lastId: string | null = null

  try {
    const catalogIndex = await loadCatalogIndex()
    if (catalogIndex.length === 0) {
      return NextResponse.json({ error: "Catalogue vide" }, { status: 500 })
    }

    // Caller (Operations Center auto-loop or curl) passes ?afterId=<id>
    // to resume from where the previous invocation bailed. First call
    // has no afterId and starts from the lowest id in the table.
    const url = new URL(req.url)
    const afterId = url.searchParams.get("afterId") ?? undefined
    let cursor: string | undefined = afterId

    while (true) {
      // Re-verify every PUBLISHED story. Stories with empty
      // relatedMediaIds still go through extractCatalogMatches —
      // they may have *gained* candidates as the catalog grew, and
      // the original linkifier didn't re-run after publish.
      const rows = await prisma.newsStory.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, summary: true, body: true, relatedMediaIds: true },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (rows.length === 0) break

      for (const row of rows) {
        scanned++
        const candidateIds = extractCatalogMatches(row.body, catalogIndex, 3)
        const candidates = candidateIds
          .map((id) => findInCatalog(catalogIndex, id))
          .filter((m): m is LinkableMedia => !!m)
          .map((m) => ({ id: m.id, title: m.title, type: m.type, year: m.releaseYear }))

        const verifiedIds = candidates.length > 0
          ? await verifyCatalogSubjects(
              { title: row.title, summary: row.summary, body: row.body },
              candidates,
            )
          : []

        const before = (row.relatedMediaIds ?? []).join(",")
        const after = verifiedIds.join(",")
        if (before === after) {
          unchanged++
          continue
        }

        await prisma.newsStory.update({
          where: { id: row.id },
          data: {
            relatedMediaIds: verifiedIds,
            relatedMediaId: verifiedIds[0] ?? null,
          },
        })
        updated++
        if ((row.relatedMediaIds ?? []).length > 0 && verifiedIds.length === 0) cleared++

        const verdict = `${(row.relatedMediaIds ?? []).length}->${verifiedIds.length}`
        verdicts[verdict] = (verdicts[verdict] ?? 0) + 1
      }

      cursor = rows[rows.length - 1]!.id
      lastId = cursor

      // Safety bail. ~25 LLM calls per batch can take 10-30s.
      if (Date.now() - startTime > 50_000) break
    }

    // How many PUBLISHED stories still come AFTER the last id we
    // touched? If 0, the auto-loop stops; otherwise it re-invokes
    // with afterId=lastId to resume.
    const remaining = lastId
      ? await prisma.newsStory.count({
          where: { status: "PUBLISHED", id: { gt: lastId } },
        })
      : 0
    const done = remaining === 0

    await logCronRun({
      task: "news.reverifyRelated",
      status: "success",
      summary: `Re-vérifié ${scanned} stories — ${updated} mises à jour (${cleared} vidées, ${unchanged} inchangées)`,
      details: { scanned, updated, cleared, unchanged, remaining, verdicts },
      startTime,
    })

    return NextResponse.json({
      ok: true,
      done,
      processed: scanned,
      scanned,
      updated,
      cleared,
      unchanged,
      remaining,
      lastId,
      verdicts,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    await logCronRun({
      task: "news.reverifyRelated",
      status: "error",
      summary: `Échec après ${updated}/${scanned}: ${message}`,
      details: { scanned, updated, error: message },
      startTime,
    })
    console.error("[reverify-related] failed:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
