// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { PGlite } from "@electric-sql/pglite"

/**
 * Runs the REAL migrations (data freshness, then game facts) on an in-process
 * Postgres and checks the content_updated_at contract for the game facts:
 *   - a changed fact moves it, a rewrite of the same value does not,
 *   - the bookkeeping columns (source, checked_at) never move it,
 *   - the age and synopsis rules of the earlier migration still hold,
 *   - a re-run is harmless.
 */

const FRESHNESS = readFileSync(path.join(process.cwd(), "sql/add_data_freshness_columns.sql"), "utf8")
const GAME_FACTS = readFileSync(path.join(process.cwd(), "sql/add_game_facts.sql"), "utf8")
const OLD = "2020-01-01 00:00:00+00"

let db: PGlite

async function pinOld(id: string) {
  await db.query(`UPDATE media_items SET content_updated_at = $1::timestamptz WHERE id = $2`, [OLD, id])
}

async function isOld(id: string): Promise<boolean> {
  const { rows } = await db.query<{ old: boolean }>(
    `SELECT content_updated_at = $1::timestamptz AS old FROM media_items WHERE id = $2`,
    [OLD, id],
  )
  return rows[0].old
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
      data_quality_score INTEGER NOT NULL DEFAULT 0,
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
      updated_at TIMESTAMP(3) NOT NULL,
      tone_tags TEXT[] DEFAULT '{}',
      pacing TEXT,
      visual_style TEXT,
      emotional_themes TEXT[] DEFAULT '{}',
      sensitive_warnings TEXT[] DEFAULT '{}'
    );
  `)
  await db.exec(FRESHNESS)
  await db.exec(GAME_FACTS)
  await db.query(
    `INSERT INTO media_items (id, title, type, expert_age_rec, synopsis_fr, updated_at)
     VALUES ('g1', 'Jeu', 'GAME', 10, 'Un synopsis.', '2026-11-06 04:15:00')`,
  )
})

describe("add_game_facts.sql", () => {
  it("adds the twelve nullable columns, all NULL on existing rows", async () => {
    const { rows } = await db.query<Record<string, unknown>>(
      `SELECT game_online_play, game_local_play, game_split_screen, game_min_players,
              game_max_players, game_in_game_purchases, game_developer, game_publisher,
              game_series, game_time_to_beat_hours, game_facts_source, game_facts_checked_at
         FROM media_items WHERE id = 'g1'`,
    )
    expect(Object.values(rows[0]).every((v) => v === null)).toBe(true)
  })

  it("moves content_updated_at when a visible fact appears or changes", async () => {
    await pinOld("g1")
    await db.exec(`UPDATE media_items SET game_online_play = true, game_max_players = 4 WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(false)

    await pinOld("g1")
    await db.exec(`UPDATE media_items SET game_series = 'Mario Kart' WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(false)

    await pinOld("g1")
    await db.exec(`UPDATE media_items SET game_time_to_beat_hours = 12.5 WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(false)
  })

  it("does not move it on a re-read that finds the same values", async () => {
    await pinOld("g1")
    await db.exec(
      `UPDATE media_items SET game_online_play = true, game_max_players = 4, game_series = 'Mario Kart',
              game_time_to_beat_hours = 12.5, game_facts_checked_at = now(),
              game_facts_source = 'igdb:multiplayer_modes'
        WHERE id = 'g1'`,
    )
    expect(await isOld("g1")).toBe(true)
  })

  it("never moves it for bookkeeping alone", async () => {
    await pinOld("g1")
    await db.exec(`UPDATE media_items SET game_facts_checked_at = now(), game_facts_source = 'x' WHERE id = 'g1'`)
    await db.exec(`UPDATE media_items SET data_quality_score = 80 WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(true)
  })

  it("keeps the age and synopsis rules of the freshness migration", async () => {
    await pinOld("g1")
    await db.exec(`UPDATE media_items SET expert_age_rec = 12 WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(false)
    await pinOld("g1")
    await db.exec(`UPDATE media_items SET synopsis_fr = 'Autre.' WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(false)
    await pinOld("g1")
    await db.exec(`UPDATE media_items SET expert_age_rec = 12 WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(true)
  })

  it("is idempotent", async () => {
    await db.exec(GAME_FACTS)
    await pinOld("g1")
    await db.exec(`UPDATE media_items SET game_split_screen = true WHERE id = 'g1'`)
    expect(await isOld("g1")).toBe(false)
  })
})
