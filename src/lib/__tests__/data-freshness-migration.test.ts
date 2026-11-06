// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { PGlite } from "@electric-sql/pglite"

/**
 * Runs the REAL migration (sql/add_data_freshness_columns.sql) on an
 * in-process Postgres and checks the content_updated_at contract:
 *   - moves when the age, the synopsis or the content analysis changes,
 *   - does NOT move on bookkeeping writes (quality job, cursors, flags) nor on
 *     a rewrite of an identical value,
 *   - existing rows get a one-time estimate that ignores the churned
 *     updated_at, and a re-run never overwrites trigger-maintained values.
 *
 * Tables mirror the production columns (names from the @map attributes in
 * prisma/schema.prisma, as they were before this migration).
 */

const MIGRATION = readFileSync(path.join(process.cwd(), "sql/add_data_freshness_columns.sql"), "utf8")
const OLD = "2020-01-01 00:00:00+00"

let db: PGlite

async function contentUpdatedAt(id: string): Promise<string> {
  const { rows } = await db.query<{ at: string }>(
    `SELECT to_char(content_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS at FROM media_items WHERE id = $1`,
    [id],
  )
  return rows[0].at
}

/** Pins content_updated_at to an old sentinel so a later bump is visible. */
async function pinOld(id: string) {
  await db.query(`UPDATE media_items SET content_updated_at = $1::timestamptz WHERE id = $2`, [OLD, id])
}

const isOld = async (id: string) => (await contentUpdatedAt(id)) === "2020-01-01 00:00:00"

async function insertMedia(id: string, extra: { created?: string } = {}) {
  await db.query(
    `INSERT INTO media_items (id, title, type, expert_age_rec, synopsis_fr, created_at, updated_at)
     VALUES ($1, $1, 'MOVIE', 10, 'Un synopsis.', $2, '2026-11-06 04:15:00')`,
    [id, extra.created ?? "2026-01-01 00:00:00"],
  )
}

