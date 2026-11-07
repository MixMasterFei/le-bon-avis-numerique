// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { VALID_SENSITIVE_WARNINGS } from "@/lib/sensitive-warnings"

/**
 * F02 — the PREPARED (not applied) correction for « Amélie et la métaphysique
 * des tubes », run on an in-process Postgres with the real freshness trigger,
 * before anyone runs it on production. Same table shapes as
 * data-freshness-migration.test.ts (production column names).
 */

const CORRECTION = readFileSync(path.join(process.cwd(), "sql/correct_amelie_metaphysique_des_tubes_warnings.sql"), "utf8")
const FRESHNESS = readFileSync(path.join(process.cwd(), "sql/add_data_freshness_columns.sql"), "utf8")
const AMELIE = "e286693a-d577-4da7-8f3f-df2ff360bc28"

let db: PGlite

async function state() {
  const { rows } = await db.query<{ warnings: string[]; bullets: string[]; at: string | null; updated: string }>(
    `SELECT cm.sensitive_warnings AS warnings, cm.what_parents_need_to_know AS bullets,
            to_char(cm.sensitive_warnings_at, 'YYYY-MM-DD') AS at,
            to_char(m.content_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS updated
     FROM content_metrics cm JOIN media_items m ON m.id = cm.media_id WHERE cm.media_id = $1`,
    [AMELIE],
  )
  return rows[0]
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE TYPE "MediaType" AS ENUM ('MOVIE', 'TV', 'GAME', 'BOOK', 'APP', 'MANGA');
    CREATE TABLE media_items (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, type "MediaType" NOT NULL,
      expert_age_rec INTEGER, synopsis_fr TEXT, release_status TEXT,
      platforms TEXT[] NOT NULL DEFAULT '{}', data_quality_score INTEGER NOT NULL DEFAULT 0,
      is_enriched BOOLEAN NOT NULL DEFAULT false, last_verified_at TIMESTAMPTZ(6),
      streaming_checked_at TIMESTAMPTZ(6),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL
    );
    CREATE TABLE content_metrics (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL UNIQUE REFERENCES media_items(id) ON DELETE CASCADE,
      violence INTEGER NOT NULL DEFAULT 0, sex_nudity INTEGER NOT NULL DEFAULT 0,
      language INTEGER NOT NULL DEFAULT 0, consumerism INTEGER NOT NULL DEFAULT 0,
      substance_use INTEGER NOT NULL DEFAULT 0, positive_messages INTEGER NOT NULL DEFAULT 0,
      role_models INTEGER NOT NULL DEFAULT 0, what_parents_need_to_know TEXT[],
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL,
      enrichment_confidence DOUBLE PRECISION, enrichment_source TEXT NOT NULL DEFAULT 'METADATA_ONLY',
      needs_deep_enrich BOOLEAN NOT NULL DEFAULT false, tone_tags TEXT[] DEFAULT '{}',
      pacing TEXT, visual_style TEXT, emotional_themes TEXT[] DEFAULT '{}',
      sensitive_warnings TEXT[] DEFAULT '{}', sensitive_warnings_at TIMESTAMP(3),
      pass1_at TIMESTAMP(3), pass2_at TIMESTAMP(3)
    );
  `)
  await db.exec(FRESHNESS)
  // The row as the live site serves it (basic pass of 2026-08-04, no flags).
  await db.query(
    `INSERT INTO media_items (id, title, type, expert_age_rec, synopsis_fr, is_enriched, created_at, updated_at)
     VALUES ($1, 'Amélie et la métaphysique des tubes', 'MOVIE', 8, 'Un synopsis.', true, '2026-06-01', '2026-11-06')`,
    [AMELIE],
  )
  await db.query(
    `INSERT INTO content_metrics (id, media_id, violence, language, positive_messages, role_models,
       what_parents_need_to_know, updated_at, enrichment_confidence, enrichment_source,
       sensitive_warnings, sensitive_warnings_at)
     VALUES ('cm-amelie', $1, 1, 1, 4, 4, ARRAY['Un point déjà présent.'], '2026-08-04',
       0.72, 'AI_BASIC', '{}', '2026-08-04')`,
    [AMELIE],
  )
  await db.query(`UPDATE media_items SET content_updated_at = '2026-08-04 06:29:35+00' WHERE id = $1`, [AMELIE])
})

describe("Amélie warnings correction (prepared, not applied)", () => {
  it("only writes closed-vocabulary categories, and never words a drowning as a suicide attempt", async () => {
    await db.exec(CORRECTION)
    const after = await state()
    for (const c of after.warnings) expect(VALID_SENSITIVE_WARNINGS as readonly string[]).toContain(c)
    // The source (BBFC) describes falls into water and a rescue — nothing more.
    expect([...after.warnings, ...after.bullets].join(" ")).not.toMatch(/suicid/i)
  })

  it("adds the flags, appends the three bullets after the existing ones, and dates the fiche", async () => {
    await db.exec(CORRECTION)
    const after = await state()
    expect(after.warnings).toEqual(["Noyade", "Thèmes de mort ou de deuil", "Guerre", "Détresse émotionnelle", "Mort d'un animal"])
    expect(after.bullets[0]).toBe("Un point déjà présent.")
    expect(after.bullets).toHaveLength(4)
    expect(after.bullets.join(" ")).toContain("avant d'être secourue")
    expect(after.at).not.toBe("2026-08-04")
    // The real content_metrics trigger moved « Fiche mise à jour le ».
    expect(after.updated).not.toBe("2026-08-04")
  })

  it("is a no-op the second time, and if the warnings were edited in the meantime", async () => {
    await db.exec(CORRECTION)
    const once = await state()
    await db.exec(CORRECTION)
    expect(await state()).toEqual(once)

    await db.query(`UPDATE content_metrics SET sensitive_warnings = ARRAY['Guerre'], what_parents_need_to_know = ARRAY['Édité à la main.'] WHERE media_id = $1`, [AMELIE])
    await db.exec(CORRECTION)
    const edited = await state()
    expect(edited.warnings).toEqual(["Guerre"])
    expect(edited.bullets).toEqual(["Édité à la main."])
  })
})
