// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { PGlite } from "@electric-sql/pglite"

/**
 * Runs the REAL migration (sql/add_totem_message_telemetry.sql) on an
 * in-process Postgres whose totem_messages mirrors production as it is today
 * (009_totem_assistant.sql + add_totem_message_token_usage.sql).
 */
const MIGRATION = readFileSync(path.join(process.cwd(), "sql/add_totem_message_telemetry.sql"), "utf8")

let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE TABLE totem_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls JSONB,
      tool_results JSONB,
      cited_media_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      model_used TEXT,
      latency_ms INTEGER,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      input_tokens integer,
      output_tokens integer,
      cached_input_tokens integer
    );
    INSERT INTO totem_messages (id, conversation_id, role, content, input_tokens, cached_input_tokens)
    VALUES ('old', 'c', 'assistant', 'avant', 44000, 24200);
  `)
  await db.exec(MIGRATION)
})

describe("sql/add_totem_message_telemetry.sql", () => {
  it("adds the five nullable columns and leaves existing rows untouched", async () => {
    const { rows } = await db.query<Record<string, unknown>>(`SELECT * FROM totem_messages WHERE id = 'old'`)
    expect(rows[0]).toMatchObject({
      input_tokens: 44000,
      cached_input_tokens: 24200,
      uncached_input_tokens: null,
      cache_write_input_tokens: null,
      routing_reason: null,
      finish_reason: null,
      model_messages: null,
    })
  })

  it("stores what the chat route now writes", async () => {
    await db.query(
      `INSERT INTO totem_messages (id, conversation_id, role, content, uncached_input_tokens, cache_write_input_tokens,
         routing_reason, finish_reason, model_messages)
       VALUES ('new', 'c', 'assistant', 'après', 200, 100, 'default', 'client_disconnected', $1::jsonb)`,
      [JSON.stringify([{ role: "assistant", content: [{ type: "text", text: "après" }] }])],
    )
    const { rows } = await db.query<{ model_messages: unknown; finish_reason: string }>(
      `SELECT model_messages, finish_reason FROM totem_messages WHERE id = 'new'`,
    )
    expect(rows[0].finish_reason).toBe("client_disconnected")
    expect(rows[0].model_messages).toEqual([{ role: "assistant", content: [{ type: "text", text: "après" }] }])
  })

  it("is idempotent", async () => {
    await expect(db.exec(MIGRATION)).resolves.toBeDefined()
  })
})