async function insertMetrics(mediaId: string, updatedAt = "2026-07-15 10:00:00") {
  await db.query(
    `INSERT INTO content_metrics (id, media_id, violence, what_parents_need_to_know, updated_at)
     VALUES ($1, $2, 2, ARRAY['Quelques bagarres.'], $3)`,
    [`cm-${mediaId}`, mediaId, updatedAt],
  )
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV', 'GAME', 'BOOK', 'APP', 'MANGA');
    CREATE TABLE media_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type "MediaType" NOT NULL,
      expert_age_rec INTEGER,
      synopsis_fr TEXT,
      release_status TEXT,
      platforms TEXT[] NOT NULL DEFAULT '{}',
      data_quality_score INTEGER NOT NULL DEFAULT 0,
      is_enriched BOOLEAN NOT NULL DEFAULT false,
      last_verified_at TIMESTAMPTZ(6),
      streaming_checked_at TIMESTAMPTZ(6),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL
    );
    CREATE TABLE content_metrics (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL UNIQUE REFERENCES media_items(id) ON DELETE CASCADE,
      violence INTEGER NOT NULL DEFAULT 0,
      sex_nudity INTEGER NOT NULL DEFAULT 0,
      language INTEGER NOT NULL DEFAULT 0,
      consumerism INTEGER NOT NULL DEFAULT 0,
      substance_use INTEGER NOT NULL DEFAULT 0,
      positive_messages INTEGER NOT NULL DEFAULT 0,
      role_models INTEGER NOT NULL DEFAULT 0,
      what_parents_need_to_know TEXT[],
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL,
      enrichment_confidence DOUBLE PRECISION,
      enrichment_source TEXT NOT NULL DEFAULT 'METADATA_ONLY',
      needs_deep_enrich BOOLEAN NOT NULL DEFAULT false,
      tone_tags TEXT[] DEFAULT '{}',
      pacing TEXT,
      visual_style TEXT,
      emotional_themes TEXT[] DEFAULT '{}',
      sensitive_warnings TEXT[] DEFAULT '{}',
      sensitive_warnings_at TIMESTAMP(3),
      pass1_at TIMESTAMP(3),
      pass2_at TIMESTAMP(3)
    );
  `)

  // Pre-existing catalogue: every row carries the churned updated_at of the
  // last quality run (2026-11-06), which the backfill must ignore.
  await insertMedia("analysed", { created: "2026-03-01 08:00:00" })
  await insertMetrics("analysed", "2026-07-15 10:00:00")
  await insertMedia("provisional", { created: "2026-05-01 00:00:00" })
  await insertMedia("reanalysed-before-import-date", { created: "2026-08-01 12:00:00" })
  await insertMetrics("reanalysed-before-import-date", "2026-06-01 09:00:00")

  // Timestamps are UTC wall-clock; prove the backfill doesn't depend on the
  // session time zone.
  await db.exec(`SET TIME ZONE 'Europe/Paris'`)
  await db.exec(MIGRATION)
  await db.exec(`SET TIME ZONE 'UTC'`)
})

describe("migration — one-time backfill", () => {
  it("dates an analysed fiche by its last analysis write, not by the churned updated_at", async () => {
    expect(await contentUpdatedAt("analysed")).toBe("2026-07-15 10:00:00")
  })

  it("dates a fiche without analysis by its import", async () => {
    expect(await contentUpdatedAt("provisional")).toBe("2026-05-01 00:00:00")
  })

  it("never dates content before the fiche existed", async () => {
    expect(await contentUpdatedAt("reanalysed-before-import-date")).toBe("2026-08-01 12:00:00")
  })

  it("is idempotent: a re-run keeps trigger-maintained values", async () => {
    await pinOld("provisional")
    await db.exec(MIGRATION)
    expect(await isOld("provisional")).toBe(true)
  })

  it("stamps new rows on insert and adds the two nullable cursors", async () => {
    await insertMedia("fresh-import")
    const { rows } = await db.query<{ recent: boolean; tmdb: string | null; sim: string | null }>(
      `SELECT content_updated_at > now() - interval '1 minute' AS recent,
              tmdb_checked_at AS tmdb, similarity_computed_at AS sim
       FROM media_items WHERE id = 'fresh-import'`,
    )
    expect(rows[0]).toEqual({ recent: true, tmdb: null, sim: null })
  })
})

describe("trigger — media_items", () => {
  it("does not move on the quality job's write (score, isEnriched, updated_at)", async () => {
    await insertMedia("quality")
    await pinOld("quality")
    await db.exec(`UPDATE media_items SET data_quality_score = 75, is_enriched = true, updated_at = now() WHERE id = 'quality'`)
    expect(await isOld("quality")).toBe(true)
  })

  it("does not move on cursors and bookkeeping (similarity, TMDB, streaming)", async () => {
    await insertMedia("cursors")
    await pinOld("cursors")
    await db.exec(`
      UPDATE media_items SET similarity_computed_at = now() WHERE id = 'cursors';
      UPDATE media_items SET tmdb_checked_at = now(), release_status = 'Released' WHERE id = 'cursors';
      UPDATE media_items SET platforms = ARRAY['Netflix'], streaming_checked_at = now() WHERE id = 'cursors';
    `)
    expect(await isOld("cursors")).toBe(true)
  })

  it("moves when the age changes", async () => {
    await insertMedia("age")
    await pinOld("age")
    await db.exec(`UPDATE media_items SET expert_age_rec = 12 WHERE id = 'age'`)
    expect(await isOld("age")).toBe(false)
  })

  it("does not move when the age is rewritten with the same value", async () => {
    await insertMedia("same-age")
    await pinOld("same-age")
    await db.exec(`UPDATE media_items SET expert_age_rec = 10, synopsis_fr = 'Un synopsis.' WHERE id = 'same-age'`)
    expect(await isOld("same-age")).toBe(true)
  })

  it("moves when the synopsis changes, including to or from NULL", async () => {
    await insertMedia("synopsis")
    await pinOld("synopsis")
    await db.exec(`UPDATE media_items SET synopsis_fr = NULL WHERE id = 'synopsis'`)
    expect(await isOld("synopsis")).toBe(false)
  })
})

describe("trigger — content_metrics", () => {
  it("moves when an analysis is created", async () => {
    await insertMedia("first-analysis")
    await pinOld("first-analysis")
    await insertMetrics("first-analysis")
    expect(await isOld("first-analysis")).toBe(false)
  })

  it("moves when a score, a parent note or a warning changes", async () => {
    for (const [i, set] of [
      "violence = 4",
      "what_parents_need_to_know = ARRAY['Combats intenses.']",
      "sensitive_warnings = ARRAY['Scènes effrayantes ou angoissantes']",
      "tone_tags = ARRAY['sombre']",
    ].entries()) {
      const id = `metric-change-${i}`
      await insertMedia(id)
      await insertMetrics(id)
      await pinOld(id)
      await db.exec(`UPDATE content_metrics SET ${set} WHERE media_id = '${id}'`)
      expect(await isOld(id), set).toBe(false)
    }
  })

  it("does not move on bookkeeping columns or an identical rewrite", async () => {
    await insertMedia("metric-bookkeeping")
    await insertMetrics("metric-bookkeeping")
    await pinOld("metric-bookkeeping")
    await db.exec(`
      UPDATE content_metrics
         SET needs_deep_enrich = true, enrichment_source = 'AI', enrichment_confidence = 0.8,
             pass1_at = now(), sensitive_warnings_at = now(), updated_at = now(),
             violence = 2, what_parents_need_to_know = ARRAY['Quelques bagarres.']
       WHERE media_id = 'metric-bookkeeping'`)
    expect(await isOld("metric-bookkeeping")).toBe(true)
  })

  it("moves when the analysis is withdrawn (revert-unreleased deletes it)", async () => {
    await insertMedia("withdrawn")
    await insertMetrics("withdrawn")
    await pinOld("withdrawn")
    await db.exec(`DELETE FROM content_metrics WHERE media_id = 'withdrawn'`)
    expect(await isOld("withdrawn")).toBe(false)
  })

  it("moves both fiches when an analysis is re-parented (dedupe)", async () => {
    await insertMedia("dup-source")
    await insertMedia("dup-target")
    await insertMetrics("dup-source")
    await pinOld("dup-source")
    await pinOld("dup-target")
    await db.exec(`UPDATE content_metrics SET media_id = 'dup-target' WHERE media_id = 'dup-source'`)
    expect(await isOld("dup-source")).toBe(false)
    expect(await isOld("dup-target")).toBe(false)
  })

  it("lets a fiche be deleted with its analysis (cascade) without error", async () => {
    await insertMedia("deleted")
    await insertMetrics("deleted")
    await db.exec(`DELETE FROM media_items WHERE id = 'deleted'`)
    const { rows } = await db.query(`SELECT 1 FROM content_metrics WHERE media_id = 'deleted'`)
    expect(rows).toHaveLength(0)
  })
})
