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
  // New tables for admin dashboard redesign
  {
    name: "create_content_requests_table",
    description: "Create content_requests table for user content requests",
    sql: `CREATE TABLE IF NOT EXISTS content_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      media_type VARCHAR(20) NOT NULL,
      external_id VARCHAR(100),
      description TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      priority INTEGER DEFAULT 0,
      admin_notes TEXT,
      resolved_at TIMESTAMP,
      resolved_by UUID,
      media_id UUID REFERENCES media_items(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  },
  {
    name: "create_content_requests_indexes",
    description: "Create indexes for content_requests",
    sql: `CREATE INDEX IF NOT EXISTS content_requests_status_idx ON content_requests(status);
          CREATE INDEX IF NOT EXISTS content_requests_created_at_idx ON content_requests(created_at)`,
  },
  {
    name: "create_user_content_metrics_table",
    description: "Create user_content_metrics table for community ratings",
    sql: `CREATE TABLE IF NOT EXISTS user_content_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      media_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      violence INTEGER DEFAULT 0,
      sex_nudity INTEGER DEFAULT 0,
      language INTEGER DEFAULT 0,
      consumerism INTEGER DEFAULT 0,
      substance_use INTEGER DEFAULT 0,
      positive_messages INTEGER DEFAULT 0,
      role_models INTEGER DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(media_id, user_id)
    )`,
  },
  {
    name: "create_user_content_metrics_index",
    description: "Create index for user_content_metrics",
    sql: `CREATE INDEX IF NOT EXISTS user_content_metrics_media_id_idx ON user_content_metrics(media_id)`,
  },
  {
    name: "create_admin_activities_table",
    description: "Create admin_activities table for activity logging",
    sql: `CREATE TABLE IF NOT EXISTS admin_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id UUID,
      details TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`,
  },
  {
    name: "create_admin_activities_indexes",
    description: "Create indexes for admin_activities",
    sql: `CREATE INDEX IF NOT EXISTS admin_activities_created_at_idx ON admin_activities(created_at);
          CREATE INDEX IF NOT EXISTS admin_activities_user_id_idx ON admin_activities(user_id)`,
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
  // Check current column/table status
  try {
    const columnCheck = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'media_items'
      ORDER BY column_name
    `

    const tableCheck = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `

    const columns = columnCheck.map(c => c.column_name)
    const tables = tableCheck.map(t => t.table_name)

    const status = {
      original_language: columns.includes("original_language"),
      number_of_seasons: columns.includes("number_of_seasons"),
      content_requests: tables.includes("content_requests"),
      user_content_metrics: tables.includes("user_content_metrics"),
      admin_activities: tables.includes("admin_activities"),
    }

    const needsSync = !status.original_language ||
                      !status.number_of_seasons ||
                      !status.content_requests ||
                      !status.user_content_metrics ||
                      !status.admin_activities

    return NextResponse.json({
      success: true,
      columns,
      tables,
      status,
      needsSync,
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
