import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const maxDuration = 60

// Schema migrations to apply via raw SQL (Vercel-compatible)
const SCHEMA_MIGRATIONS = [
  {
    name: "add_original_language",
    description: "Add original_language column to media_items",
    sql: `ALTER TABLE media_items ADD COLUMN IF NOT EXISTS original_language VARCHAR(10)`,
  },
  {
    name: "add_number_of_seasons",
    description: "Add number_of_seasons column to media_items",
    sql: `ALTER TABLE media_items ADD COLUMN IF NOT EXISTS number_of_seasons INTEGER`,
  },
  {
    name: "add_original_language_index",
    description: "Add index on original_language",
    sql: `CREATE INDEX IF NOT EXISTS media_items_original_language_idx ON media_items(original_language)`,
  },
]

export async function POST() {
  const results: { name: string; success: boolean; error?: string }[] = []

  try {
    for (const migration of SCHEMA_MIGRATIONS) {
      try {
        await prisma.$executeRawUnsafe(migration.sql)
        results.push({ name: migration.name, success: true })
      } catch (error) {
        // Ignore "already exists" type errors
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (errorMsg.includes("already exists") || errorMsg.includes("duplicate")) {
          results.push({ name: migration.name, success: true })
        } else {
          results.push({ name: migration.name, success: false, error: errorMsg })
        }
      }
    }

    const allSuccess = results.every(r => r.success)

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? "Schema synchronized successfully"
        : "Some migrations failed",
      results,
    })
  } catch (error) {
    console.error("Database sync error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to sync database schema",
        results,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Check current column status in media_items table
  try {
    const columnCheck = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'media_items'
      ORDER BY column_name
    `

    const columns = columnCheck.map(c => c.column_name)

    const status = {
      original_language: columns.includes("original_language"),
      number_of_seasons: columns.includes("number_of_seasons"),
    }

    return NextResponse.json({
      success: true,
      columns,
      status,
      needsSync: !status.original_language || !status.number_of_seasons,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get schema status",
      },
      { status: 500 }
    )
  }
}
