/**
 * One-shot mass import of young-audience (0–7) movies to fill the
 * starved tout-petits / enfants buckets. Drives the existing
 * /api/admin/import/movies endpoint with the `young_kids` source,
 * walking TMDB pages in batches so each request stays under the 60s
 * serverless limit. Safe to re-run — the endpoint skips titles already
 * in the DB (skipExisting).
 *
 * Usage:
 *   SITE_URL=https://totemavise.com CRON_SECRET=xxx \
 *     npx tsx scripts/import-young-kids.ts [fromPage] [toPage]
 *
 * Defaults to pages 1..40 (~800 candidates, deduped to whatever's new).
 * Reads SITE_URL + CRON_SECRET from .env.local / .env if not inline.
 */
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

const SITE_URL = process.env.SITE_URL || process.env.NEXTAUTH_URL
const CRON_SECRET = process.env.CRON_SECRET

// TMDB caps /discover at 500 pages; young_kids realistically thins out
// well before then. Each endpoint call handles up to 10 pages.
const PAGES_PER_CALL = 10

async function importBatch(startPage: number): Promise<{
  imported: number
  skipped: number
  skippedNoFR: number
  errors: number
}> {
  const res = await fetch(`${SITE_URL}/api/admin/import/movies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify({
      source: "young_kids",
      pages: PAGES_PER_CALL,
      startPage,
      skipExisting: true,
    }),
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  }
  const json = (await res.json()) as {
    success: boolean
    stats: { imported: number; skipped: number; skippedNoFR: number; errors: number }
  }
  return json.stats
}

async function main() {
  if (!SITE_URL || !CRON_SECRET) {
    console.error("Missing SITE_URL or CRON_SECRET (set inline or in .env.local).")
    process.exit(1)
  }

  const fromPage = Number(process.argv[2]) || 1
  const toPage = Number(process.argv[3]) || 40

  console.log(`Mass young-kids import: pages ${fromPage}..${toPage} via ${SITE_URL}`)

  const totals = { imported: 0, skipped: 0, skippedNoFR: 0, errors: 0 }
  for (let start = fromPage; start <= toPage; start += PAGES_PER_CALL) {
    const end = Math.min(start + PAGES_PER_CALL - 1, toPage)
    process.stdout.write(`  pages ${start}-${end}… `)
    try {
      const s = await importBatch(start)
      totals.imported += s.imported
      totals.skipped += s.skipped
      totals.skippedNoFR += s.skippedNoFR
      totals.errors += s.errors
      console.log(
        `+${s.imported} new (skipped ${s.skipped} existing, ${s.skippedNoFR} non-FR, ${s.errors} err)`,
      )
    } catch (e) {
      console.log(`FAILED: ${e instanceof Error ? e.message : e}`)
    }
    // Breathe between calls — the endpoint itself hits TMDB hard.
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log(
    `\nDone. Imported ${totals.imported} new young-audience movies ` +
      `(${totals.skipped} already in DB, ${totals.skippedNoFR} non-FR, ${totals.errors} errors).`,
  )
}

main()
